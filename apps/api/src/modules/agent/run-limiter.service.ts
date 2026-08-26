import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * A ceiling on how often one person can run the assistant.
 *
 * Each run can call tools, loop, and stream for a while, and every one of
 * them costs money at the model provider. Without a cap, a stuck client
 * retrying in a loop is an unbounded bill, and there is nothing else in this
 * API that spends on the user's behalf.
 *
 * Deliberately in memory: it holds one timestamp array per active user and
 * needs no store. The limit is therefore per process, so several instances
 * behind a load balancer would each allow the full quota -- fine while this
 * runs as one process, and the point at which that changes is the point to
 * move it to Redis.
 */
@Injectable()
export class RunLimiter {
  private readonly windows = new Map<string, number[]>();

  constructor(private readonly config: ConfigService) {}

  private get perHour(): number {
    const configured = Number(this.config.get<string>('AGENT_RUNS_PER_HOUR'));
    return Number.isFinite(configured) && configured > 0 ? configured : 30;
  }

  /**
   * Record a run and say whether it was allowed.
   *
   * Returns how long to wait when it was not, so the caller can say something
   * more useful than "no".
   */
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

    // Users who stopped talking an hour ago should not be held in memory.
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
