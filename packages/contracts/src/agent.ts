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

export const MESSAGE_ROLE = ['user', 'assistant', 'tool'] as const;
export type MessageRole = (typeof MESSAGE_ROLE)[number];

/** A tool the assistant asked to run, as it appeared in its reply. */
export const toolCallSchema = z.object({
  id: z.string(),
  /** The capability name, e.g. `medicines.create`. */
  name: z.string(),
  args: z.record(z.string(), z.unknown()),
});
export type ToolCall = z.infer<typeof toolCallSchema>;

export const chatSessionSchema = z.object({
  ...recordMetaShape,
  title: z.string().max(200),
  lastMessageAt: timestampSchema.nullable(),
});
export type ChatSession = z.infer<typeof chatSessionSchema>;

export const chatMessageSchema = z.object({
  ...recordMetaShape,
  sessionId: idSchema,
  role: z.enum(MESSAGE_ROLE),
  content: z.string(),
  /** Present on assistant turns that asked for tools. */
  toolCalls: z.array(toolCallSchema),
  /** Present on `tool` turns: which call this is the result of. */
  toolCallId: z.string().nullable(),
});
export type ChatMessage = z.infer<typeof chatMessageSchema>;

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

export const listMessagesSchema = paginationSchema.extend({
  sessionId: idSchema,
});
export type ListMessagesInput = z.infer<typeof listMessagesSchema>;

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
  toolCallId: z.string().min(1),
  approved: z.boolean(),
});
export type ResumeAgentInput = z.infer<typeof resumeAgentSchema>;

/** What `GET /api/agent` reports. */
export const agentInfoSchema = z.object({
  protocol: z.literal('ag-ui'),
  transport: z.literal('sse'),
  model: z.string(),
  toolCount: z.number().int().min(0),
  /** Whether write tools pause for confirmation before running. */
  confirmsWrites: z.boolean(),
});
export type AgentInfo = z.infer<typeof agentInfoSchema>;
