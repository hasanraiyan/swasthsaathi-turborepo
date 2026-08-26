import { z } from 'zod';

import {
  byIdSchema,
  capability,
  idSchema,
  paginationSchema,
  recordMetaShape,
  timestampSchema,
} from './common';

/**
 * The chat layer: sessions, their messages, and the agent's own memory.
 *
 * The agent is deliberately thin here. It has no capabilities of its own --
 * everything it can do comes from the same `CapabilityRegistry` the REST API
 * and the mobile app use, so there is exactly one implementation of "add a
 * medicine" and the agent is just a third caller of it.
 */

/** Title a session carries until the first message names it. */
export const DEFAULT_SESSION_TITLE = 'New chat';

/**
 * One conversation.
 *
 * Holds only what the graph does not: a name and when it was last used. The
 * turns themselves live in the checkpointer, keyed by this record's id.
 */
export const chatSessionSchema = z.object({
  ...recordMetaShape,
  title: z.string().max(200),
  lastMessageAt: timestampSchema.nullable(),
});
export type ChatSession = z.infer<typeof chatSessionSchema>;

export const createSessionSchema = z.object({
  title: z.string().min(1).max(200).optional(),
});
export type CreateSessionInput = z.infer<typeof createSessionSchema>;

export const updateSessionTitleSchema = byIdSchema.extend({
  title: z.string().min(1).max(200),
});
export type UpdateSessionTitleInput = z.infer<typeof updateSessionTitleSchema>;

export const listSessionsSchema = paginationSchema;
export type ListSessionsInput = z.infer<typeof listSessionsSchema>;

// --- memory --------------------------------------------------------------

/**
 * A memory file.
 *
 * Markdown keyed by a short path, the way a person keeps notes -- the agent
 * reads all of them at the start of a run and writes back what is worth
 * remembering next time. Kept deliberately human-readable so the user can
 * see, edit and delete exactly what is being remembered about them, which
 * matters more than usual when the subject is their health.
 */
export const agentMemorySchema = z.object({
  ...recordMetaShape,
  key: z.string().min(1).max(120),
  content: z.string().max(20_000),
});
export type AgentMemory = z.infer<typeof agentMemorySchema>;

export const memoryKeySchema = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9][a-z0-9-]*(\/[a-z0-9][a-z0-9-]*)*$/, 'Use lowercase words separated by - or /');

export const writeMemorySchema = z.object({
  key: memoryKeySchema.describe('Short path, e.g. "preferences" or "conditions/diabetes"'),
  content: z.string().min(1).max(20_000).describe('Markdown worth remembering next time'),
});
export type WriteMemoryInput = z.infer<typeof writeMemorySchema>;

export const deleteMemorySchema = z.object({ key: memoryKeySchema });
export type DeleteMemoryInput = z.infer<typeof deleteMemorySchema>;

/**
 * Memory is exposed as capabilities rather than wired into the agent
 * directly, so it becomes a tool automatically and is reachable over REST
 * with the same validation and ownership scoping as everything else.
 */
export const memoryCapabilities = {
  list: capability({
    name: 'memory.list',
    description:
      'List everything currently remembered about this user, as markdown files keyed by a short path.',
    kind: 'read',
    input: z.object({}),
  }),
  write: capability({
    name: 'memory.write',
    description:
      'Remember something for next time, or replace what is already remembered under this key. Use it for lasting facts and preferences, never for a passing detail of the current conversation.',
    kind: 'write',
    input: writeMemorySchema,
  }),
  remove: capability({
    name: 'memory.delete',
    description: 'Forget what is remembered under this key.',
    kind: 'write',
    input: deleteMemorySchema,
  }),
} as const;

// --- running the agent ---------------------------------------------------

export const runAgentSchema = z.object({
  sessionId: idSchema.optional().describe('Omit to start a new session'),
  message: z.string().min(1).max(8000),
});
export type RunAgentInput = z.infer<typeof runAgentSchema>;

/**
 * Answer to a paused run.
 *
 * A run stops rather than performing a write the user has not seen. `approved`
 * carries out the pending call; otherwise it is abandoned and the agent is
 * told so.
 */
export const resumeAgentSchema = z.object({
  sessionId: idSchema,
  /**
   * One decision per pending action, in the order they were offered. A
   * rejection carries the reason so the model can re-plan rather than simply
   * being refused.
   */
  decisions: z
    .array(
      z.object({
        type: z.enum(['approve', 'reject']),
        message: z.string().max(500).optional(),
      }),
    )
    .min(1),
});
export type ResumeAgentInput = z.infer<typeof resumeAgentSchema>;

// --- loading a conversation ----------------------------------------------

/**
 * A tool call as the transcript shows it, with its result folded in.
 *
 * The graph stores the call and its result as two separate messages. Keeping
 * them apart would make every client re-pair them by id to render one row.
 */
export const transcriptToolCallSchema = z.object({
  toolCallId: z.string(),
  toolName: z.string(),
  args: z.record(z.string(), z.unknown()),
  result: z.string().nullable(),
  isError: z.boolean(),
});
export type TranscriptToolCall = z.infer<typeof transcriptToolCallSchema>;

export const transcriptTurnSchema = z.object({
  id: z.string(),
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  toolCalls: z.array(transcriptToolCallSchema),
});
export type TranscriptTurn = z.infer<typeof transcriptTurnSchema>;

/** A file in the agent's workspace. */
export const agentFileSchema = z.object({
  path: z.string(),
  content: z.string(),
  size: z.number().int().min(0),
});
export type AgentFile = z.infer<typeof agentFileSchema>;

export const agentTodoSchema = z.object({
  content: z.string(),
  status: z.string(),
});
export type AgentTodo = z.infer<typeof agentTodoSchema>;

/**
 * A write the agent stopped on, still waiting for an answer.
 *
 * Identified by position, not by id: the interrupt carries a list of actions
 * with a name and arguments and no identifier of any kind, and decisions are
 * matched back to them by order.
 */
export const pendingApprovalSchema = z.object({
  index: z.number().int().min(0),
  toolName: z.string(),
  args: z.record(z.string(), z.unknown()),
  description: z.string().nullable(),
});
export type PendingApproval = z.infer<typeof pendingApprovalSchema>;

/**
 * Everything needed to reopen a conversation exactly as it was left.
 *
 * One read rather than several: a client restoring a session needs the turns,
 * the workspace and any unanswered approval together, and fetching them
 * separately would let them disagree.
 */
export const sessionStateSchema = z.object({
  session: chatSessionSchema,
  messages: z.array(transcriptTurnSchema),
  files: z.array(agentFileSchema),
  todos: z.array(agentTodoSchema),
  /** Empty unless the agent is waiting on the user before a write. */
  pendingApprovals: z.array(pendingApprovalSchema),
});
export type SessionState = z.infer<typeof sessionStateSchema>;

/** What `GET /api/agent` reports. */
export const agentInfoSchema = z.object({
  protocol: z.literal('ag-ui'),
  transport: z.literal('sse'),
  model: z.string(),
  /** Where the model is served from; null means OpenAI itself. */
  endpoint: z.string().nullable(),
  toolCount: z.number().int().min(0),
  skillCount: z.number().int().min(0),
  /** Whether write tools pause for confirmation before running. */
  confirmsWrites: z.boolean(),
});
export type AgentInfo = z.infer<typeof agentInfoSchema>;
