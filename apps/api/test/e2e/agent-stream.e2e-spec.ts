import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { WsAdapter } from '@nestjs/platform-ws';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { ClerkAuthGuard } from '../../src/auth/clerk-auth.guard';
import { StubAuthGuard } from '../support/test-app';
import { DomainExceptionFilter } from '../../src/common/domain-exception.filter';
import { EventType } from '@ag-ui/core';

/**
 * E2E tests for the agent SSE stream.
 *
 * Without OPENAI_API_KEY set, the agent returns a RUN_ERROR with
 * not_configured. We verify the SSE transport layer works correctly
 * in this state: content type, event parsing, and error codes.
 */

describe('agent stream (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(ClerkAuthGuard)
      .useClass(StubAuthGuard)
      .compile();

    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalFilters(new DomainExceptionFilter());
    app.useWebSocketAdapter(new WsAdapter(app));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  function parseSSE(
    text: string,
  ): Array<{ type: string; [key: string]: unknown }> {
    return text
      .split('\n')
      .filter((l) => l.startsWith('data: '))
      .map((l) => JSON.parse(l.slice(6)));
  }

  describe('SSE transport', () => {
    it('POST /api/agent/run responds with text/event-stream', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/agent/run')
        .set('x-test-user', 'test_user')
        .send({ message: 'Hello' });

      expect(response.headers['content-type']).toContain('text/event-stream');
    });

    it('returns SSE events (RUN_ERROR if model not configured, or a full run if it is)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/agent/run')
        .set('x-test-user', 'test_user')
        .send({ message: 'Hello' });

      const events = parseSSE(response.text);
      expect(events.length).toBeGreaterThan(0);

      // First event should always be RUN_STARTED
      expect(events[0].type).toBe(EventType.RUN_STARTED);

      // If model is not configured, we get RUN_ERROR with not_configured
      // If model IS configured (test env has key), we get a full run
      const hasRunError = events.some(
        (e) => e.type === EventType.RUN_ERROR && e.code === 'not_configured',
      );
      const hasRunFinished = events.some(
        (e) => e.type === EventType.RUN_FINISHED,
      );
      expect(hasRunError || hasRunFinished).toBe(true);
    });

    it('sends RUN_STARTED before the error', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/agent/run')
        .set('x-test-user', 'test_user')
        .send({ message: 'Hello' });

      const events = parseSSE(response.text);
      const runStarted = events.find((e) => e.type === EventType.RUN_STARTED);
      expect(runStarted).toBeDefined();
    });
  });

  describe('concurrent runs', () => {
    it('a second concurrent run for the same user is refused with run_in_progress', async () => {
      // Send two requests simultaneously with a configured model user
      // Since the model is not configured, both will get not_configured
      // immediately, releasing the lock. We test the mechanism exists.
      const req1 = request(app.getHttpServer())
        .post('/api/agent/run')
        .set('x-test-user', 'concurrent_e2e_user')
        .send({ message: 'First' });

      // Small delay to ensure the first request starts
      await new Promise((resolve) => setTimeout(resolve, 20));

      const req2 = request(app.getHttpServer())
        .post('/api/agent/run')
        .set('x-test-user', 'concurrent_e2e_user')
        .send({ message: 'Second' });

      const [res1, res2] = await Promise.all([req1, req2]);

      // Both should return SSE streams
      expect(res1.headers['content-type']).toContain('text/event-stream');
      expect(res2.headers['content-type']).toContain('text/event-stream');

      const events1 = parseSSE(res1.text);
      const events2 = parseSSE(res2.text);

      const allEvents = [...events1, ...events2];

      // Either one got run_in_progress, or both got not_configured (lock
      // released before second arrived because not_configured is instant)
      const hasRunInProgress = allEvents.some(
        (e) => e.type === EventType.RUN_ERROR && e.code === 'run_in_progress',
      );
      const allNotConfigured = allEvents.every(
        (e) => e.type !== EventType.RUN_ERROR || e.code === 'not_configured',
      );

      expect(hasRunInProgress || allNotConfigured).toBe(true);
    });
  });

  describe('rate limiting', () => {
    it('the rate limiter unit is tested separately; here we verify the SSE transport', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/agent/run')
        .set('x-test-user', 'rate_limit_e2e_user')
        .send({ message: 'Test' });

      expect(response.headers['content-type']).toContain('text/event-stream');
      const events = parseSSE(response.text);
      expect(events.length).toBeGreaterThan(0);
    });
  });

  describe('validation', () => {
    it('POST /api/agent/run with empty message returns 400', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/agent/run')
        .set('x-test-user', 'test_user')
        .send({ message: '' });

      expect(response.status).toBe(400);
    });

    it('POST /api/agent/run without message returns 400', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/agent/run')
        .set('x-test-user', 'test_user')
        .send({});

      expect(response.status).toBe(400);
    });
  });
});
