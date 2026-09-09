import { useVoice } from '@personaai/react';
import { useEffect, useMemo, useRef } from 'react';

import { PERSONA_AGENT_ID } from '../../lib/chat-store';

export interface TranscriptLine {
  role: 'user' | 'assistant';
  text: string;
  /** Still being spoken -- the next update for this role replaces it in place. */
  committed: boolean;
}

export type VoiceCallState =
  | 'connecting'
  | 'ready'
  | 'active'
  | 'reconnecting'
  | 'ended'
  | 'error';

/**
 * Connects the UI to Persona's real-time voice session using @personaai/react.
 */
export function useVoiceCall(sessionId?: string): {
  status: VoiceCallState;
  transcript: TranscriptLine[];
  errorMessage: string | null;
  endCall: () => void;
} {
  const voice = useVoice({
    agentId: PERSONA_AGENT_ID,
    threadId: sessionId,
  });

  const startedRef = useRef(false);

  useEffect(() => {
    if (!startedRef.current) {
      startedRef.current = true;
      voice.start().catch((err: unknown) => {
        console.warn('[voice] Failed to start voice session:', err);
      });
    }

    return () => {
      voice.stop();
    };
  }, [voice]);

  const status: VoiceCallState = useMemo(() => {
    switch (voice.state) {
      case 'listening':
      case 'speaking':
      case 'thinking':
        return 'active';
      case 'ended':
        return 'ended';
      case 'error':
        return 'error';
      case 'connecting':
      case 'idle':
      default:
        return 'connecting';
    }
  }, [voice.state]);

  const transcript: TranscriptLine[] = useMemo(() => {
    const list: TranscriptLine[] = (voice.transcript ?? []).map((line) => ({
      role: line.speaker === 'agent' ? 'assistant' : 'user',
      text: line.text,
      committed: true,
    }));

    if (voice.partial && voice.partial.text) {
      list.push({
        role: voice.partial.speaker === 'agent' ? 'assistant' : 'user',
        text: voice.partial.text,
        committed: false,
      });
    }

    return list;
  }, [voice.transcript, voice.partial]);

  return {
    status,
    transcript,
    errorMessage: voice.error ? voice.error.message : null,
    endCall: voice.stop,
  };
}
