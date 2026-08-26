import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HumanMessage } from '@langchain/core/messages';
import { Command } from '@langchain/langgraph';
import { DEFAULT_SESSION_TITLE } from '@repo/contracts';
import type {
  Actor,
  AgentFile,
  AgentTodo,
  PendingApproval,
  ResumeAgentInput,
  RunAgentInput,
  SessionState,
  TranscriptToolCall,
  TranscriptTurn,
} from '@repo/contracts';
import { randomUUID } from 'node:crypto';

import { CapabilityRegistry } from '../../capabilities/capability-registry.service';
import { DomainError } from '../../common/errors';
import {
  confirmationRequired,
  runError,
  runFinished,
  runStarted,
  sessionTitled,
  stateSnapshot,
  type AguiEvent,
} from './agui/events';
import { AguiTranslator, textOf } from './agui/translator';
import { fromToolName } from './llm/tool-adapter';
import { AgentFactory } from './llm/agent.factory';
import { ModelFactory } from './llm/model.factory';
import { TitleService } from './llm/title.service';
import { SessionService } from './sessions/session.service';

/** One reply at a time per person -- an SSE stream each is enough to hurt. */
const activeRuns = new Set<string>();

/**
 * The health assistant.
 *
 * Deliberately thin. The conversation loop, persistence and the pause before
 * a write all come from deepagents; the capabilities come from the registry.
 * What lives here is only the part that is this product's: which session a
 * run belongs to, and turning the graph's events into AG-UI.
 */
