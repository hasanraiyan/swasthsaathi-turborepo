import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { WsAdapter } from '@nestjs/platform-ws';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { buildTestApp, type TestApp } from '../support/test-app';
import { DomainExceptionFilter } from '../../src/common/domain-exception.filter';

/**
 * E2E test: guarded routes require auth, the health check does not.
 */

describe('auth (e2e)', () => {
  let testApp: TestApp;
  let app: INestApplication;

  beforeAll(async () => {
    testApp = await buildTestApp();
    app = testApp.app;
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api returns 200 (health check, no guard)', async () => {
    const response = await request(app.getHttpServer()).get('/api');
    expect(response.status).toBe(200);
  });

  it('GET /api/conditions returns 200 with x-test-user header (StubAuthGuard)', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/conditions')
      .set('x-test-user', 'test_e2e_user');
    expect(response.status).toBe(200);
  });

  it('GET /api/me returns the actor with x-test-user header', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/me')
      .set('x-test-user', 'test_e2e_user');
    expect(response.status).toBe(200);
    expect(response.body.userId).toBe('test_e2e_user');
  });
});

describe('real ClerkAuthGuard (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalFilters(new DomainExceptionFilter());
    app.useWebSocketAdapter(new WsAdapter(app));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('guarded routes return 401 when ClerkAuthGuard is active and no token', async () => {
    const response = await request(app.getHttpServer()).get('/api/me');
    expect(response.status).toBe(401);
  });

  it('conditions endpoint returns 401 without token', async () => {
    const response = await request(app.getHttpServer()).get('/api/conditions');
    expect(response.status).toBe(401);
  });

  it('agent endpoint returns 401 without token', async () => {
    const response = await request(app.getHttpServer()).get('/api/agent');
    expect(response.status).toBe(401);
  });
});
