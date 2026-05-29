import { describe, it, expect } from 'vitest';
import { generateId, shortId } from '../shared/utils/id';

describe('generateId', () => {
  it('returns a UUID-like string', () => {
    const id = generateId();
    expect(id).toBeTruthy();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(10);
  });

  it('generates unique IDs', () => {
    const ids = new Set(Array.from({ length: 1000 }, generateId));
    expect(ids.size).toBe(1000);
  });
});

describe('shortId', () => {
  it('returns a short string', () => {
    const id = shortId();
    expect(id.length).toBeLessThanOrEqual(12);
  });
});
