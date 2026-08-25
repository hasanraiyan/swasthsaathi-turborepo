import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import type { Actor } from '@repo/contracts';
import type { Request } from 'express';

/**
 * The authenticated user, as the `Actor` every capability takes.
 *
 * Controllers read it from the request and pass it in explicitly rather than
 * services reaching for request context. That is what keeps a service
 * callable from a job or an agent tool, where there is no request at all.
 */
export const CurrentActor = createParamDecorator(
  (_data: unknown, context: ExecutionContext): Actor => {
    const request = context.switchToHttp().getRequest<Request>();
    if (!request.auth) {
      // ClerkAuthGuard runs first and rejects unauthenticated requests, so
      // reaching here means a route was annotated without the guard.
      throw new Error('CurrentActor used on a route without ClerkAuthGuard');
    }
    return { userId: request.auth.userId, sessionId: request.auth.sessionId };
  },
);
