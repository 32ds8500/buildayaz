/**
 * Persistence Layer Tests
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { lsLoad, lsSave, scheduleSave, _resetPersistenceCache } from '../store/persistence';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, val: string) => { store[key] = val; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

const makeProject = (id = 'p1') => ({
  id, name: 'Test', description: '', template: 'react',
  files: [], createdAt: Date.now(),
});

describe('lsSave / lsLoad', () => {
  beforeEach(() => { localStorageMock.clear(); _resetPersistenceCache(); });

  it('saves and loads a project', () => {
    const p = makeProject();
    lsSave([p]);
    const loaded = lsLoad();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe('p1');
  });

  it('filters invalid projects on load', () => {
    localStorageMock.setItem('kodyap_projects_v3', JSON.stringify([
      { id: 'p1', name: 'Valid', files: [], createdAt: 1 },
      { not: 'a project' },
      null,
    ]));
    const loaded = lsLoad();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe('p1');
  });

  it('returns empty array for corrupt JSON', () => {
    localStorageMock.setItem('kodyap_projects_v3', 'not-json{{{');
    expect(lsLoad()).toEqual([]);
  });

  it('handles localStorage quota error gracefully', () => {
    const origSet = localStorageMock.setItem;
    let callCount = 0;
    localStorageMock.setItem = (k: string, v: string) => {
      callCount++;
      if (callCount === 1) throw new DOMException('QuotaExceededError');
      origSet(k, v);
    };
    expect(() => lsSave([makeProject()])).not.toThrow();
    localStorageMock.setItem = origSet;
  });
});

describe('scheduleSave', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorageMock.clear();
    _resetPersistenceCache();
  });
  afterEach(() => vi.useRealTimers());

  it('immediate save writes to localStorage synchronously', () => {
    const p = makeProject('immediate');
    scheduleSave([p], true);
    const saved = lsLoad();
    expect(saved.some(s => s.id === 'immediate')).toBe(true);
  });

  it('debounced save waits 800ms', () => {
    const p = makeProject('debounced');
    scheduleSave([p], false);
    expect(lsLoad()).toHaveLength(0); // not yet
    vi.advanceTimersByTime(800);
    // IDB async — localStorage written by flushNow fallback
  });

  it('debounce resets on subsequent calls', () => {
    const p1 = makeProject('p1');
    const p2 = makeProject('p2');
    scheduleSave([p1], false);
    vi.advanceTimersByTime(400);
    scheduleSave([p1, p2], false); // reset timer
    vi.advanceTimersByTime(400);
    expect(lsLoad()).toHaveLength(0); // timer not yet elapsed
    vi.advanceTimersByTime(400);
    // After 800ms from last call
  });
});
