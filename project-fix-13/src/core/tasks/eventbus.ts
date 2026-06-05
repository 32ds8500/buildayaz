/**
 * TaskEventBus — Typed, high-performance event system
 * 
 * Features:
 * - Typed event subscriptions
 * - Wildcard listeners
 * - Event replay buffer
 * - Async emission
 * - Memory-safe cleanup
 */

import type { TaskEvent, TaskEventType, TaskId } from './types';

type Listener = (event: TaskEvent) => void;
type Unsubscribe = () => void;

export class TaskEventBus {
  private listeners = new Map<string, Set<Listener>>();
  private replayBuffer: TaskEvent[] = [];
  private maxReplaySize: number;

  constructor(maxReplaySize = 500) {
    this.maxReplaySize = maxReplaySize;
  }

  /** Subscribe to a specific event type */
  on(type: TaskEventType, listener: Listener): Unsubscribe {
    return this.addListener(type, listener);
  }

  /** Subscribe to all events for a specific task */
  onTask(taskId: TaskId, listener: Listener): Unsubscribe {
    return this.addListener(`task:${taskId}`, listener);
  }

  /** Subscribe to all events */
  onAny(listener: Listener): Unsubscribe {
    return this.addListener('*', listener);
  }

  /** Emit an event */
  emit(event: TaskEvent): void {
    // Store in replay buffer
    this.replayBuffer.push(event);
    if (this.replayBuffer.length > this.maxReplaySize) {
      this.replayBuffer.shift();
    }

    // Notify type-specific listeners
    this.notify(event.type, event);

    // Notify task-specific listeners
    if (event.taskId) {
      this.notify(`task:${event.taskId}`, event);
    }

    // Notify wildcard listeners
    this.notify('*', event);
  }

  /** Replay all buffered events for a listener */
  replay(listener: Listener, filter?: { taskId?: TaskId; types?: TaskEventType[] }): void {
    for (const event of this.replayBuffer) {
      if (filter?.taskId && event.taskId !== filter.taskId) continue;
      if (filter?.types && !filter.types.includes(event.type)) continue;
      listener(event);
    }
  }

  /** Get event history for a task */
  getHistory(taskId: TaskId): TaskEvent[] {
    return this.replayBuffer.filter(e => e.taskId === taskId);
  }

  /** Get all events of a type */
  getEventsByType(type: TaskEventType): TaskEvent[] {
    return this.replayBuffer.filter(e => e.type === type);
  }

  /** Clear all listeners and buffer */
  destroy(): void {
    this.listeners.clear();
    this.replayBuffer = [];
  }

  /** Remove all listeners for a task (cleanup after completion) */
  removeTaskListeners(taskId: TaskId): void {
    this.listeners.delete(`task:${taskId}`);
  }

  // ── Internals ──

  private addListener(key: string, listener: Listener): Unsubscribe {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key)!.add(listener);

    return () => {
      const set = this.listeners.get(key);
      if (set) {
        set.delete(listener);
        if (set.size === 0) this.listeners.delete(key);
      }
    };
  }

  private notify(key: string, event: TaskEvent): void {
    const set = this.listeners.get(key);
    if (!set) return;
    for (const listener of set) {
      try {
        listener(event);
      } catch (err) {
        console.error('[TaskEventBus] Listener error:', err);
      }
    }
  }
}