@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);

  constructor(
    private readonly agents: AgentFactory,
    private readonly sessions: SessionService,
    private readonly titles: TitleService,
    private readonly models: ModelFactory,
    private readonly registry: CapabilityRegistry,
    private readonly config: ConfigService,
  ) {}

  /** Whether a write waits for the user's word. On unless switched off. */
  get confirmsWrites(): boolean {
    return this.config.get<string>('AGENT_CONFIRM_WRITES') !== 'false';
  }

  /** The skills the assistant has. */
  skills(): Array<{ name: string; description: string }> {
    return this.agents.skills();
  }

  info() {
    return {
      protocol: 'ag-ui' as const,
      transport: 'sse' as const,
      model: this.models.chatModelName,
      toolCount: this.registry.list().length,
      skillCount: this.agents.skills().length,
      confirmsWrites: this.confirmsWrites,
    };
  }

  /**
   * Everything needed to reopen a conversation as it was left.
   *
   * Read out of the graph rather than a table of our own: the checkpointer is
   * what actually persisted it, and a second copy would be one more thing to
   * keep in step. Returned in one call so the turns, the workspace and any
   * unanswered approval cannot disagree with each other.
   */
  async state(actor: Actor, sessionId: string): Promise<SessionState> {
    // Proves the session is the caller's before any graph state is touched.
    const session = await this.sessions.get(actor, { id: sessionId });

    const agent = this.agents.build(actor, this.confirmsWrites);
    const snapshot = await readGraphState(agent, sessionId);

    return {
      session,
      messages: normalizeTurns(snapshot.values?.messages ?? []),
      files: toFiles(snapshot.values?.files),
      todos: toTodos(snapshot.values?.todos),
      pendingApprovals: pendingApprovals(snapshot.tasks),
    };
  }

  run(actor: Actor, input: RunAgentInput): AsyncGenerator<AguiEvent> {
    return this.stream(actor, input.sessionId, { message: input.message });
  }

  resume(actor: Actor, input: ResumeAgentInput): AsyncGenerator<AguiEvent> {
    return this.stream(actor, input.sessionId, { decisions: input.decisions });
  }

  private async *stream(
    actor: Actor,
    sessionId: string | undefined,
    start: { message: string } | { decisions: ResumeAgentInput['decisions'] },
  ): AsyncGenerator<AguiEvent> {
    if (!this.models.isConfigured) {
      yield runError(
        'The assistant is not configured on this server.',
        'not_configured',
      );
      return;
    }
    if (activeRuns.has(actor.userId)) {
      yield runError(
        'You already have a reply in progress.',
        'run_in_progress',
      );
      return;
    }

    activeRuns.add(actor.userId);
    const runId = randomUUID();
    const translator = new AguiTranslator();

    try {
      const session = await this.sessions.resolveForRun(actor, sessionId);
      yield runStarted(session.id, runId);

      let titleWork: Promise<string | null> | null = null;
      if ('message' in start && session.title === DEFAULT_SESSION_TITLE) {
        // Alongside the answer, so naming never delays it.
        titleWork = this.titles.generate(start.message);
      }

      const agent = this.agents.build(actor, this.confirmsWrites);
      const config = {
        configurable: { thread_id: session.id },
        version: 'v2' as const,
      };

      // A resume carries the user's decision back into the paused graph;
      // a new message starts a turn.
      const input =
        'message' in start
          ? { messages: [new HumanMessage(start.message)] }
          : new Command({ resume: { decisions: start.decisions } });

      for await (const event of agent.streamEvents(input, config)) {
        yield* translator.translate(event);
      }
      yield* translator.finish();

      const settled = await readGraphState(agent, session.id);
      yield stateSnapshot(
        toFiles(settled.values?.files),
        toTodos(settled.values?.todos),
      );

      for (const approval of pendingApprovals(settled.tasks)) {
        yield confirmationRequired(
          approval.index,
          approval.toolName,
          approval.args,
          approval.description ?? 'This will change your health record.',
        );
      }

      await this.sessions.touch(actor, session.id);

      if (titleWork) {
        const title = await titleWork;
        if (
          title &&
          (await this.sessions.retitleIfUntouched(actor, session.id, title))
        ) {
          yield sessionTitled(session.id, title);
        }
      }

      yield runFinished(session.id, runId);
    } catch (error) {
      const message =
        error instanceof DomainError
          ? error.message
          : 'Something went wrong answering that.';
      if (!(error instanceof DomainError)) {
        this.logger.error(`Run failed: ${String(error)}`);
      }
      yield* translator.fail(message);
    } finally {
      activeRuns.delete(actor.userId);
    }
  }

  /**
   * If the graph stopped on a write, say what it is waiting for.
   *
   * deepagents' `interruptOn` halts the graph before the tool runs; the
   * pending call sits in the interrupt, and the client answers it through
   * `/agent/resume`.
   */
}

/**
 * Read a conversation's persisted graph state.
 *
 * deepagents does not surface `getState` in its published types, so the shape
 * is declared here at the boundary. `Promise.resolve` keeps this correct
 * whether the underlying call is synchronous or not.
 */
async function readGraphState(
  agent: { getState: (config: unknown) => unknown },
  threadId: string,
): Promise<GraphSnapshot> {
  const snapshot: unknown = await Promise.resolve(
    agent.getState({ configurable: { thread_id: threadId } }),
  );
  return snapshot ?? {};
}

interface StoredMessage {
  getType?: () => string;
  _getType?: () => string;
  content?: unknown;
  id?: string;
  tool_calls?: Array<{ id?: string; name?: string; args?: unknown }>;
  tool_call_id?: string;
  status?: string;
}

interface GraphSnapshot {
  values?: { messages?: StoredMessage[]; files?: unknown; todos?: unknown };
  tasks?: PendingTask[];
}

/**
 * Fold the graph's raw message list into the transcript a person saw.
 *
 * Two things have to happen, and both are easy to miss:
 *
 * A tool result is a separate `tool` message referring back to a call by id.
 * It is folded onto the call so a client renders one row instead of
 * re-pairing them itself.
 *
 * One agent turn is routinely several AIMessages -- one deciding to call a
 * tool, with no text, then another with the answer once the result returns --
 * while the live stream shows a single reply. Without merging consecutive
 * assistant messages, reopening a conversation would split one reply into
 * bubbles that never appeared while it was happening.
 */
