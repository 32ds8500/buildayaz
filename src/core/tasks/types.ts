import { generateId } from "../../shared/utils/id";
/**

 * AgentTask Orchestration Runtime — Core Type System
 * 
 * Production-grade task execution engine for AI-native IDE.
 * Supports DAG execution, streaming, retries, cancellation,
 * persistence, observability, and distributed execution readiness.
 */

// ═══════════════════════════════════════════════════════════════
// TASK IDENTITY
// ═══════════════════════════════════════════════════════════════

export type TaskId = string & { readonly __brand: unique symbol };
export type RunId = string & { readonly __brand: unique symbol };

export function taskId(): TaskId { return (crypto.randomUUID ? crypto.randomUUID() : generateId()) as TaskId; }
export function runId(): RunId { return (`run_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`) as RunId; }

// ═══════════════════════════════════════════════════════════════
// TASK TYPES
// ═══════════════════════════════════════════════════════════════

export type TaskType =
  | 'planning'
  | 'file_analysis'
  | 'code_generation'
  | 'code_editing'
  | 'debugging'
  | 'terminal_execution'
  | 'test_execution'
  | 'dependency_install'
  | 'refactoring'
  | 'semantic_search'
  | 'indexing'
  | 'composite';      // parent task containing sub-tasks

// ═══════════════════════════════════════════════════════════════
// STATE MACHINE
// ═══════════════════════════════════════════════════════════════

export type TaskState =
  | 'pending'          // created, not yet queued
  | 'queued'           // in queue waiting for scheduling
  | 'scheduled'        // assigned to a worker, about to run
  | 'running'          // actively executing
  | 'waiting'          // paused, waiting for dependency/user input
  | 'retrying'         // waiting before retry attempt
  | 'completed'        // successfully finished
  | 'failed'           // permanently failed
  | 'cancelled'        // cancelled by user or parent
  | 'timed_out';       // exceeded deadline

/** Valid state transitions: from → Set<to> */
export const STATE_TRANSITIONS: Record<TaskState, Set<TaskState>> = {
  pending:   new Set(['queued', 'cancelled']),
  queued:    new Set(['scheduled', 'cancelled']),
  scheduled: new Set(['running', 'cancelled']),
  running:   new Set(['completed', 'failed', 'cancelled', 'waiting', 'timed_out']),
  waiting:   new Set(['running', 'cancelled', 'timed_out']),
  retrying:  new Set(['queued', 'failed', 'cancelled']),
  completed: new Set(),  // terminal
  failed:    new Set(['retrying', 'cancelled']),
  cancelled: new Set(),  // terminal
  timed_out: new Set(['retrying', 'cancelled']),  
};

export function isTerminal(state: TaskState): boolean {
  return state === 'completed' || state === 'failed' || state === 'cancelled' || state === 'timed_out';
}

export function canTransition(from: TaskState, to: TaskState): boolean {
  return STATE_TRANSITIONS[from]?.has(to) ?? false;
}

// ═══════════════════════════════════════════════════════════════
// PRIORITY
// ═══════════════════════════════════════════════════════════════

export enum TaskPriority {
  CRITICAL = 0,   // user-facing, must execute immediately
  HIGH = 1,       // code generation, debugging
  NORMAL = 2,     // refactoring, analysis
  LOW = 3,        // indexing, background tasks
  BACKGROUND = 4, // telemetry, cleanup
}

// ═══════════════════════════════════════════════════════════════
// RETRY CONFIGURATION
// ═══════════════════════════════════════════════════════════════

export interface RetryPolicy {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableErrors?: string[];   // error code patterns to retry
  nonRetryableErrors?: string[]; // error codes that should never retry
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  retryableErrors: ['RATE_LIMIT', 'TIMEOUT', 'SERVER_ERROR', 'NETWORK'],
  nonRetryableErrors: ['AUTH', 'INVALID_INPUT', 'PERMISSION'],
};

export function computeBackoff(attempt: number, policy: RetryPolicy): number {
  const delay = policy.baseDelayMs * Math.pow(policy.backoffMultiplier, attempt);
  const jitter = delay * 0.3 * Math.random();
  return Math.min(delay + jitter, policy.maxDelayMs);
}

// ═══════════════════════════════════════════════════════════════
// TASK INPUT / OUTPUT
// ═══════════════════════════════════════════════════════════════

export interface TaskInput {
  /** Free-form input data keyed by name */
  [key: string]: unknown;
}

export interface TaskOutput {
  /** Structured result data */
  [key: string]: unknown;
}

export interface StreamChunk {
  taskId: TaskId;
  timestamp: number;
  type: 'text' | 'code' | 'file_change' | 'progress' | 'thinking' | 'tool_call' | 'error';
  content?: string;
  progress?: number;           // 0-1
  metadata?: Record<string, unknown>;
}

// ═══════════════════════════════════════════════════════════════
// CORE TASK DEFINITION
// ═══════════════════════════════════════════════════════════════

export interface AgentTask {
  // Identity
  id: TaskId;
  runId: RunId;
  type: TaskType;
  name: string;
  description?: string;

  // State
  state: TaskState;
  priority: TaskPriority;
  
  // Hierarchy
  parentId?: TaskId;
  childIds: TaskId[];
  
