import { z } from 'zod';

import { idSchema, paginationSchema, recordMetaShape, timestampSchema } from './common';

/**
 * Real-time voice calling.
 *
 * The mobile app talks to a WebSocket gateway on the API, which is in turn
 * the only thing that talks to Gemini Live -- the same relay shape text chat
 * already uses (mobile never holds a model API key). This protocol is
 * deliberately its own thing rather than a mirror of Gemini's wire format,
 * so the mobile app never has to know which model or vendor answers a call.
 */

// --- mobile <-> API protocol -----------------------------------------------

export const voiceClientMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('call.start'), sessionId: idSchema.optional() }),
  z.object({
    type: z.literal('audio'),
    data: z.string().describe('Base64 16-bit PCM, 16kHz mono'),
    sequence: z.number().int().min(0),
  }),
  z.object({ type: z.literal('call.end') }),
]);
export type VoiceClientMessage = z.infer<typeof voiceClientMessageSchema>;

export const voiceTranscriptRoleSchema = z.enum(['user', 'assistant']);
export type VoiceTranscriptRole = z.infer<typeof voiceTranscriptRoleSchema>;

export const voiceServerMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('call.ready'), callId: z.string() }),
  z.object({
    type: z.literal('audio'),
    data: z.string().describe('Base64 16-bit PCM, 24kHz mono'),
  }),
  z.object({
    type: z.literal('transcript'),
    role: voiceTranscriptRoleSchema,
    text: z.string(),
    final: z.boolean(),
  }),
  /** Model generation was cut off by the user speaking; flush queued audio now. */
  z.object({ type: z.literal('interrupted') }),
  z.object({ type: z.literal('reconnecting') }),
  z.object({ type: z.literal('reconnected') }),
  z.object({
    type: z.literal('call.error'),
    code: z.string(),
    message: z.string(),
  }),
  z.object({ type: z.literal('call.ended'), reason: z.string() }),
]);
export type VoiceServerMessage = z.infer<typeof voiceServerMessageSchema>;

// --- info -------------------------------------------------------------------

/** What `GET /voice` reports, so the client can gray out the call button. */
export const voiceInfoSchema = z.object({
  isConfigured: z.boolean(),
  model: z.string().nullable(),
  callsPerHour: z.number().int().min(0),
  maxCallMinutes: z.number().int().min(0),
});
export type VoiceInfo = z.infer<typeof voiceInfoSchema>;

// --- call log ----------------------------------------------------------------

/**
 * One turn of a call's transcript.
 *
 * Voice calls do not share text chat's message store (the LangGraph
 * checkpointer, keyed by session id) -- there is no supported way to append
 * to that outside of a real graph run. A call's transcript is assembled in
 * memory for the call's duration and written here once, on hangup.
 */
export const voiceCallTurnSchema = z.object({
  role: voiceTranscriptRoleSchema,
  text: z.string(),
  at: timestampSchema,
});
export type VoiceCallTurn = z.infer<typeof voiceCallTurnSchema>;

export const voiceCallLogSchema = z.object({
  ...recordMetaShape,
  /** Display-only pointer to a chat session; not referentially enforced. */
  linkedSessionId: idSchema.nullable(),
  model: z.string(),
  startedAt: timestampSchema,
  endedAt: timestampSchema.nullable(),
  endReason: z.string().nullable(),
  turns: z.array(voiceCallTurnSchema).max(500),
});
export type VoiceCallLog = z.infer<typeof voiceCallLogSchema>;

export const listVoiceCallsSchema = paginationSchema;
export type ListVoiceCallsInput = z.infer<typeof listVoiceCallsSchema>;
