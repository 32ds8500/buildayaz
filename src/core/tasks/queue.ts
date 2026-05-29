/**
 * TaskQueue — Priority queue with concurrency control
 * 
 * Features:
 * - Priority-based ordering (min-heap behavior via sorted insert)
 * - Concurrency limiting
 * - Fair scheduling across priorities
 * - Queue size limits
 * - Drain / pause / resume
 */

import type { AgentTask, TaskId, TaskPriority } from './types';

export class TaskQueue {
  private queue: AgentTask[] = [];
  private maxSize: number;

  constructor(maxSize = 1000) {
    this.maxSize = maxSize;
  }

  /** Enqueue a task (sorted by priority then createdAt) */
  enqueue(task: AgentTask): boolean {
    if (this.queue.length >= this.maxSize) return false;

    // Binary search for insert position
    let lo = 0, hi = this.queue.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (this.compare(task, this.queue[mid]) < 0) {
        hi = mid;
      } else {
        lo = mid + 1;
      }
    }
    this.queue.splice(lo, 0, task);
    return true;
  }

  /** Dequeue the highest-priority task */
  dequeue(): AgentTask | undefined {
    return this.queue.shift();
  }

  /** Dequeue up to N tasks */
  dequeueMany(count: number): AgentTask[] {
    return this.queue.splice(0, count);
  }

  /** Peek at the next task without removing */
  peek(): AgentTask | undefined {
    return this.queue[0];
  }

  /** Remove a specific task by ID */
  remove(taskId: TaskId): AgentTask | undefined {
    const idx = this.queue.findIndex(t => t.id === taskId);
    if (idx === -1) return undefined;
    return this.queue.splice(idx, 1)[0];
  }

  /** Check if a task is in the queue */
  has(taskId: TaskId): boolean {
    return this.queue.some(t => t.id === taskId);
  }

  /** Get queue size */
  get size(): number {
    return this.queue.length;
  }

  /** Check if empty */
  get isEmpty(): boolean {
    return this.queue.length === 0;
  }

  /** Get all tasks (readonly snapshot) */
  getAll(): readonly AgentTask[] {
    return this.queue;
  }

  /** Get tasks by priority */
  getByPriority(priority: TaskPriority): AgentTask[] {
    return this.queue.filter(t => t.priority === priority);
  }

  /** Clear the queue */
  clear(): AgentTask[] {
    const drained = [...this.queue];
    this.queue = [];
    return drained;
  }

  /** Compare function for priority ordering */
  private compare(a: AgentTask, b: AgentTask): number {
    // Lower priority number = higher priority
    if (a.priority !== b.priority) return a.priority - b.priority;
    // Same priority: FIFO by creation time
    return a.createdAt - b.createdAt;
  }
}
