import { Logger } from '@nestjs/common';
import { verifyToken } from '@clerk/backend';

const logger = new Logger('VoiceAuth');

/**
 * Verify the Clerk token a mobile client sent when opening the voice
 * WebSocket, mirroring what `ClerkAuthGuard` checks for the plain HTTP
 * routes.
 *
 * There is no HTTP `ExecutionContext` at WS-upgrade time for a Nest guard to
 * run against, so this is called directly from the gateway's connection
 * handler instead, with the token read from a `token` query parameter --
 * Expo's WebSocket client cannot reliably set custom handshake headers, the
 * same constraint the mobile-side auth choice was made against.
 */
export async function verifyVoiceToken(
  token: string | undefined,
): Promise<{ userId: string } | null> {
  if (!token) {
    logger.warn('Voice socket connected with no token query param.');
    return null;
  }
  try {
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
    });
    logger.log(`Voice token verified for user ${payload.sub}.`);
    return { userId: payload.sub };
  } catch (error) {
    logger.warn(`Voice token verification failed: ${String(error)}`);
    return null;
  }
}
