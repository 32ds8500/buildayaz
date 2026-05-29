/**
 * TaskExecutionEngine — Core orchestration runtime
 * 
 * This is the beating heart of the agent system.
 * 
 * Architecture:
 * ┌─────────┐    ┌──────────┐    ┌───────────┐    ┌──────────┐
 * │  Submit  │───▸│  Queue   │───▸│ Scheduler │───▸│ Workers  │
 * └─────────┘    └──────────┘    └───────────┘    └──────────┘
 *       │              │               │                │
 *       └──────────────┴───────────────┴────────────────┘
 *                              │
 *                        ┌──────────┐
 *                        │ EventBus │
 *                        └──────────┘
 * 
 * Execution Flow:
 * 1. Task submitted → validated → pending
 * 2. pending → queued (added to priority queue)
 * 3. Scheduler tick: queue → resolve ready tasks → schedule
 * 4. scheduled → running (handler invoked)
 * 5. Handler streams results → completed | failed
 * 6. failed + retryable → retrying → queued (backoff)
 * 7. completed → resolve dependents → schedule next
 * 8. Parent checks all children → composite completion
 */

import type {
  AgentTask, TaskId, RunId, TaskType, TaskState, TaskPriority,
  TaskInput, TaskOutput, TaskHandler, TaskExecutionContext,
  StreamChunk, EngineConfig, EngineMetrics, TaskEvent, RetryPolicy,
} from './types';
import {
  taskId, runId, canTransition, isTerminal, computeBackoff,
  DEFAULT_ENGINE_CONFIG, DEFAULT_RETRY_POLICY, TaskPriority as Priority,
  TaskExecutionError,
} from './types';
import { TaskQueue } from './queue';
import { TaskGraph } from './graph';
import { TaskEventBus } from './eventbus';

export class TaskExecutionEngine {
  private config: EngineConfig;
  private graph: TaskGraph;
  private queue: TaskQueue;
  readonly events: TaskEventBus;
  private handlers = new Map<TaskType, TaskHandler>();
  private activeCount = 0;
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private currentRunId: RunId = runId();
  private startTime = Date.now();
  private completedCount = 0;
  private failedCount = 0;
  private destroyed = false;

  constructor(config: Partial<EngineConfig> = {}) {
    this.config = { ...DEFAULT_ENGINE_CONFIG, ...config };
    this.graph = new TaskGraph();
    this.queue = new TaskQueue(this.config.maxQueueSize);
    this.events = new TaskEventBus();
  }

  // ═══════════════════════════════════════════════════════════
  // HANDLER REGISTRATION
  // ═══════════════════════════════════════════════════════════

  /** Register a task handler for a specific type */
  registerHandler(handler: TaskHandler): void {
    this.handlers.set(handler.type, handler);
  }

  /** Check if a handler is registered */
  hasHandler(type: TaskType): boolean {
    return this.handlers.has(type);
  }

  // ═══════════════════════════════════════════════════════════
  // TASK SUBMISSION
  // ═══════════════════════════════════════════════════════════

  /** Submit a new task */
  submit(params: {
    type: TaskType;
    name: string;
    description?: string;
    input: TaskInput;
    priority?: TaskPriority;
    parentId?: TaskId;
    dependsOn?: TaskId[];
    timeoutMs?: number;
    retryPolicy?: Partial<RetryPolicy>;
    streamable?: boolean;
    agentType?: string;
    tags?: string[];
    metadata?: Record<string, unknown>;
  }): TaskId {
    if (this.destroyed) throw new Error('Engine is destroyed');

    const id = taskId();
    const task: AgentTask = {
      id,
      runId: this.currentRunId,
      type: params.type,
      name: params.name,
      description: params.description,
      state: 'pending',
      priority: params.priority ?? Priority.NORMAL,
      parentId: params.parentId,
      childIds: [],
      dependsOn: params.dependsOn || [],
      dependedBy: [],
      input: params.input,
      retryPolicy: { ...DEFAULT_RETRY_POLICY, ...params.retryPolicy },
      attempt: 0,
      createdAt: Date.now(),
      timeoutMs: params.timeoutMs || this.config.defaultTimeoutMs,
      streamable: params.streamable ?? true,
      streamChunks: [],
      agentType: params.agentType,
      tags: params.tags || [],
      metadata: params.metadata || {},
    };

    // Register parent relationship
    if (task.parentId) {
      const parent = this.graph.getTask(task.parentId);
      if (parent) parent.childIds.push(id);
    }

    // Register dependency relationships
    for (const depId of task.dependsOn) {
      const dep = this.graph.getTask(depId);
      if (dep) dep.dependedBy.push(id);
    }

    // Add to graph
    this.graph.addTask(task);

    // Emit creation event
    this.emitEvent('task:created', task);

    // Transition to queued
    this.transitionState(task, 'queued');

    // Start scheduler if not running
    this.ensureScheduler();

    return id;
  }