export function normalizeTurns(raw: StoredMessage[]): TranscriptTurn[] {
  const turns: TranscriptTurn[] = [];
  const callsById = new Map<string, TranscriptToolCall>();

  for (const message of raw) {
    const kind = message.getType?.() ?? message._getType?.() ?? '';

    if (kind === 'tool') {
      const call = message.tool_call_id
        ? callsById.get(message.tool_call_id)
        : undefined;
      if (call) {
        call.result = textOf(message.content);
        call.isError = message.status === 'error';
      }
      continue;
    }
    // System prompts are not part of the conversation as it was experienced.
    if (kind !== 'human' && kind !== 'ai') {
      continue;
    }

    const role = kind === 'human' ? 'user' : 'assistant';
    const content = textOf(message.content);
    const toolCalls = (message.tool_calls ?? []).map((call) => {
      const entry: TranscriptToolCall = {
        toolCallId: call.id ?? randomUUID(),
        toolName: fromToolName(call.name ?? ''),
        args: (call.args ?? {}) as Record<string, unknown>,
        result: null,
        isError: false,
      };
      callsById.set(entry.toolCallId, entry);
      return entry;
    });

    const previous = turns.at(-1);
    if (role === 'assistant' && previous?.role === 'assistant') {
      // Concatenated with no separator, matching how the live stream builds
      // the text: deltas appended, with no notion of message boundaries.
      previous.content += content;
      previous.toolCalls.push(...toolCalls);
      continue;
    }

    turns.push({
      id: message.id ?? `${kind}-${turns.length}`,
      role,
      content,
      toolCalls,
    });
  }

  return turns;
}

/** The agent's workspace, minus directories and its own skill files. */
function toFiles(raw: unknown): AgentFile[] {
  if (!raw || typeof raw !== 'object') {
    return [];
  }
  const files: AgentFile[] = [];

  for (const [path, data] of Object.entries(raw as Record<string, unknown>)) {
    if (path.startsWith('/skills/') || path.endsWith('/')) {
      continue;
    }
    const entry = data as {
      content?: unknown;
      is_dir?: boolean;
      isDir?: boolean;
    };
    if (entry?.is_dir === true || entry?.isDir === true) {
      continue;
    }
    const content = textOf(entry?.content);
    files.push({ path, content, size: content.length });
  }

  return files;
}

function toTodos(raw: unknown): AgentTodo[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.map((todo: { content?: unknown; status?: unknown }) => ({
    content: typeof todo?.content === 'string' ? todo.content : '',
    status: typeof todo?.status === 'string' ? todo.status : 'pending',
  }));
}

/**
 * The write the graph stopped on, if it is still waiting.
 *
 * Read on load as well as during a run: an approval the user never answered
 * has to survive closing the app, or the conversation is stuck with no way
 * to see why.
 */
function pendingApprovals(tasks: PendingTask[] | undefined): PendingApproval[] {
  const approvals: PendingApproval[] = [];

  for (const task of tasks ?? []) {
    for (const interrupt of task.interrupts ?? []) {
      // `actionRequests`, camelCase, each `{ name, args, description? }` --
      // there is no id anywhere in it, which is why decisions are positional.
      const requests = interrupt.value?.actionRequests ?? [];
      requests.forEach((request, index) => {
        approvals.push({
          index,
          toolName: fromToolName(request.name ?? ''),
          args: (request.args ?? {}) as Record<string, unknown>,
          description:
            typeof request.description === 'string'
              ? request.description
              : null,
        });
      });
    }
  }

  return approvals;
}

interface PendingTask {
  interrupts?: Array<{
    value?: {
      actionRequests?: Array<{
        name?: string;
        args?: unknown;
        description?: unknown;
      }>;
    };
  }>;
}
