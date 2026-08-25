import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HumanMessage } from '@langchain/core/messages';
import { Command } from '@langchain/langgraph';
import { DEFAULT_SESSION_TITLE } from '@repo/contracts';
import type { Actor, ResumeAgentInput, RunAgentInput } from '@repo/contracts';
import { randomUUID } from 'node:crypto';

import { CapabilityRegistry } from '../../capabilities/capability-registry.service';
import { DomainError } from '../../common/errors';
import {
  confirmationRequired,
  runError,
  runFinished,
  runStarted,
  sessionTitled,
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

  info() {
    return {
      protocol: 'ag-ui' as const,
      transport: 'sse' as const,
      model: this.models.chatModelName,
      toolCount: this.registry.list().length,
      confirmsWrites: this.confirmsWrites,
    };
  }

  /**
   * A conversation's turns.
   *
   * Read back out of the checkpointer rather than a table of our own: the
   * graph is what actually persisted them, and a second copy would be one
   * more thing to keep in step for no gain.
   */
  async messages(actor: Actor, sessionId: string) {
    // Proves the session is the caller's before any graph state is touched.
    await this.sessions.get(actor, { id: sessionId });

    const agent = this.agents.build(actor, this.confirmsWrites);
    const state = await readGraphState(agent, sessionId);

    const items = (state.values?.messages ?? [])
      .map(toTurn)
      .filter((turn): turn is Turn => turn !== null);

    return { items, total: items.length };
  }

  run(actor: Actor, input: RunAgentInput): AsyncGenerator<AguiEvent> {
    return this.stream(actor, input.sessionId, { message: input.message });
  }

  resume(actor: Actor, input: ResumeAgentInput): AsyncGenerator<AguiEvent> {
    return this.stream(actor, input.sessionId, { approved: input.approved });
  }

  private async *stream(
    actor: Actor,
    sessionId: string | undefined,
    start: { message: string } | { approved: boolean },
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
          : new Command({
              resume: { decision: start.approved ? 'accept' : 'reject' },
            });

      for await (const event of agent.streamEvents(input, config)) {
        yield* translator.translate(event);
      }
      yield* translator.finish();

      yield* this.reportPause(agent, config, session.id);
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
  private async *reportPause(
    agent: { getState: (config: unknown) => Promise<unknown> },
    config: unknown,
    sessionId: string,
  ): AsyncGenerator<AguiEvent> {
    try {
      const state = (await agent.getState(config)) as
        { tasks?: PendingTask[] } | undefined;
      const interrupts = (state?.tasks ?? []).flatMap(
        (task) => task.interrupts ?? [],
      );

      for (const interrupt of interrupts) {
        const request =
          interrupt.value?.action_requests?.[0] ?? interrupt.value ?? {};
        yield confirmationRequired(
          asText(request.tool_call_id) ?? sessionId,
          asText(request.action) ?? asText(request.name) ?? 'action',
          request.args ?? {},
          'This will change your health record.',
        );
      }
    } catch (error) {
      this.logger.warn(`Could not read graph state: ${String(error)}`);
    }
  }
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
): Promise<{ values?: { messages?: StoredMessage[] } }> {
  const snapshot: unknown = await Promise.resolve(
    agent.getState({ configurable: { thread_id: threadId } }),
  );
  return snapshot ?? {};
}

/**
 * The interrupt payload is untyped, so a field that should be a string might
 * be anything. Anything that isn't one is treated as absent rather than
 * stringified into `[object Object]`.
 */
function asText(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

interface StoredMessage {
  getType?: () => string;
  _getType?: () => string;
  content?: unknown;
  id?: string;
  tool_calls?: Array<{ id?: string; name?: string; args?: unknown }>;
  tool_call_id?: string;
}

export interface Turn {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls: Array<{ id: string; name: string; args: unknown }>;
  toolCallId: string | null;
}

/** LangChain message classes name their kind through `getType()`. */
function toTurn(message: StoredMessage): Turn | null {
  const kind = message.getType?.() ?? message._getType?.() ?? '';
  const role =
    kind === 'human'
      ? 'user'
      : kind === 'ai'
        ? 'assistant'
        : kind === 'tool'
          ? 'tool'
          : null;
  if (!role) {
    // System prompts and anything else internal are not part of the
    // conversation as the user experienced it.
    return null;
  }

  return {
    id: message.id ?? randomUUID(),
    role,
    content: textOf(message.content),
    toolCalls: (message.tool_calls ?? []).map((call) => ({
      id: call.id ?? randomUUID(),
      name: fromToolName(call.name ?? ''),
      args: call.args ?? {},
    })),
    toolCallId: message.tool_call_id ?? null,
  };
}

interface PendingTask {
  interrupts?: Array<{
    value?: {
      action_requests?: Array<Record<string, unknown>>;
      [key: string]: unknown;
    };
  }>;
}