  /** Submit a task graph (multiple tasks with dependencies) */
  submitGraph(tasks: Parameters<typeof this.submit>[0][]): TaskId[] {
    this.currentRunId = runId();
    const ids: TaskId[] = [];
    for (const params of tasks) {
      ids.push(this.submit(params));
    }

    // Validate no cycles
    const cycle = this.graph.detectCycle();
    if (cycle) {
      // Cancel all tasks in cycle
      for (const id of cycle) {
        const task = this.graph.getTask(id);
        if (task) this.transitionState(task, 'cancelled');
      }
      throw new TaskExecutionError('CYCLE_DETECTED', `Dependency cycle detected: ${cycle.join(' → ')}`);
    }

    return ids;
  }

  // ═══════════════════════════════════════════════════════════
  // TASK CONTROL
  // ═══════════════════════════════════════════════════════════

  /** Cancel a task and its children */
  cancel(id: TaskId): void {
    const task = this.graph.getTask(id);
    if (!task || isTerminal(task.state)) return;

    // Cancel children first
    for (const childId of task.childIds) {
      this.cancel(childId);
    }

    // Abort if running
    if (task.abortController) {
      task.abortController.abort();
    }

    this.transitionState(task, 'cancelled');
  }

  /** Cancel all tasks */
  cancelAll(): void {
    for (const task of this.graph.getAllTasks()) {
      if (!isTerminal(task.state)) {
        this.cancel(task.id);
      }
    }
  }

  /** Get a task by ID */
  getTask(id: TaskId): AgentTask | undefined {
    return this.graph.getTask(id);
  }

  /** Get all tasks */
  getAllTasks(): AgentTask[] {
    return this.graph.getAllTasks();
  }

  /** Get engine metrics */
  getMetrics(): EngineMetrics {
    const all = this.graph.getAllTasks();
    const durations = all
      .filter(t => t.startedAt && t.completedAt)
      .map(t => t.completedAt! - t.startedAt!);
    
    return {
      activeTasks: this.activeCount,
      queuedTasks: this.queue.size,
      completedTasks: this.completedCount,
      failedTasks: this.failedCount,
      totalTasks: all.length,
      avgDurationMs: durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0,
      uptime: Date.now() - this.startTime,
    };
  }

  // ═══════════════════════════════════════════════════════════
  // SCHEDULER
  // ═══════════════════════════════════════════════════════════

  private ensureScheduler(): void {
    if (this.tickTimer || this.destroyed) return;
    this.tickTimer = setInterval(() => this.tick(), this.config.tickIntervalMs);
  }

  private stopScheduler(): void {
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
  }

  /** Main scheduler tick — called every tickIntervalMs */
  private tick(): void {
    if (this.destroyed) { this.stopScheduler(); return; }

    // 1. Check for blocked tasks (dependency failures)
    this.propagateFailures();

    // 2. Check for timed-out tasks
    this.checkTimeouts();

    // 3. Process retrying tasks that are ready
    this.processRetries();

    // 4. Schedule ready tasks from graph
    this.scheduleReadyTasks();

    // 5. Check if we're done
    if (this.graph.isComplete() && this.activeCount === 0 && this.queue.isEmpty) {
      this.stopScheduler();
      this.events.emit({
        type: 'engine:idle',
        taskId: '' as TaskId,
        timestamp: Date.now(),
      });
    }
  }

  private scheduleReadyTasks(): void {
    // Find tasks ready to run (dependencies met)
    const ready = this.graph.getReadyTasks();

    for (const task of ready) {
      if (this.activeCount >= this.config.maxConcurrency) break;

      // Move to scheduled → running
      this.transitionState(task, 'scheduled');
      this.executeTask(task);
    }
  }

  private propagateFailures(): void {
    const blocked = this.graph.getBlockedTasks();
    for (const { taskId: tId, reason } of blocked) {
      const task = this.graph.getTask(tId);
      if (task && !isTerminal(task.state)) {
        task.error = { code: 'DEPENDENCY_FAILED', message: reason, retryable: false };
        this.transitionState(task, 'failed');
      }
    }
  }

