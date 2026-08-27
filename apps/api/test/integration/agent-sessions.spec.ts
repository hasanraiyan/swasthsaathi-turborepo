import type { Actor } from '@repo/contracts';
import { buildTestApp, ALICE, BOB, type TestApp } from '../support/test-app';
import { CapabilityRegistry } from '../../src/capabilities/capability-registry.service';
import { Connection } from 'mongoose';
import { NotFoundError } from '../../src/common/errors';

/**
 * Integration tests for agent sessions.
 *
 * Sessions are not exposed as capabilities — they are managed through
 * dedicated REST routes. We test through the SessionService directly.
 */

describe('agent sessions', () => {
  let testApp: TestApp;
  let registry: CapabilityRegistry;
  let connection: Connection;

  // We need SessionService directly since sessions aren't capabilities

  let sessionService: any;

  beforeAll(async () => {
    testApp = await buildTestApp();
    registry = testApp.registry;
    connection = testApp.connection;
    // Get SessionService from the NestJS container
    sessionService = testApp.module.get(
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('../../src/modules/agent/sessions/session.service')
        .SessionService,
    );
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  beforeEach(async () => {
    await connection.db!.dropDatabase();
  });

  describe('CRUD', () => {
    it('creating a session and listing shows it at the top', async () => {
      const session = await sessionService.create(ALICE, {});
      expect(session).toHaveProperty('id');
      expect(session.title).toBe('New chat');

      const list = await sessionService.list(ALICE, { limit: 50, offset: 0 });
      expect(list.items.length).toBe(1);
      expect(list.items[0].id).toBe(session.id);
    });

    it('creating with a custom title', async () => {
      const session = await sessionService.create(ALICE, {
        title: 'My custom title',
      });
      expect(session.title).toBe('My custom title');
    });
  });

  describe('ownership', () => {
    it("bob cannot read, retitle or delete alice's session", async () => {
      const session = await sessionService.create(ALICE, {});

      await expect(sessionService.get(BOB, { id: session.id })).rejects.toThrow(
        NotFoundError,
      );

      await expect(
        sessionService.updateTitle(BOB, { id: session.id, title: 'Hacked' }),
      ).rejects.toThrow(NotFoundError);

      await expect(
        sessionService.remove(BOB, { id: session.id }),
      ).rejects.toThrow(NotFoundError);
    });

    it("missing session and someone else's session return the same error", async () => {
      const session = await sessionService.create(ALICE, {});
      const fakeId = '000000000000000000000000';

      let missingError: Error | null = null;
      let wrongOwnerError: Error | null = null;

      try {
        await sessionService.get(BOB, { id: fakeId });
      } catch (e) {
        missingError = e as Error;
      }

      try {
        await sessionService.get(BOB, { id: session.id });
      } catch (e) {
        wrongOwnerError = e as Error;
      }

      expect(missingError).not.toBeNull();
      expect(wrongOwnerError).not.toBeNull();
      expect(missingError!.name).toBe(wrongOwnerError!.name);
    });
  });

  describe('clear', () => {
    it('clearing all sessions deletes them', async () => {
      await sessionService.create(ALICE, {});
      await sessionService.create(ALICE, {});

      const before = await sessionService.list(ALICE, {
        limit: 50,
        offset: 0,
      });
      expect(before.items.length).toBe(2);

      const result = await sessionService.clear(ALICE);
      expect(result.deleted).toBe(2);

      const after = await sessionService.list(ALICE, {
        limit: 50,
        offset: 0,
      });
      expect(after.items.length).toBe(0);
    });
  });

  describe('retitleIfUntouched', () => {
    it('renames only if the title is still the default', async () => {
      const session = await sessionService.create(ALICE, {});

      // Should rename because it's still "New chat"
      const renamed = await sessionService.retitleIfUntouched(
        ALICE,
        session.id,
        'Auto-generated title',
      );
      expect(renamed).toBe(true);

      const updated = await sessionService.get(ALICE, { id: session.id });
      expect(updated.title).toBe('Auto-generated title');

      // Should NOT rename because it's no longer the default
      const notRenamed = await sessionService.retitleIfUntouched(
        ALICE,
        session.id,
        'Second attempt',
      );
      expect(notRenamed).toBe(false);

      const still = await sessionService.get(ALICE, { id: session.id });
      expect(still.title).toBe('Auto-generated title');
    });

    it('does not overwrite a user-set title', async () => {
      const session = await sessionService.create(ALICE, {
        title: 'User chose this',
      });

      const renamed = await sessionService.retitleIfUntouched(
        ALICE,
        session.id,
        'Auto-generated',
      );
      expect(renamed).toBe(false);

      const still = await sessionService.get(ALICE, { id: session.id });
      expect(still.title).toBe('User chose this');
    });
  });
});
