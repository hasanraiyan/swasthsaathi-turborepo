import { normalizeMemoryKey } from './memory-files.store';

/**
 * Unit tests for the memory path normaliser.
 *
 * The agent chooses these paths itself, so traversal must be refused here,
 * not trusted — a model talked into writing `/memories/../../x` must not be
 * able to address another person's namespace.
 */

describe('normalizeMemoryKey', () => {
  it('adds a leading slash', () => {
    expect(normalizeMemoryKey('preferences')).toBe('/preferences');
  });

  it('collapses duplicate slashes', () => {
    expect(normalizeMemoryKey('//conditions///diabetes')).toBe(
      '/conditions/diabetes',
    );
  });

  it('trims whitespace', () => {
    expect(normalizeMemoryKey('  preferences  ')).toBe('/preferences');
  });

  it('normalizes backslashes to forward slashes', () => {
    expect(normalizeMemoryKey('conditions\\diabetes')).toBe(
      '/conditions/diabetes',
    );
  });

  it('handles nested paths', () => {
    expect(normalizeMemoryKey('conditions/diabetes/notes')).toBe(
      '/conditions/diabetes/notes',
    );
  });

  describe('rejects dangerous paths', () => {
    it('throws on ..', () => {
      expect(() => normalizeMemoryKey('../../etc/passwd')).toThrow(
        'Invalid memory file path',
      );
    });

    it('throws on ~', () => {
      expect(() => normalizeMemoryKey('~/secret')).toThrow(
        'Invalid memory file path',
      );
    });

    it('throws on null byte', () => {
      expect(() => normalizeMemoryKey('memory\x00injection')).toThrow(
        'Invalid memory file path',
      );
    });

    it('throws on . (current directory)', () => {
      expect(() => normalizeMemoryKey('.')).toThrow('Invalid memory file path');
    });

    it('throws on empty path', () => {
      expect(() => normalizeMemoryKey('')).toThrow(
        'Memory file path is required',
      );
    });

    it('throws on whitespace-only path', () => {
      expect(() => normalizeMemoryKey('   ')).toThrow(
        'Memory file path is required',
      );
    });
  });
});