  private checkTimeouts(): void {
    const now = Date.now();
    for (const task of this.graph.getTasksByState('running')) {
      if (task.timeoutMs && task.startedAt && (now - task.startedAt) > task.timeoutMs) {
        task.abortController?.abort();
        task.error = { code: 'TIMEOUT', message: `Task timed out after ${task.timeoutMs}ms`, retryable: true };
        this.transitionState(task, 'timed_out');
      }
      if (task.deadlineAt && now > task.deadlineAt) {
        task.abortController?.abort();
        task.error = { code: 'DEADLINE_EXCEEDED', message: 'Absolute deadline exceeded', retryable: false };
        this.transitionState(task, 'timed_out');
      }
    }
  }

  private processRetries(): void {
    const now = Date.now();
    for (const task of this.graph.getTasksByState('retrying')) {
      const retryAt = (task.metadata._retryAt as number) || 0;
      if (now >= retryAt) {
        task.attempt++;
        this.transitionState(task, 'queued');
      }
    }
  }

  // ═══════════════════════════════════════════════════════════
  // EXECUTION
  // ═══════════════════════════════════════════════════════════

  private async executeTask(task: AgentTask): Promise<void> {
    const handler = this.handlers.get(task.type);
    if (!handler) {
      task.error = { code: 'NO_HANDLER', message: `No handler registered for task type: ${task.type}`, retryable: false };
      this.transitionState(task, 'failed');
      return;
    }

    // Validate input
    if (handler.validate) {
      const validationError = handler.validate(task.input);
      if (validationError) {
        task.error = validationError;
        this.transitionState(task, 'failed');
        return;
      }
    }

    // Set up abort controller
    const controller = new AbortController();
    task.abortController = controller;
    task.startedAt = Date.now();
    this.activeCount++;

    this.transitionState(task, 'running');

    // Build execution context
    const ctx: TaskExecutionContext = {
      signal: controller.signal,
      emit: (chunk: StreamChunk) => {
        task.streamChunks.push(chunk);
        this.events.emit({
          type: 'task:stream_chunk',
          taskId: task.id,
          runId: task.runId,
          timestamp: Date.now(),
          streamChunk: chunk,
        });
      },
      getTask: (id: TaskId) => this.graph.getTask(id),
      updateTask: (id: TaskId, update: Partial<AgentTask>) => this.graph.updateTask(id, update),
      enqueueChild: (childParams) => {
        return this.submit({
          type: childParams.type,
          name: childParams.name,
          description: childParams.description,
          input: childParams.input,
          parentId: task.id,
          dependsOn: childParams.dependsOn,
          priority: childParams.priority,
          retryPolicy: childParams.retryPolicy,
          streamable: childParams.streamable,
          agentType: childParams.agentType,
          tags: childParams.tags,
        });
      },
      log: (level, message, data) => {
        this.events.emit({
          type: 'task:progress',
          taskId: task.id,
          runId: task.runId,
          timestamp: Date.now(),
          data: { level, message, ...( data ? { detail: data } : {}) },
        });
      },
    };

    try {
      const result = handler.execute(task, ctx);

      if (result && typeof (result as AsyncGenerator).next === 'function') {
        // Streaming execution
        const gen = result as AsyncGenerator<StreamChunk, TaskOutput>;
        let output: TaskOutput = {};
        
        while (true) {
          const { value, done } = await gen.next();
          if (done) {
            output = value as TaskOutput;
            break;
          }
          // value is a StreamChunk
          ctx.emit(value as StreamChunk);
        }

        task.output = output;
      } else {
        // Promise-based execution
        task.output = await (result as Promise<TaskOutput>);
      }

      task.completedAt = Date.now();
      this.completedCount++;
      this.transitionState(task, 'completed');

      // Check parent composite completion
      this.checkParentCompletion(task);

    } catch (err: unknown) {
      task.completedAt = Date.now();

      if (controller.signal.aborted) {
        this.transitionState(task, 'cancelled');
      } else {
        const taskErr = err instanceof TaskExecutionError
          ? err.toTaskError()
          : { code: 'EXECUTION_ERROR', message: err instanceof Error ? err.message : String(err), retryable: true, stack: err instanceof Error ? err.stack : undefined };

        task.error = taskErr;

        // Determine if should retry
        if (taskErr.retryable && task.attempt < task.retryPolicy.maxRetries) {
          const delay = computeBackoff(task.attempt, task.retryPolicy);
          task.metadata._retryAt = Date.now() + delay;
          this.transitionState(task, 'retrying');
          
          this.events.emit({
            type: 'task:retrying',
            taskId: task.id,
            runId: task.runId,
            timestamp: Date.now(),
            data: { attempt: task.attempt + 1, maxRetries: task.retryPolicy.maxRetries, nextRetryAt: task.metadata._retryAt, delayMs: delay },
          });
        } else {
          this.failedCount++;
          this.transitionState(task, 'failed');
        }
      }
    } finally {
      this.activeCount--;
      task.abortController = undefined;
    }
  }

