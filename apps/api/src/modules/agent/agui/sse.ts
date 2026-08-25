import type { Response } from 'express';

import type { AguiEvent } from './events';

/**
 * Server-Sent Events for an AG-UI stream.
 *
 * One JSON object per `data:` frame with the event type inside it, which is
 * what AG-UI clients parse. No `event:` field: naming the SSE frame after the
 * type would make clients register a listener per event name, and the
 * protocol already carries it in the payload.
 */
export function openStream(response: Response): void {
  response.status(200);
  response.setHeader('Content-Type', 'text/event-stream');
  response.setHeader('Cache-Control', 'no-cache, no-transform');
  response.setHeader('Connection', 'keep-alive');
  // Nginx and friends will otherwise hold the whole stream until it ends.
  response.setHeader('X-Accel-Buffering', 'no');
  response.flushHeaders();
}

export function writeEvent(response: Response, event: AguiEvent): void {
  if (response.writableEnded) {
    return;
  }
  response.write(`data: ${JSON.stringify(event)}\n\n`);
}

export function closeStream(response: Response): void {
  if (!response.writableEnded) {
    response.end();
  }
}
