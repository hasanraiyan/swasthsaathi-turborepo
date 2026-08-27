import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI, Modality } from '@google/genai';
import type { LiveServerMessage, Session } from '@google/genai';
import { voiceClientMessageSchema } from '@repo/contracts';
import type {
  Actor,
  VoiceClientMessage,
  VoiceServerMessage,
} from '@repo/contracts';
import type WebSocket from 'ws';

import { CapabilityRegistry } from '../../capabilities/capability-registry.service';
import {
  END_CALL_FUNCTION_DECLARATION,
  END_CALL_TOOL_NAME,
  buildFunctionDeclarations,
  handleFunctionCalls,
} from './gemini-tool-adapter';
import { VoiceCallLimiter } from './voice-call-limiter.service';
import { VoiceCallLogService } from './voice-call-log.service';

/** One active call per person, matching the text agent's `activeRuns` gate. */
const activeCalls = new Set<string>();

/** How long a connected socket may sit without sending `call.start`. */
const START_TIMEOUT_MS = 15_000;

/**
 * Grace period between the assistant asking to end the call and the call
 * ending regardless, in case `turnComplete` never arrives to confirm its
 * goodbye actually finished streaming.
 */
const END_CALL_GRACE_MS = 6_000;

const SYSTEM_INSTRUCTION = [
  'You are the Swasthya Saathi health assistant, speaking with someone on a',
  'live voice call rather than typing. Keep replies short and conversational --',
  'a sentence or two, the way a person talks on the phone, not the longer,',
  'structured answers you might give in a text chat.',
  '',
  'You have the same tools a text conversation with this person would have:',
  'their medicines, records, appointments and reminders. Use them the same',
  'way -- read before you assume, and say plainly what you changed after a',
  'write. This is a health context: never guess at a dose, a diagnosis, or',
  'anything the person did not tell you, and say so if you are unsure rather',
  'than sounding certain.',
  '',
  `You can also end the call yourself with the ${END_CALL_TOOL_NAME} tool --`,
  'use it once the conversation has clearly wrapped up (a goodbye, or nothing',
  'more they need), right after saying a brief goodbye out loud. Do not use',
  'it while a question is still open or the person is still talking.',
].join(' ');

/** What one call ends up looking like once it is over. */
interface CallSummary {
  linkedSessionId: string | null;
  model: string;
  startedAt: Date;
  turns: Array<{ role: 'user' | 'assistant'; text: string; at: Date }>;
}

/**
 * One phone call's worth of state: the Gemini Live session behind it, the
 * transcript it is accumulating, and the reconnect-on-GoAway handling.
 *
 * Kept as its own object per connection rather than inline in the service so
 * a service instance (one per process) can host many concurrent calls
 * without their mutable state (buffers, timers, the current session
 * reference) colliding.
 */
class ActiveVoiceCall {
  private session?: Session;
  private started = false;
  private ended = false;
  /** Set once the assistant has called `end_call`; hang up on the next `turnComplete`. */
  private endRequested = false;
  private resumeHandle?: string;
  private durationTimer?: NodeJS.Timeout;
  private startTimer?: NodeJS.Timeout;
  private inputBuffer = '';
  private outputBuffer = '';
  private readonly turns: CallSummary['turns'] = [];
  private readonly startedAt = new Date();
  private linkedSessionId: string | null = null;

  constructor(
    private readonly client: WebSocket,
    private readonly actor: Actor,
    private readonly deps: {
      ai: GoogleGenAI;
      model: string;
      maxCallMinutes: number;
      registry: CapabilityRegistry;
      logs: VoiceCallLogService;
      logger: Logger;
    },
  ) {
    this.startTimer = setTimeout(() => {
      if (!this.started) {
        this.send({
          type: 'call.error',
          code: 'start_timeout',
          message: 'No call was started.',
        });
        this.close();
      }
    }, START_TIMEOUT_MS);
  }

  handleMessage(raw: WebSocket.RawData): void {
    const parsed = this.parse(raw);
    if (!parsed) {
      this.deps.logger.warn(
        `Dropped an unparseable client frame from ${this.actor.userId}.`,
      );
      return;
    }
    if (parsed.type === 'call.start') {
      if (!this.started) {
        this.deps.logger.log(
          `call.start received from ${this.actor.userId} (linkedSessionId=${parsed.sessionId ?? 'none'}).`,
        );
        this.started = true;
        clearTimeout(this.startTimer);
        void this.start(parsed.sessionId);
      }
      return;
    }
    if (!this.started || this.ended) {
      return;
    }
    if (parsed.type === 'audio') {
      this.session?.sendRealtimeInput({
        audio: { data: parsed.data, mimeType: 'audio/pcm;rate=16000' },
      });
    } else if (parsed.type === 'call.end') {
      this.deps.logger.log(`call.end received from ${this.actor.userId}.`);
      void this.end('caller_ended');
    }
  }

