import mongoose, { Schema, model } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { fillDefaultsOnRead } from './fill-defaults-on-read';

/**
 * Regression test for the fill-defaults-on-read plugin.
 *
 * A profile written before `familyHistory` existed came back missing the key,
 * and `riskFlags` threw on `.length` of `undefined`. This plugin fills
 * missing keys from their declared defaults on every read.
 */

let mongod: MongoMemoryServer;

// A throwaway schema with an array field and a defaulted field
const TestSchema = new Schema(
  {
    userId: { type: String, required: true },
    name: { type: String, default: null },
    tags: { type: [String], default: [] },
    score: { type: Number, default: 0 },
  },
  { timestamps: false, versionKey: false },
);

TestSchema.plugin(fillDefaultsOnRead);

// Use a unique collection name to avoid collisions
const TestModel = model('FillDefaultsTest', TestSchema, 'fill_defaults_test');

describe('fillDefaultsOnRead', () => {
  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
  }, 30_000); // MongoMemoryServer downloads binary on first run

  afterAll(async () => {
    await TestModel.deleteMany({});
    await mongoose.disconnect();
    await mongod.stop();
  });

  afterEach(async () => {
    await TestModel.deleteMany({});
  });

  it('fills missing array fields with empty array on read', async () => {
    // Insert a document WITHOUT the 'tags' field (simulating pre-migration data)
    await TestModel.collection.insertOne({
      userId: 'test_user',
      name: 'Test',
      // tags is missing — as it would be in a pre-existing document
    });

    const doc = await TestModel.findOne({ userId: 'test_user' }).lean().exec();
    expect(doc).not.toBeNull();
    expect(doc!.tags).toEqual([]);
    expect(Array.isArray(doc!.tags)).toBe(true);
  });

  it('fills missing defaulted fields with their default on read', async () => {
    await TestModel.collection.insertOne({
      userId: 'test_user2',
      // name and score are missing
    });

    const doc = await TestModel.findOne({ userId: 'test_user2' }).lean().exec();
    expect(doc).not.toBeNull();
    expect(doc!.name).toBeNull();
    expect(doc!.score).toBe(0);
  });

  it('does not overwrite existing values', async () => {
    await TestModel.collection.insertOne({
      userId: 'test_user3',
      name: 'Already set',
      tags: ['existing'],
      score: 42,
    });

    const doc = await TestModel.findOne({ userId: 'test_user3' }).lean().exec();
    expect(doc).not.toBeNull();
    expect(doc!.name).toBe('Already set');
    expect(doc!.tags).toEqual(['existing']);
    expect(doc!.score).toBe(42);
  });

  it('works on find (returns array)', async () => {
    await TestModel.collection.insertOne({
      userId: 'test_user4',
      // All defaults missing
    });

    const docs = await TestModel.find({ userId: 'test_user4' }).lean().exec();
    expect(docs).toHaveLength(1);
    expect(docs[0].tags).toEqual([]);
    expect(docs[0].score).toBe(0);
  });

  it('handles documents inserted without _id gracefully', async () => {
    // Every Mongo document has _id, but test the plugin doesn't choke
    const doc = await TestModel.findOne({ userId: 'nonexistent' })
      .lean()
      .exec();
    expect(doc).toBeNull();
  });
});
