import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * A ceiling on how many calls one person can start.
 *
 * Structurally the same idea as `agent/run-limiter.service.ts`, kept as its
 * own class rather than reused: a voice call costs far more per unit time
 * than a chat turn (continuous audio tokens for as long as it's open, not
 * one request), so it gets its own, lower default and its own env var rather
 * than sharing a budget with text chat.
 *
 * Deliberately in memory, same single-process caveat as the text limiter.
 */
@Injectable()
export class VoiceCallLimiter {
  private readonly windows = new Map<string, number[]>();

  constructor(private readonly config: ConfigService) {}

  private get perHour(): number {
    const configured = Number(this.config.get<string>('VOICE_CALLS_PER_HOUR'));
    return Number.isFinite(configured) && configured > 0 ? configured : 10;
  }

  take(
    userId: string,
  ): { allowed: true } | { allowed: false; retryInMinutes: number } {
    const now = Date.now();
    const hourAgo = now - 3_600_000;

    const recent = (this.windows.get(userId) ?? []).filter(
      (at) => at > hourAgo,
    );

    if (recent.length >= this.perHour) {
      const oldest = recent[0];
      this.windows.set(userId, recent);
      return {
        allowed: false,
        retryInMinutes: Math.max(
          1,
          Math.ceil((oldest + 3_600_000 - now) / 60_000),
        ),
      };
    }

    recent.push(now);
    this.windows.set(userId, recent);

    if (this.windows.size > 5_000) {
      this.evictIdle(hourAgo);
    }

    return { allowed: true };
  }

  private evictIdle(hourAgo: number): void {
    for (const [userId, timestamps] of this.windows) {
      if (timestamps.every((at) => at <= hourAgo)) {
        this.windows.delete(userId);
      }
    }
  }
}
