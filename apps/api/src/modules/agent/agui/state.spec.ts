import { textOf } from './state';

/**
 * Unit tests for reading the agent's own state.
 *
 * These converters are shared by the translator, which reports state as it
 * changes, and the service, which reports it once the run settles -- so they
 * are tested apart from either.
 */

describe('textOf', () => {
  it('returns the string directly for string content', () => {
    expect(textOf('hello')).toBe('hello');
  });

  it('extracts text from block array', () => {
    expect(textOf([{ text: 'a' }, { text: 'b' }])).toBe('ab');
  });

  it('returns empty string for null', () => {
    expect(textOf(null)).toBe('');
  });

  it('returns empty string for non-string non-array', () => {
    expect(textOf(42)).toBe('');
  });
});