  // Dependencies (DAG edges)
  dependsOn: TaskId[];          // must complete before this runs
  dependedBy: TaskId[];         // tasks waiting on this
  
  // Execution
  input: TaskInput;
  output?: TaskOutput;
  error?: TaskError;
  
  // Retry
  retryPolicy: RetryPolicy;
  attempt: number;              // current attempt (0-based)
  
  // Timing
  createdAt: number;
  queuedAt?: number;
  startedAt?: number;
  completedAt?: number;
  timeoutMs?: number;           // max execution time
  deadlineAt?: number;          // absolute deadline
  
  // Streaming
  streamable: boolean;
  streamChunks: StreamChunk[];
  
  // Metadata
  agentType?: string;           // which agent owns this
  tags: string[];
  metadata: Record<string, unknown>;
  
  // Cancellation
  abortController?: AbortController;
}

// ═══════════════════════════════════════════════════════════════
// TASK ERROR
// ═══════════════════════════════════════════════════════════════

export interface TaskError {
  code: string;
  message: string;
  stack?: string;
  retryable: boolean;
  cause?: TaskError;
  context?: Record<string, unknown>;
}

export class TaskExecutionError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  readonly taskId?: TaskId;

  constructor(code: string, message: string, retryable = false, taskId?: TaskId) {
    super(message);
    this.name = 'TaskExecutionError';
    this.code = code;
    this.retryable = retryable;
    this.taskId = taskId;
  }

  toTaskError(): TaskError {
    return { code: this.code, message: this.message, stack: this.stack, retryable: this.retryable };
  }
}

// ═══════════════════════════════════════════════════════════════
// EVENTS
// ═══════════════════════════════════════════════════════════════

export type TaskEventType =
  | 'task:created'
  | 'task:queued'
  | 'task:scheduled'
  | 'task:started'
  | 'task:progress'
  | 'task:stream_chunk'
  | 'task:waiting'
  | 'task:retrying'
  | 'task:completed'
  | 'task:failed'
  | 'task:cancelled'
  | 'task:timed_out'
  | 'task:state_changed'
  | 'graph:started'
  | 'graph:completed'
  | 'graph:failed'
  | 'engine:idle'
  | 'engine:busy'
  | 'engine:error';

export interface TaskEvent {
  type: TaskEventType;
  taskId: TaskId;
  runId?: RunId;
  timestamp: number;
  state?: TaskState;
  previousState?: TaskState;
  data?: Record<string, unknown>;
  error?: TaskError;
  streamChunk?: StreamChunk;
}

// ═══════════════════════════════════════════════════════════════
// TASK HANDLER (executor)
// ═══════════════════════════════════════════════════════════════

/**
 * Task handler — implements the actual execution logic.
 * Receives the task + execution context, returns output or throws.
 * Can yield StreamChunks for real-time output.
 */
export interface TaskHandler {
  type: TaskType;
  execute(
    task: AgentTask,
    ctx: TaskExecutionContext,
  ): Promise<TaskOutput> | AsyncGenerator<StreamChunk, TaskOutput>;
  validate?(input: TaskInput): TaskError | null;
  estimateCost?(input: TaskInput): { tokens: number; timeMs: number };
}

export interface TaskExecutionContext {
  signal: AbortSignal;
  emit: (chunk: StreamChunk) => void;
  getTask: (id: TaskId) => AgentTask | undefined;
  updateTask: (id: TaskId, update: Partial<AgentTask>) => void;
  enqueueChild: (task: {
    type: TaskType;
    name: string;
    description?: string;
    input: TaskInput;
    priority?: TaskPriority;
    dependsOn?: TaskId[];
    timeoutMs?: number;
    retryPolicy?: Partial<RetryPolicy>;
    streamable?: boolean;
    agentType?: string;
    tags?: string[];
  }) => TaskId;
  log: (level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: unknown) => void;
}

// ═══════════════════════════════════════════════════════════════
// ENGINE CONFIGURATION
// ═══════════════════════════════════════════════════════════════

export interface EngineConfig {
  maxConcurrency: number;        // max parallel tasks
  maxQueueSize: number;          // max pending tasks
  defaultTimeoutMs: number;      // default per-task timeout
  globalDeadlineMs?: number;     // max total execution time
  enablePersistence: boolean;
  enableTelemetry: boolean;
  tickIntervalMs: number;        // scheduler tick interval
}

export const DEFAULT_ENGINE_CONFIG: EngineConfig = {
  maxConcurrency: 4,
  maxQueueSize: 1000,
  defaultTimeoutMs: 120_000,     // 2 minutes
  enablePersistence: true,
  enableTelemetry: true,
  tickIntervalMs: 100,
};

// ═══════════════════════════════════════════════════════════════
// TELEMETRY
// ═══════════════════════════════════════════════════════════════

export interface TaskMetrics {
  taskId: TaskId;
  type: TaskType;
  state: TaskState;
  attempt: number;
  durationMs: number;
  queueWaitMs: number;
  tokenUsage?: number;
  error?: string;
}

export interface EngineMetrics {
  activeTasks: number;
  queuedTasks: number;
  completedTasks: number;
  failedTasks: number;
  totalTasks: number;
  avgDurationMs: number;
  uptime: number;
}
