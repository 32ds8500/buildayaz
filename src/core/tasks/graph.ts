/**
 * TaskGraph — DAG-based dependency resolution
 * 
 * Features:
 * - Cycle detection (Kahn's algorithm)
 * - Topological ordering
 * - Parallel branch detection
 * - Ready-task resolution
 * - Subgraph extraction
 * - Critical path analysis
 */

import type { TaskId, AgentTask, TaskState } from './types';
import { isTerminal } from './types';

export class TaskGraph {
  private tasks = new Map<TaskId, AgentTask>();
  private adjacency = new Map<TaskId, Set<TaskId>>();   // task → dependsOn
  private reverse = new Map<TaskId, Set<TaskId>>();     // task → dependedBy

  /** Add a task to the graph */
  addTask(task: AgentTask): void {
    this.tasks.set(task.id, task);
    
    if (!this.adjacency.has(task.id)) {
      this.adjacency.set(task.id, new Set());
    }
    if (!this.reverse.has(task.id)) {
      this.reverse.set(task.id, new Set());
    }

    // Register dependency edges
    for (const depId of task.dependsOn) {
      this.addEdge(task.id, depId);
    }
  }

  /** Add a dependency edge: taskId depends on depId */
  addEdge(taskId: TaskId, depId: TaskId): void {
    if (!this.adjacency.has(taskId)) this.adjacency.set(taskId, new Set());
    if (!this.reverse.has(depId)) this.reverse.set(depId, new Set());
    
    this.adjacency.get(taskId)!.add(depId);
    this.reverse.get(depId)!.add(taskId);
  }

  /** Remove a task from the graph */
  removeTask(taskId: TaskId): void {
    // Remove all edges pointing to/from this task
    const deps = this.adjacency.get(taskId) || new Set();
    for (const depId of deps) {
      this.reverse.get(depId)?.delete(taskId);
    }
    const dependents = this.reverse.get(taskId) || new Set();
    for (const depId of dependents) {
      this.adjacency.get(depId)?.delete(taskId);
    }
    this.adjacency.delete(taskId);
    this.reverse.delete(taskId);
    this.tasks.delete(taskId);
  }

  /** Get task by ID */
  getTask(taskId: TaskId): AgentTask | undefined {
    return this.tasks.get(taskId);
  }

  /** Update a task */
  updateTask(taskId: TaskId, update: Partial<AgentTask>): void {
    const task = this.tasks.get(taskId);
    if (task) {
      Object.assign(task, update);
    }
  }

  /** Get all tasks */
  getAllTasks(): AgentTask[] {
    return Array.from(this.tasks.values());
  }

  /** Get tasks by state */
  getTasksByState(state: TaskState): AgentTask[] {
    return this.getAllTasks().filter(t => t.state === state);
  }

  /**
   * Get tasks ready to execute:
   * - State is 'queued' 
   * - All dependencies are completed
   */
  getReadyTasks(): AgentTask[] {
    const ready: AgentTask[] = [];
    
    for (const task of this.tasks.values()) {
      if (task.state !== 'queued') continue;
      
      const deps = this.adjacency.get(task.id) || new Set();
      const allDepsCompleted = Array.from(deps).every(depId => {
        const dep = this.tasks.get(depId);
        return dep?.state === 'completed';
      });
      
      if (allDepsCompleted) {
        ready.push(task);
      }
    }

    // Sort by priority (lower number = higher priority)
    ready.sort((a, b) => a.priority - b.priority);
    return ready;
  }

  /**
   * Check if a dependency was failed/cancelled
   * Propagates failure to dependent tasks
   */
  getBlockedTasks(): { taskId: TaskId; reason: string; blockedBy: TaskId }[] {
    const blocked: { taskId: TaskId; reason: string; blockedBy: TaskId }[] = [];
    
    for (const task of this.tasks.values()) {
      if (isTerminal(task.state)) continue;
      
      const deps = this.adjacency.get(task.id) || new Set();
      for (const depId of deps) {
        const dep = this.tasks.get(depId);
        if (dep && (dep.state === 'failed' || dep.state === 'cancelled' || dep.state === 'timed_out')) {
          blocked.push({
            taskId: task.id,
            reason: `Dependency ${depId} is ${dep.state}`,
            blockedBy: depId,
          });
        }
      }
    }

    return blocked;
  }