  /** Check if parent task should complete (all children done) */
  private checkParentCompletion(task: AgentTask): void {
    if (!task.parentId) return;
    const parent = this.graph.getTask(task.parentId);
    if (!parent || isTerminal(parent.state)) return;

    const allChildrenDone = parent.childIds.every(childId => {
      const child = this.graph.getTask(childId);
      return child && isTerminal(child.state);
    });

    if (allChildrenDone) {
      const anyFailed = parent.childIds.some(childId => {
        const child = this.graph.getTask(childId);
        return child && (child.state === 'failed' || child.state === 'timed_out');
      });

      if (anyFailed) {
        parent.error = { code: 'CHILD_FAILED', message: 'One or more child tasks failed', retryable: false };
        this.transitionState(parent, 'failed');
      } else {
        // Aggregate child outputs
        const outputs: Record<string, unknown> = {};
        for (const childId of parent.childIds) {
          const child = this.graph.getTask(childId);
          if (child?.output) outputs[child.name] = child.output;
        }
        parent.output = outputs;
        parent.completedAt = Date.now();
        this.completedCount++;
        this.transitionState(parent, 'completed');
      }
    }
  }

  // ═══════════════════════════════════════════════════════════
  // STATE MACHINE
  // ═══════════════════════════════════════════════════════════

  private transitionState(task: AgentTask, newState: TaskState): void {
    const prev = task.state;
    if (prev === newState) return;

    if (!canTransition(prev, newState)) {
      console.warn(`[Engine] Invalid transition: ${prev} → ${newState} for task ${task.id}`);
      return;
    }

    task.state = newState;

    // Set timing
    if (newState === 'queued') {
      task.queuedAt = Date.now();
      if (prev === 'pending') {
        this.queue.enqueue(task);
      }
    }

    // Emit event
    const eventType = ({
      queued: 'task:queued',
      scheduled: 'task:scheduled',
      running: 'task:started',
      waiting: 'task:waiting',
      retrying: 'task:retrying',
      completed: 'task:completed',
      failed: 'task:failed',
      cancelled: 'task:cancelled',
      timed_out: 'task:timed_out',
    } as Record<string, string>)[newState] || 'task:state_changed';

    this.emitEvent(eventType as Parameters<typeof this.emitEvent>[0], task, prev);

    // Cleanup on terminal states
    if (isTerminal(newState)) {
      this.queue.remove(task.id);
      this.events.removeTaskListeners(task.id);
    }
  }

  private emitEvent(type: TaskEvent['type'], task: AgentTask, previousState?: TaskState): void {
    this.events.emit({
      type,
      taskId: task.id,
      runId: task.runId,
      timestamp: Date.now(),
      state: task.state,
      previousState,
      error: task.error,
    });
  }

  // ═══════════════════════════════════════════════════════════
  // LIFECYCLE
  // ═══════════════════════════════════════════════════════════

  /** Start the engine scheduler */
  start(): void {
    this.destroyed = false;
    this.startTime = Date.now();
    this.ensureScheduler();
  }

  /** Stop the engine and cancel all running tasks */
  stop(): void {
    this.stopScheduler();
    this.cancelAll();
  }

  /** Destroy the engine, releasing all resources */
  destroy(): void {
    this.destroyed = true;
    this.stop();
    this.graph.clear();
    this.queue.clear();
    this.events.destroy();
    this.handlers.clear();
  }

  /** Wait for all tasks to complete */
  async waitForCompletion(timeoutMs = 300000): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error('Engine completion timeout'));
      }, timeoutMs);

      const checkComplete = () => {
        if (this.graph.isComplete() && this.activeCount === 0) {
          cleanup();
          resolve();
        }
      };

      const unsub = this.events.on('task:completed', checkComplete);
      const unsub2 = this.events.on('task:failed', checkComplete);
      const unsub3 = this.events.on('task:cancelled', checkComplete);

      const cleanup = () => {
        clearTimeout(timeout);
        unsub();
        unsub2();
        unsub3();
      };

      // Check immediately
      checkComplete();
    });
  }
}
