import { Types } from 'mongoose';
import { serialize, serializeAll } from './serialize';

describe('serialize', () => {
  it('converts _id to id as a hex string', () => {
    const id = new Types.ObjectId();
    const result = serialize<{ id: string }>({
      _id: id,
      name: 'test',
    });
    expect(result.id).toBe(id.toHexString());
    expect((result as Record<string, unknown>)._id).toBeUndefined();
  });

  it('converts nested ObjectIds', () => {
    const id = new Types.ObjectId();
    const nestedId = new Types.ObjectId();
    const result = serialize<{
      id: string;
      nested: { id: string };
    }>({
      _id: id,
      nested: { _id: nestedId, value: 42 },
    });
    expect(result.nested.id).toBe(nestedId.toHexString());
  });

  it('converts Date to ISO string', () => {
    const date = new Date('2026-06-15T10:30:00.000Z');
    const result = serialize<{ createdAt: string }>({
      _id: new Types.ObjectId(),
      createdAt: date,
    });
    expect(result.createdAt).toBe('2026-06-15T10:30:00.000Z');
  });

  it('drops __v', () => {
    const result = serialize<{ id: string }>({
      _id: new Types.ObjectId(),
      __v: 3,
    });
    expect((result as Record<string, unknown>).__v).toBeUndefined();
  });

  it('converts undefined to null', () => {
    const result = serialize<{ id: string; value: null }>({
      _id: new Types.ObjectId(),
      value: undefined,
    });
    expect(result.value).toBeNull();
  });

  it('converts an array of documents elementwise', () => {
    const id1 = new Types.ObjectId();
    const id2 = new Types.ObjectId();
    const result = serializeAll<{ id: string; name: string }>([
      { _id: id1, name: 'first' },
      { _id: id2, name: 'second' },
    ]);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe(id1.toHexString());
    expect(result[1].id).toBe(id2.toHexString());
  });

  it('handles null input', () => {
    expect(serialize(null)).toBeNull();
  });

  it('handles primitive input', () => {
    expect(serialize('hello')).toBe('hello');
    expect(serialize(42)).toBe(42);
  });

  it('preserves string calendar dates without shifting timezone', () => {
    const result = serialize<{ dateOfBirth: string }>({
      _id: new Types.ObjectId(),
      dateOfBirth: '2000-01-15',
    });
    expect(result.dateOfBirth).toBe('2000-01-15');
  });
});
