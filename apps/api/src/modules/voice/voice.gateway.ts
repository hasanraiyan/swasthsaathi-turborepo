import { Logger } from '@nestjs/common';
import type { OnGatewayConnection } from '@nestjs/websockets';
import { WebSocketGateway } from '@nestjs/websockets';
import type { IncomingMessage } from 'node:http';
import type WebSocket from 'ws';

import { VoiceCallService } from './voice-call.service';
import { verifyVoiceToken } from './voice-auth';

/**
 * The WebSocket entry point for a voice call.
 *
 * Deliberately thin, the same way `AgentController` is a thin transport over
 * `AgentService`: this does the auth handshake a Nest guard cannot do at
 * WS-upgrade time (there is no HTTP `ExecutionContext` yet), then hands the
 * authenticated connection straight to `VoiceCallService`.
 *
 * `setGlobalPrefix('api')` in `main.ts` only affects HTTP/Express routing,
 * not a gateway's own path, so this is `/voice` rather than `/api/voice`.
 */
@WebSocketGateway({ path: '/voice' })
export class VoiceGateway implements OnGatewayConnection {
  private readonly logger = new Logger(VoiceGateway.name);

  constructor(private readonly calls: VoiceCallService) {}

  async handleConnection(
    client: WebSocket,
    request: IncomingMessage,
  ): Promise<void> {
    this.logger.log(`Voice socket connecting from ${request.socket.remoteAddress ?? 'unknown'}.`);
    const token = new URL(
      request.url ?? '',
      'http://voice.internal',
    ).searchParams.get('token');
    const identity = await verifyVoiceToken(token ?? undefined);
    if (!identity) {
      // 4401: a private application close code, mirroring the 401 an HTTP
      // request would get. There is no response body on a WS close, which is
      // exactly why the gateway checks this before `VoiceCallService` ever
      // gets a chance to send a JSON error frame.
      this.logger.warn('Voice socket rejected: unauthorized.');
      client.close(4401, 'unauthorized');
      return;
    }

    this.logger.log(`Voice socket authenticated for user ${identity.userId}.`);
    this.calls.handleConnection(client, { userId: identity.userId });
  }
}
