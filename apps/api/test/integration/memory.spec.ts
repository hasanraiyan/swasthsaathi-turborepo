import { buildTestApp, ALICE, BOB, type TestApp } from '../support/test-app';
import { CapabilityRegistry } from '../../src/capabilities/capability-registry.service';
import { Connection } from 'mongoose';
import { NotFoundError } from '../../src/common/errors';

/**
 * Integration tests for the memory domain.
 *
 * Memory is exposed as capabilities so the same three operations serve
 * the agent as tools, the REST API, and anything added later.
 */

describe('memory', () => {
  let testApp: TestApp;
  let registry: CapabilityRegistry;
  let connection: Connection;

  beforeAll(async () => {
    testApp = await buildTestApp();
    registry = testApp.registry;
    connection = testApp.connection;
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  beforeEach(async () => {
    await connection.db!.dropDatabase();
  });

  describe('write and read', () => {
    it('writing the same key twice replaces rather than duplicates', async () => {
      await registry.invoke('memory.write', ALICE, {
        key: 'preferences',
        content: 'First version',
      });

      await registry.invoke('memory.write', ALICE, {
        key: 'preferences',
        content: 'Second version',
      });

      const list = (await registry.invoke('memory.list', ALICE)) as {
        items: Array<{ key: string; content: string }>;
        total: number;
      };

      expect(list.items.length).toBe(1);
      expect(list.items[0].content).toBe('Second version');
      expect(list.total).toBe(1);
    });
  });

  describe('ownership', () => {
    it('memory written by alice is invisible to bob', async () => {
      await registry.invoke('memory.write', ALICE, {
        key: 'secret',
        content: "Alice's private note",
      });

      const bobList = (await registry.invoke('memory.list', BOB)) as {
        items: Array<{ key: string }>;
        total: number;
      };

      expect(bobList.items.length).toBe(0);
      expect(bobList.total).toBe(0);
    });
  });

  describe('delete', () => {
    it('deleting a key that does not exist is a NotFoundError', async () => {
      await expect(
        registry.invoke('memory.delete', ALICE, { key: 'nonexistent' }),
      ).rejects.toThrow(NotFoundError);
    });

    it('deleting an existing key succeeds', async () => {
      await registry.invoke('memory.write', ALICE, {
        key: 'temp',
        content: 'Temporary',
      });

      const result = (await registry.invoke('memory.delete', ALICE, {
        key: 'temp',
      })) as { deleted: boolean };

      expect(result.deleted).toBe(true);

      const list = (await registry.invoke('memory.list', ALICE)) as {
        items: Array<{ key: string }>;
      };

      expect(list.items.length).toBe(0);
    });
  });
});
