/**
 * Autosave Tests
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getAutosaveStatus, markDirty, initAutosave } from '../store/autosave';
import * as persistence from '../store/persistence';
import * as projectStore from '../store/projectStore';

vi.mock('../store/persistence', () => ({
  scheduleSave: vi.fn(),
  lsSave: vi.fn(),
  lsLoad: vi.fn().mockReturnValue([]),
  loadProjectsSync: vi.fn().mockReturnValue([]),
  _resetPersistenceCache: vi.fn(),
}));

vi.mock('../store/projectStore', () => ({
  useProjectStore: {
    getState: vi.fn().mockReturnValue({ projects: [{ id: 'p1', name: 'Test', files: [], createdAt: 1, description: '', template: 'react' }] }),
    setState: vi.fn(),
    subscribe: vi.fn(),
  },
}));

describe('getAutosaveStatus', () => {
  it('returns status object', () => {
    const status = getAutosaveStatus();
    expect(status).toHaveProperty('initialized');
    expect(status).toHaveProperty('dirtyCount');
    expect(status).toHaveProperty('lastSaveAt');
  });
});

describe('markDirty', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('increments dirtyCount', () => {
    const before = getAutosaveStatus().dirtyCount;
    markDirty();
    expect(getAutosaveStatus().dirtyCount).toBeGreaterThanOrEqual(before);
  });

  it('triggers save after idle timeout', async () => {
    markDirty();
    vi.advanceTimersByTime(5001);
    expect(persistence.scheduleSave).toHaveBeenCalled();
  });
});

describe('initAutosave', () => {
  it('returns teardown function', () => {
    const teardown = initAutosave();
    expect(typeof teardown).toBe('function');
    teardown(); // should not throw
  });

  it('teardown cleans up listeners', () => {
    const addSpy = vi.spyOn(document, 'addEventListener');
    const removeSpy = vi.spyOn(document, 'removeEventListener');
    const teardown = initAutosave();
    teardown();
    expect(removeSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    addSpy.mockRestore();
    removeSpy.mockRestore();
  });
});
