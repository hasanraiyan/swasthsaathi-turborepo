import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { ClerkAuthGuard } from '../../src/auth/clerk-auth.guard';
import { StubAuthGuard } from '../support/test-app';
import { DomainExceptionFilter } from '../../src/common/domain-exception.filter';

/**
 * E2E tests for validation: bad bodies, malformed ids, and the capabilities
 * endpoint returning valid JSON Schema.
 */

describe('validation (e2e)', () => {
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
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('bad input', () => {
    it('a bad body returns 400 with issues[] naming the offending path', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/conditions')
        .set('x-test-user', 'test_user')
        .send({ name: '' }); // name is required, min length 1

      expect(response.status).toBe(400);
      expect(response.body.issues).toBeDefined();
      expect(Array.isArray(response.body.issues)).toBe(true);
    });

    it('a malformed id returns 400, not 500', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/conditions/not-a-valid-id')
        .set('x-test-user', 'test_user');

      expect(response.status).toBe(400);
      expect(response.status).not.toBe(500);
    });

    it('a well-formed id that does not exist returns 404', async () => {
      const fakeId = '000000000000000000000000';
      const response = await request(app.getHttpServer())
        .get(`/api/conditions/${fakeId}`)
        .set('x-test-user', 'test_user');

      expect(response.status).toBe(404);
    });
  });

  describe('capabilities endpoint', () => {
    it('GET /api/capabilities returns valid JSON with capability definitions', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/capabilities')
        .set('x-test-user', 'test_user');

      expect(response.status).toBe(200);
      expect(response.body.capabilities).toBeDefined();
      expect(Array.isArray(response.body.capabilities)).toBe(true);
      expect(response.body.capabilities.length).toBeGreaterThan(0);
    });

    it('no two capabilities share a name', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/capabilities')
        .set('x-test-user', 'test_user');

      const names = response.body.capabilities.map((c: { name: string }) => c.name);
      const unique = new Set(names);
      expect(unique.size).toBe(names.length);
    });

    it('every capability has a name, description, kind, and inputSchema', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/capabilities')
        .set('x-test-user', 'test_user');

      for (const cap of response.body.capabilities) {
        expect(typeof cap.name).toBe('string');
        expect(typeof cap.description).toBe('string');
        expect(['read', 'write']).toContain(cap.kind);
        expect(cap.inputSchema).toBeDefined();
      }
    });
  });
});