  handleClose(): void {
    clearTimeout(this.startTimer);
    void this.end('disconnected');
  }

  private parse(raw: WebSocket.RawData): VoiceClientMessage | null {
    try {
      // `RawData` also covers `Buffer[]` (a fragmented message reassembled
      // as parts) -- flatten before decoding so this never falls back to
      // `Object.prototype.toString`.
      const text = Buffer.isBuffer(raw)
        ? raw.toString('utf-8')
        : Array.isArray(raw)
          ? Buffer.concat(raw).toString('utf-8')
          : Buffer.from(raw).toString('utf-8');
      const json: unknown = JSON.parse(text);
      const result = voiceClientMessageSchema.safeParse(json);
      return result.success ? result.data : null;
    } catch {
      return null;
    }
  }

  private send(message: VoiceServerMessage): void {
    if (this.client.readyState === this.client.OPEN) {
      this.client.send(JSON.stringify(message));
    }
  }

  private close(): void {
    if (this.client.readyState === this.client.OPEN) {
      this.client.close();
    }
  }

  private async connect(handle?: string): Promise<Session> {
    return this.deps.ai.live.connect({
      model: this.deps.model,
      config: {
        responseModalities: [Modality.AUDIO],
        systemInstruction: SYSTEM_INSTRUCTION,
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        // Without this, an audio-only session caps out at ~15 minutes.
        contextWindowCompression: { slidingWindow: {} },
        // Requests periodic `sessionResumptionUpdate`s so a GoAway can be
        // followed by a resumed session rather than a dropped call.
        sessionResumption: handle ? { handle } : {},
        // `googleSearch` alongside `functionDeclarations` is documented as
        // supported, but in practice hangs the connect() call forever on
        // `gemini-3.1-flash-live-preview` -- reverted until that's fixed
        // upstream or this moves off the preview model.
        tools: [
          {
            functionDeclarations: [
              ...buildFunctionDeclarations(this.deps.registry),
              END_CALL_FUNCTION_DECLARATION,
            ],
          },
        ],
      },
      callbacks: {
        onmessage: (message) => {
          void this.onGeminiMessage(message);
        },
        onerror: (event) => {
          this.deps.logger.warn(
            `Gemini Live error for ${this.actor.userId}: ${String(event?.error ?? event)}`,
          );
        },
        // A close mid-call that we did not request reads as the connection
        // reset every Live session eventually gets; the graceful version of
        // the same event is `goAway`, handled in `onGeminiMessage` below.
        onclose: () => undefined,
      },
    });
  }

  private async start(linkedSessionId: string | undefined): Promise<void> {
    activeCalls.add(this.actor.userId);
    this.linkedSessionId = linkedSessionId ?? null;
    this.durationTimer = setTimeout(
      () => void this.end('duration_limit'),
      this.deps.maxCallMinutes * 60_000,
    );

    this.deps.logger.log(
      `Opening Gemini Live session for ${this.actor.userId} (model=${this.deps.model}).`,
    );
    try {
      this.session = await this.connect();
    } catch (error) {
      this.deps.logger.warn(
        `Could not open Gemini Live session for ${this.actor.userId}: ${String(error)}`,
      );
      activeCalls.delete(this.actor.userId);
      clearTimeout(this.durationTimer);
      this.send({
        type: 'call.error',
        code: 'upstream_unavailable',
        message: 'Could not reach the voice service. Try again shortly.',
      });
      this.close();
      return;
    }

    const callId = this.startedAt.getTime().toString(36);
    this.deps.logger.log(
      `Gemini Live session open for ${this.actor.userId} (callId=${callId}).`,
    );
    this.send({ type: 'call.ready', callId });
  }