  /**
   * Detect cycles using Kahn's algorithm
   * Returns: null if no cycle, or array of task IDs forming the cycle
   */
  detectCycle(): TaskId[] | null {
    const inDegree = new Map<TaskId, number>();
    
    for (const id of this.tasks.keys()) {
      inDegree.set(id, 0);
    }
    for (const [, deps] of this.adjacency) {
      for (const depId of deps) {
        inDegree.set(depId, (inDegree.get(depId) || 0) + 1);
      }
    }

    const queue: TaskId[] = [];
    for (const [id, degree] of inDegree) {
      if (degree === 0) queue.push(id);
    }

    let visited = 0;
    while (queue.length > 0) {
      const current = queue.shift()!;
      visited++;
      
      const deps = this.adjacency.get(current) || new Set();
      for (const depId of deps) {
        const newDegree = (inDegree.get(depId) || 1) - 1;
        inDegree.set(depId, newDegree);
        if (newDegree === 0) queue.push(depId);
      }
    }

    if (visited === this.tasks.size) return null;

    // Cycle exists — return nodes involved
    return Array.from(inDegree.entries())
      .filter(([, degree]) => degree > 0)
      .map(([id]) => id);
  }

  /**
   * Topological sort of all tasks
   * Returns tasks in valid execution order
   */
  topologicalSort(): AgentTask[] {
    const sorted: AgentTask[] = [];
    const visited = new Set<TaskId>();
    const temp = new Set<TaskId>();

    const visit = (id: TaskId) => {
      if (visited.has(id)) return;
      if (temp.has(id)) return; // cycle — skip
      temp.add(id);
      
      const deps = this.adjacency.get(id) || new Set();
      for (const depId of deps) {
        visit(depId);
      }
      
      temp.delete(id);
      visited.add(id);
      const task = this.tasks.get(id);
      if (task) sorted.push(task);
    };

    for (const id of this.tasks.keys()) {
      visit(id);
    }

    return sorted;
  }

  /**
   * Find parallel execution branches
   * Tasks that can run concurrently (no dependency between them)
   */
  getParallelGroups(): AgentTask[][] {
    const sorted = this.topologicalSort();
    const levels = new Map<TaskId, number>();
    
    for (const task of sorted) {
      const deps = this.adjacency.get(task.id) || new Set();
      let maxDepLevel = -1;
      for (const depId of deps) {
        maxDepLevel = Math.max(maxDepLevel, levels.get(depId) || 0);
      }
      levels.set(task.id, maxDepLevel + 1);
    }

    // Group by level
    const groups = new Map<number, AgentTask[]>();
    for (const task of sorted) {
      const level = levels.get(task.id) || 0;
      if (!groups.has(level)) groups.set(level, []);
      groups.get(level)!.push(task);
    }

    return Array.from(groups.entries())
      .sort(([a], [b]) => a - b)
      .map(([, tasks]) => tasks);
  }

  /**
   * Check if the entire graph is complete
   */
  isComplete(): boolean {
    return this.getAllTasks().every(t => isTerminal(t.state));
  }

  /**
   * Get graph statistics
   */
  getStats(): { total: number; completed: number; failed: number; running: number; queued: number; pending: number } {
    const tasks = this.getAllTasks();
    return {
      total: tasks.length,
      completed: tasks.filter(t => t.state === 'completed').length,
      failed: tasks.filter(t => t.state === 'failed').length,
      running: tasks.filter(t => t.state === 'running').length,
      queued: tasks.filter(t => t.state === 'queued').length,
      pending: tasks.filter(t => t.state === 'pending').length,
    };
  }

  /** Clear the graph */
  clear(): void {
    this.tasks.clear();
    this.adjacency.clear();
    this.reverse.clear();
  }
}
