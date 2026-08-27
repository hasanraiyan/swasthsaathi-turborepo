import { CanActivate, ExecutionContext } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { WsAdapter } from '@nestjs/platform-ws';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Connection } from 'mongoose';
import { getConnectionToken } from '@nestjs/mongoose';
import type { Actor } from '@repo/contracts';

import { AppModule } from '../../src/app.module';
import { ClerkAuthGuard } from '../../src/auth/clerk-auth.guard';
import { CapabilityRegistry } from '../../src/capabilities/capability-registry.service';
import { DomainExceptionFilter } from '../../src/common/domain-exception.filter';

// ---------------------------------------------------------------------------
// Actors
// ---------------------------------------------------------------------------

export const ALICE: Actor = { userId: 'test_alice' };
export const BOB: Actor = { userId: 'test_bob' };

// ---------------------------------------------------------------------------
// Stub auth guard — reads x-test-user header instead of Clerk
// ---------------------------------------------------------------------------

export class StubAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    request.auth = {
      userId: request.headers['x-test-user'] ?? 'user_anonymous',
    };
    return true;
  }
}

// ---------------------------------------------------------------------------
// In-memory MongoDB singleton (one per Jest worker / process)
// ---------------------------------------------------------------------------

let mongod: MongoMemoryServer | null = null;

async function getMongoUri(): Promise<string> {
  if (!mongod) {
    mongod = await MongoMemoryServer.create();
  }
  return mongod.getUri();
}

// ---------------------------------------------------------------------------
// Test app builder
// ---------------------------------------------------------------------------

export interface TestApp {
  module: TestingModule;
  app: INestApplication;
  registry: CapabilityRegistry;
  connection: Connection;
}

export async function buildTestApp(): Promise<TestApp> {
  const uri = await getMongoUri();
  // Set before AppModule's DatabaseModule reads it via ConfigService
  process.env.MONGODB_URI = uri;

  const module = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideGuard(ClerkAuthGuard)
    .useClass(StubAuthGuard)
    .compile();

  const app = module.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalFilters(new DomainExceptionFilter());
  // Matches main.ts: without this, Nest falls back to its default
  // WebSocket driver (Socket.io) for VoiceGateway, which isn't installed.
  app.useWebSocketAdapter(new WsAdapter(app));
  await app.init();

  return {
    module,
    app,
    registry: module.get(CapabilityRegistry),
    connection: module.get<Connection>(getConnectionToken()),
  };
}