  private async onGeminiMessage(message: LiveServerMessage): Promise<void> {
    if (this.ended) {
      return;
    }

    // A catch-all summary of every message Gemini sends, so a silent call
    // (no audio, no transcript) can be told apart from Gemini sending
    // nothing at all versus sending something this handler doesn't act on.
    this.deps.logger.debug(
      `Gemini message for ${this.actor.userId}: ${JSON.stringify({
        hasData: Boolean(message.data),
        dataLength: message.data?.length ?? 0,
        turnComplete: message.serverContent?.turnComplete ?? false,
        interrupted: message.serverContent?.interrupted ?? false,
        inputTranscription: message.serverContent?.inputTranscription?.text,
        outputTranscription: message.serverContent?.outputTranscription?.text,
        modelTurnParts: message.serverContent?.modelTurn?.parts?.length ?? 0,
        toolCall: message.toolCall?.functionCalls?.length ?? 0,
        goAway: Boolean(message.goAway),
        sessionResumptionUpdate: Boolean(message.sessionResumptionUpdate),
      })}`,
    );

    const { serverContent } = message;
    if (serverContent?.interrupted) {
      this.send({ type: 'interrupted' });
    }

    // `message.data` is the concatenation of any inline audio parts in this
    // update, base64-encoded 24kHz PCM -- exactly what mobile plays back.
    if (message.data) {
      this.send({ type: 'audio', data: message.data });
    }

    if (serverContent?.inputTranscription?.text) {
      this.inputBuffer += serverContent.inputTranscription.text;
      const final = Boolean(serverContent.inputTranscription.finished);
      this.send({
        type: 'transcript',
        role: 'user',
        text: this.inputBuffer,
        final,
      });
      if (final) {
        this.turns.push({
          role: 'user',
          text: this.inputBuffer,
          at: new Date(),
        });
        this.inputBuffer = '';
      }
    }

    const modelText =
      serverContent?.outputTranscription?.text ??
      serverContent?.modelTurn?.parts
        ?.map((part) => ('text' in part ? part.text : ''))
        .filter(Boolean)
        .join('');

    if (modelText) {
      this.outputBuffer += modelText;
      const final = Boolean(
        serverContent?.outputTranscription?.finished ||
        serverContent?.turnComplete,
      );
      this.send({
        type: 'transcript',
        role: 'assistant',
        text: this.outputBuffer,
        final,
      });
      if (final) {
        this.turns.push({
          role: 'assistant',
          text: this.outputBuffer,
          at: new Date(),
        });
        this.outputBuffer = '';
      }
    } else if (serverContent?.turnComplete && this.outputBuffer) {
      this.send({
        type: 'transcript',
        role: 'assistant',
        text: this.outputBuffer,
        final: true,
      });
      this.turns.push({
        role: 'assistant',
        text: this.outputBuffer,
        at: new Date(),
      });
      this.outputBuffer = '';
    }

    const calls = message.toolCall?.functionCalls;
    if (calls?.length) {
      const names = calls.map((call) => call.name).join(', ');
      this.deps.logger.log(
        `Gemini requested tool call(s) for ${this.actor.userId}: ${names}.`,
      );

      const endCallRequests = calls.filter((call) => call.name === END_CALL_TOOL_NAME);
      const capabilityCalls = calls.filter((call) => call.name !== END_CALL_TOOL_NAME);

      const responses = capabilityCalls.length
        ? await handleFunctionCalls(this.deps.registry, this.actor, capabilityCalls)
        : [];
      for (const call of endCallRequests) {
        responses.push({ id: call.id, name: call.name, response: { output: { ok: true } } });
      }
      if (responses.length) {
        this.session?.sendToolResponse({ functionResponses: responses });
      }

      if (endCallRequests.length && !this.endRequested) {
        this.endRequested = true;
        this.deps.logger.log(
          `Assistant asked to end the call for ${this.actor.userId}; hanging up after its closing turn.`,
        );
        // Fallback in case `turnComplete` never arrives to confirm the
        // goodbye actually finished streaming -- `end()` is idempotent, so
        // this is a no-op if the call already ended by then.
        setTimeout(() => void this.end('assistant_ended'), END_CALL_GRACE_MS);
      }
    }

    if (this.endRequested && serverContent?.turnComplete) {
      void this.end('assistant_ended');
    }

    if (message.sessionResumptionUpdate?.newHandle) {
      this.resumeHandle = message.sessionResumptionUpdate.newHandle;
    }

    if (message.goAway) {
      this.deps.logger.log(
        `Gemini sent goAway for ${this.actor.userId}; reconnecting.`,
      );
      this.send({ type: 'reconnecting' });
      try {
        this.session = await this.connect(this.resumeHandle);
        this.deps.logger.log(
          `Voice reconnect succeeded for ${this.actor.userId}.`,
        );
        this.send({ type: 'reconnected' });
      } catch (error) {
        this.deps.logger.warn(
          `Voice reconnect failed for ${this.actor.userId}: ${String(error)}`,
        );
        void this.end('reconnect_failed');
      }
    }
  }

  private async end(reason: string): Promise<void> {
    if (this.ended) {
      return;
    }
    this.deps.logger.log(
      `Ending call for ${this.actor.userId} (reason=${reason}, turns=${this.turns.length}).`,
    );
    this.ended = true;
    clearTimeout(this.durationTimer);
    clearTimeout(this.startTimer);
    if (this.started) {
      activeCalls.delete(this.actor.userId);
    }
    this.session?.close();

    // A call can end mid-utterance; flush whatever transcript was in flight
    // rather than silently dropping the last thing either side said.
    if (this.inputBuffer) {
      this.turns.push({ role: 'user', text: this.inputBuffer, at: new Date() });
    }
    if (this.outputBuffer) {
      this.turns.push({
        role: 'assistant',
        text: this.outputBuffer,
        at: new Date(),
      });
    }

    if (this.started) {
      await this.deps.logs
        .record(this.actor, {
          linkedSessionId: this.linkedSessionId,
          model: this.deps.model,
          startedAt: this.startedAt,
          endedAt: new Date(),
          endReason: reason,
          turns: this.turns,
        })
        .catch((error) => {
          this.deps.logger.warn(
            `Could not save voice call log for ${this.actor.userId}: ${String(error)}`,
          );
        });
      this.send({ type: 'call.ended', reason });
    }
    this.close();
  }
}

