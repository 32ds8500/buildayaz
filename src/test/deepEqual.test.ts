import { describe, it, expect } from 'vitest';
import { deepEqual, shallowEqual } from '../shared/utils/deepEqual';

describe('deepEqual', () => {
  it('handles primitives', () => {
    expect(deepEqual(1, 1)).toBe(true);
    expect(deepEqual('a', 'b')).toBe(false);
    expect(deepEqual(null, null)).toBe(true);
    expect(deepEqual(null, undefined)).toBe(false);
  });

  it('handles arrays', () => {
    expect(deepEqual([1, 2, 3], [1, 2, 3])).toBe(true);
    expect(deepEqual([1, 2], [1, 2, 3])).toBe(false);
  });

  it('handles nested objects', () => {
    expect(deepEqual({ a: { b: 1 } }, { a: { b: 1 } })).toBe(true);
    expect(deepEqual({ a: { b: 1 } }, { a: { b: 2 } })).toBe(false);
  });

  it('handles Date', () => {
    const d1 = new Date('2024-01-01');
    const d2 = new Date('2024-01-01');
    expect(deepEqual(d1, d2)).toBe(true);
  });
});

describe('shallowEqual', () => {
  it('compares flat objects', () => {
    expect(shallowEqual({ a: 1, b: 2 } as Record<string,unknown>, { a: 1, b: 2 } as Record<string,unknown>)).toBe(true);
    expect(shallowEqual({ a: 1 } as Record<string,unknown>, { a: 2 } as Record<string,unknown>)).toBe(false);
  });
});
