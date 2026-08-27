import { voiceServerMessageSchema } from '@repo/contracts';
import type { VoiceClientMessage, VoiceServerMessage } from '@repo/contracts';

import { resolveBaseUrl } from './api';

/** All voice-call logging goes through this tag so it's easy to filter in devtools. */
const TAG = '[voice]';

/**
 * The mobile side of the voice-call relay.
 *
 * A small custom JSON protocol (`@repo/contracts`'s `voice.ts`), deliberately
 * not Gemini's own wire format -- the API is the only thing that ever talks
 * to Google (see `apps/api/src/modules/voice/voice-call.service.ts`), so this
 * only needs to know about our own message shapes, not whichever vendor
 * answers the call.
 */

export type VoiceCallState =
  | 'connecting'
  | 'ready'
  | 'active'
  | 'reconnecting'
  | 'ended'
  | 'error';

interface VoiceCallHandlers {
  onMessage: (message: VoiceServerMessage) => void;
  onStateChange: (state: VoiceCallState) => void;
}

const MAX_RECONNECT_ATTEMPTS = 3;
const RECONNECT_BASE_DELAY_MS = 1_000;

export class VoiceCallClient {
  private socket: WebSocket | null = null;
  private sequence = 0;
  private state: VoiceCallState = 'connecting';
  private closedByUs = false;
  private reconnectAttempt = 0;
  private lastSessionId: string | undefined;
  private getToken: (() => Promise<string | null>) | null = null;
  private audioFramesReceived = 0;

  constructor(private readonly handlers: VoiceCallHandlers) {}

  async connect(
    getToken: () => Promise<string | null>,
    sessionId?: string,
  ): Promise<void> {
    this.getToken = getToken;
    this.lastSessionId = sessionId;
    this.closedByUs = false;
    await this.open();
  }

  private async open(): Promise<void> {
    this.setState(this.reconnectAttempt > 0 ? 'reconnecting' : 'connecting');

    const token = await this.getToken?.();
    const url = `${wsBaseUrl()}/voice${token ? `?token=${encodeURIComponent(token)}` : ''}`;
    console.log(
      `${TAG} opening socket (attempt ${this.reconnectAttempt}) -> ${url.replace(/token=[^&]+/, 'token=<redacted>')}`,
    );
    const socket = new WebSocket(url);
    this.socket = socket;

    socket.onopen = () => {
      console.log(`${TAG} socket open, sending call.start`);
      this.reconnectAttempt = 0;
      this.send({ type: 'call.start', sessionId: this.lastSessionId });
    };

    socket.onmessage = (event: MessageEvent) => {
      const parsed = this.parse(event.data);
      if (!parsed) {
        console.warn(`${TAG} could not parse server message`, event.data);
        return;
      }
      if (parsed.type === 'audio') {
        // Audio frames arrive many times a second -- logging every one would
        // drown out everything else, so just count them.
        this.audioFramesReceived += 1;
        if (this.audioFramesReceived % 10 === 1) {
          console.log(
            `${TAG} received ${this.audioFramesReceived} audio frame(s) from server so far (${parsed.data.length} b64 chars in latest)`,
          );
        }
      } else {
        console.log(`${TAG} received ${parsed.type}`, parsed);
      }
      if (parsed.type === 'call.ready') {
        this.setState('active');
      } else if (parsed.type === 'call.ended') {
        this.closedByUs = true;
        this.setState('ended');
      } else if (parsed.type === 'call.error') {
        this.closedByUs = true;
        this.setState('error');
      } else if (parsed.type === 'reconnecting') {
        // The API is swapping Gemini sessions after a GoAway -- distinct from
        // this client's own reconnect below, which is for a dropped socket
        // between here and the API.
        this.setState('reconnecting');
      } else if (parsed.type === 'reconnected') {
        this.setState('active');
      }
      this.handlers.onMessage(parsed);
    };

    socket.onerror = (event: Event) => {
      // `onclose` always follows `onerror` for a WebSocket, so the actual
      // state transition and any reconnect happens there.
      console.warn(`${TAG} socket error`, event);
    };

    socket.onclose = (event: CloseEvent) => {
      console.log(
        `${TAG} socket closed (code=${event.code}, reason=${event.reason || 'none'}, closedByUs=${this.closedByUs})`,
      );
      this.socket = null;
      if (this.closedByUs) {
        return;
      }
      if (this.reconnectAttempt >= MAX_RECONNECT_ATTEMPTS) {
        console.warn(`${TAG} giving up after ${this.reconnectAttempt} reconnect attempts`);
        this.setState('error');
        return;
      }
      this.reconnectAttempt += 1;
      const delay = RECONNECT_BASE_DELAY_MS * 2 ** (this.reconnectAttempt - 1);
      console.log(`${TAG} reconnecting in ${delay}ms (attempt ${this.reconnectAttempt})`);
      setTimeout(() => void this.open(), delay);
    };
  }

  sendAudioChunk(base64: string): void {
    this.sequence += 1;
    this.send({ type: 'audio', data: base64, sequence: this.sequence });
  }

  end(): void {
    console.log(`${TAG} ending call`);
    this.closedByUs = true;
    this.send({ type: 'call.end' });
  }

  /** Drop the connection without telling the server, e.g. the screen unmounted. */
  close(): void {
    this.closedByUs = true;
    this.socket?.close();
    this.socket = null;
  }

  private setState(state: VoiceCallState): void {
    console.log(`${TAG} state: ${this.state} -> ${state}`);
    this.state = state;
    this.handlers.onStateChange(state);
  }

  private send(message: VoiceClientMessage): void {
    if (this.socket?.readyState === this.socket?.OPEN) {
      this.socket?.send(JSON.stringify(message));
    } else {
      console.warn(`${TAG} dropped ${message.type} -- socket not open`);
    }
  }

  private parse(data: unknown): VoiceServerMessage | null {
    if (typeof data !== 'string') {
      return null;
    }
    try {
      const json: unknown = JSON.parse(data);
      const result = voiceServerMessageSchema.safeParse(json);
      if (!result.success) {
        console.warn(`${TAG} server message failed schema validation`, result.error, json);
      }
      return result.success ? result.data : null;
    } catch (error) {
      console.warn(`${TAG} server message was not valid JSON`, error);
      return null;
    }
  }
}

/**
 * `resolveBaseUrl()` returns e.g. `http://192.168.1.5:3000/api` for REST.
 * The voice gateway is its own path outside that prefix (`setGlobalPrefix`
 * only touches HTTP routing -- see `voice.gateway.ts`), so this strips `/api`
 * and swaps the scheme instead of reusing the REST base as-is.
 */
function wsBaseUrl(): string {
  return resolveBaseUrl()
    .replace(/\/api$/, '')
    .replace(/^http/, 'ws');
}