/**
 * Real-time voice calling.
 *
 * Mobile opens a WebSocket here; this is the only thing in the system that
 * holds a Gemini API key or talks to Google at all. One `ActiveVoiceCall`
 * per connection does the actual relaying -- this service is the admission
 * check (configured? already on a call? within the hourly cap?) and the
 * factory for it.
 */
@Injectable()
export class VoiceCallService implements OnModuleInit {
  private readonly logger = new Logger(VoiceCallService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly registry: CapabilityRegistry,
    private readonly limiter: VoiceCallLimiter,
    private readonly logs: VoiceCallLogService,
  ) {}

  get isConfigured(): boolean {
    return Boolean(this.apiKey());
  }

  get modelName(): string {
    // A preview model; the id shifts as Google's Live API matures, hence the
    // env var rather than a literal used anywhere else in this module.
    return (
      this.config.get<string>('GEMINI_LIVE_MODEL') ??
      'gemini-3.1-flash-live-preview'
    );
  }

  get callsPerHour(): number {
    return this.number('VOICE_CALLS_PER_HOUR', 10);
  }

  get maxCallMinutes(): number {
    return this.number('VOICE_CALL_MAX_MINUTES', 20);
  }

  private apiKey(): string | undefined {
    return this.config.get<string>('GEMINI_API_KEY') || undefined;
  }

  private number(key: string, fallback: number): number {
    const value = Number(this.config.get<string>(key));
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }

  /** Say at startup whether the voice feature will actually work. */
  onModuleInit(): void {
    if (!this.isConfigured) {
      this.logger.warn(
        'GEMINI_API_KEY is not set -- voice calling will refuse to start.',
      );
    } else {
      this.logger.log(
        `Voice calling configured (model=${this.modelName}, maxCallMinutes=${this.maxCallMinutes}, callsPerHour=${this.callsPerHour}).`,
      );
    }
  }

  /**
   * Wire a freshly-authenticated WebSocket into a voice call.
   *
   * `buffered` is whatever the gateway caught while it was off verifying the
   * token -- replayed below, in order, once this is the thing listening.
   */
  handleConnection(
    client: WebSocket,
    actor: Actor,
    buffered: WebSocket.RawData[] = [],
  ): void {
    if (!this.isConfigured) {
      this.logger.warn(
        `Rejected voice call for ${actor.userId}: server not configured (GEMINI_API_KEY missing).`,
      );
      this.reject(
        client,
        'not_configured',
        'Voice calling is not configured on this server.',
      );
      return;
    }
    if (activeCalls.has(actor.userId)) {
      this.logger.warn(
        `Rejected voice call for ${actor.userId}: call already in progress.`,
      );
      this.reject(
        client,
        'call_in_progress',
        'You already have a call in progress.',
      );
      return;
    }
    const quota = this.limiter.take(actor.userId);
    if (!quota.allowed) {
      this.logger.warn(
        `Rejected voice call for ${actor.userId}: rate limited (retry in ${quota.retryInMinutes}m).`,
      );
      this.reject(
        client,
        'rate_limited',
        `You have called a lot in the past hour. Try again in about ${quota.retryInMinutes} minute${quota.retryInMinutes === 1 ? '' : 's'}.`,
      );
      return;
    }

    this.logger.log(`Admitted voice call for ${actor.userId}.`);
    const call = new ActiveVoiceCall(client, actor, {
      ai: new GoogleGenAI({ apiKey: this.apiKey() }),
      model: this.modelName,
      maxCallMinutes: this.maxCallMinutes,
      registry: this.registry,
      logs: this.logs,
      logger: this.logger,
    });

    client.on('message', (raw: WebSocket.RawData) => call.handleMessage(raw));
    client.on('close', () => call.handleClose());

    if (buffered.length) {
      this.logger.log(
        `Replaying ${buffered.length} frame(s) buffered for ${actor.userId} during auth.`,
      );
      for (const raw of buffered) {
        call.handleMessage(raw);
      }
    }
  }

  private reject(client: WebSocket, code: string, message: string): void {
    const payload: VoiceServerMessage = { type: 'call.error', code, message };
    if (client.readyState === client.OPEN) {
      client.send(JSON.stringify(payload));
      client.close();
    }
  }
}
