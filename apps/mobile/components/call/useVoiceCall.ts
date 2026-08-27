import { useAuth } from '@clerk/expo';
import type { VoiceServerMessage } from '@repo/contracts';
import { requestRecordingPermissionsAsync, useAudioStream } from 'expo-audio';
import type { AudioStreamBuffer } from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';

import { bytesToBase64 } from '../../lib/base64';
import { VoicePlayback } from '../../lib/pcm-playback';
import { VoiceCallClient } from '../../lib/voice-call';
import type { VoiceCallState } from '../../lib/voice-call';

export interface TranscriptLine {
  role: 'user' | 'assistant';
  text: string;
  /** Still being spoken -- the next update for this role replaces it in place. */
  committed: boolean;
}

/**
 * A voice call end to end: opens the relay, starts the mic only once the
 * call is actually accepted (never for a call rejected as already-in-progress
 * or rate-limited), plays back what comes in, and tears everything down on
 * unmount or hangup.
 *
 * Capture uses `expo-audio`'s own `useAudioStream` -- an official, first-party
 * source of real-time raw PCM, so this needs no third-party native module for
 * the microphone side. Playback (`lib/pcm-playback.ts`) is the part with no
 * equally direct answer; see that file for why.
 */
export function useVoiceCall(sessionId?: string) {
  const { getToken } = useAuth();
  const [status, setStatus] = useState<VoiceCallState>('connecting');
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const clientRef = useRef<VoiceCallClient | null>(null);
  const playbackRef = useRef<VoicePlayback | null>(null);

  const { stream } = useAudioStream({
    sampleRate: 16_000,
    channels: 1,
    encoding: 'int16',
    onBuffer: (buffer: AudioStreamBuffer) => {
      clientRef.current?.sendAudioChunk(bytesToBase64(new Uint8Array(buffer.data)));
    },
  });
  // A ref rather than a dependency: `useAudioStream` returns a new `stream`
  // object each render, and the effect below must only run once per call.
  const streamRef = useRef(stream);
  useEffect(() => {
    streamRef.current = stream;
  }, [stream]);

  useEffect(() => {
    let cancelled = false;
    let micStarted = false;
    const playback = new VoicePlayback();
    playbackRef.current = playback;

    const startMic = async () => {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) {
        throw new Error('Microphone permission denied');
      }
      await streamRef.current.start();
      micStarted = true;
    };

    const stopMic = () => {
      if (micStarted) {
        micStarted = false;
        streamRef.current.stop();
      }
    };

    const client = new VoiceCallClient({
      onStateChange: (state) => {
        if (cancelled) {
          return;
        }
        setStatus(state);
        if (state === 'active' && !micStarted) {
          startMic().catch(() => setErrorMessage('Could not access the microphone.'));
        }
        if (state === 'ended' || state === 'error') {
          stopMic();
          playback.stop();
        }
      },
      onMessage: (message: VoiceServerMessage) => {
        if (cancelled) {
          return;
        }
        if (message.type === 'audio') {
          playback.enqueue(message.data);
        } else if (message.type === 'transcript') {
          setTranscript((current) => upsertTranscript(current, message));
        } else if (message.type === 'interrupted') {
          // The user started talking over the reply -- stop playing what is
          // already queued rather than let it keep going underneath them.
          playback.flush();
        } else if (message.type === 'call.error') {
          setErrorMessage(message.message);
        }
      },
    });
    clientRef.current = client;

    client.connect(() => getToken(), sessionId).catch(() => {
      if (!cancelled) {
        setStatus('error');
        setErrorMessage('Could not start the call.');
      }
    });

    return () => {
      cancelled = true;
      stopMic();
      playback.stop();
      clientRef.current?.close();
      clientRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- connect once per screen visit
  }, [sessionId]);

  const endCall = useCallback(() => {
    streamRef.current.stop();
    clientRef.current?.end();
  }, []);

  return { status, transcript, errorMessage, endCall };
}

function upsertTranscript(
  current: TranscriptLine[],
  message: Extract<VoiceServerMessage, { type: 'transcript' }>,
): TranscriptLine[] {
  const last = current.at(-1);
  if (last && last.role === message.role && !last.committed) {
    return [
      ...current.slice(0, -1),
      { role: message.role, text: message.text, committed: message.final },
    ];
  }
  return [...current, { role: message.role, text: message.text, committed: message.final }];
}
