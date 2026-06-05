/**
 * Lightweight structural equality check
 * Replaces JSON.stringify comparisons — handles undefined, Date, Arrays properly
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (a === null || b === null) return false;
  if (typeof a !== 'object' || typeof b !== 'object') return false;

  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }
  if (Array.isArray(a) !== Array.isArray(b)) return false;

  const keysA = Object.keys(a as object);
  const keysB = Object.keys(b as object);
  if (keysA.length !== keysB.length) return false;

  return keysA.every(k =>
    Object.prototype.hasOwnProperty.call(b, k) &&
    deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])
  );
}

/** Shallow equality — fast path for flat objects */
export function shallowEqual(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  return keysA.every(k => Object.is(a[k], b[k]));
}
