import { RunLimiter } from './run-limiter.service';

/**
 * Unit tests for the agent run limiter.
 *
 * Deliberately in-memory: it holds one timestamp array per active user and
 * needs no store. We test with a low limit and injected time.
 */

function createLimiter(perHour = 3): RunLimiter {
  // Create a minimal mock of ConfigService
  const config = {
    get: (key: string) => {
      if (key === 'AGENT_RUNS_PER_HOUR') return String(perHour);
      return undefined;
    },
  } as Parameters<
    (typeof RunLimiter)['prototype']['take'] extends (userId: string) => infer _
      ? never
      : never
  >;

  return new RunLimiter(config);
}

describe('RunLimiter', () => {
  describe('rate limiting', () => {
    it('allows up to the limit', () => {
      const limiter = createLimiter(3);
      expect(limiter.take('user1')).toEqual({ allowed: true });
      expect(limiter.take('user1')).toEqual({ allowed: true });
      expect(limiter.take('user1')).toEqual({ allowed: true });
    });

    it('refuses the next request after the limit', () => {
      const limiter = createLimiter(2);
      limiter.take('user1');
      limiter.take('user1');
      const result = limiter.take('user1');
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.retryInMinutes).toBeGreaterThanOrEqual(1);
      }
    });

    it('retryInMinutes is at least 1 and never negative', () => {
      const limiter = createLimiter(1);
      limiter.take('user1');
      const result = limiter.take('user1');
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.retryInMinutes).toBeGreaterThanOrEqual(1);
      }
    });
  });

  describe('window expiry', () => {
    it('entries older than the window stop counting', () => {
      const limiter = createLimiter(2);

      // Mock Date.now to control time
      const originalNow = Date.now;
      let currentTime = 1000000000000; // Some base time
      Date.now = () => currentTime;

      limiter.take('user1');
      limiter.take('user1');
      // At limit
      expect(limiter.take('user1').allowed).toBe(false);

      // Advance time by just over an hour
      currentTime += 3_601_000;

      // Old entries should have expired
      expect(limiter.take('user1')).toEqual({ allowed: true });

      Date.now = originalNow;
    });
  });

  describe('per-user isolation', () => {
    it('two users do not share a window', () => {
      const limiter = createLimiter(2);
      limiter.take('user1');
      limiter.take('user1');
      // user1 is at limit
      expect(limiter.take('user1').allowed).toBe(false);
      // user2 still has room
      expect(limiter.take('user2')).toEqual({ allowed: true });
    });
  });
});
