import { z } from 'zod';

import { idSchema, paginationSchema, recordMetaShape, timestampSchema } from './common';

/**
 * Historical record of a voice conversation.
 */
export const voiceCallTurnSchema = z.object({
  role: z.enum(['user', 'assistant']),
  text: z.string(),
  at: timestampSchema,
});
export type VoiceCallTurn = z.infer<typeof voiceCallTurnSchema>;

export const voiceCallLogSchema = z.object({
  ...recordMetaShape,
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
