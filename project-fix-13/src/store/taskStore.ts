/**
 * Task Store — Bridges AgentTask engine with React UI via Zustand
 * 
 * Provides reactive state for:
 * - Active tasks visualization
 * - Streaming output display
 * - Task progress tracking
 * - Engine metrics
 */

import { create } from 'zustand';
import {
  TaskExecutionEngine, getAllHandlers,
  type AgentTask, type TaskId, type TaskEvent,
  type EngineMetrics, type TaskType,
  TaskPriority,
} from '../core/tasks';

interface TaskStoreState {
  // Engine instance
  engine: TaskExecutionEngine | null;
  initialized: boolean;

  // Reactive task list
  tasks: AgentTask[];
  activeTasks: AgentTask[];
  
  // Stream output per task
  streamOutputs: Map<TaskId, string>;
  
  // Metrics
  metrics: EngineMetrics | null;
  
  // Events log (last N)
  recentEvents: TaskEvent[];

  // Actions
  initialize: () => void;
  destroy: () => void;
  
  submitTask: (params: {
    type: TaskType;
    name: string;
    description?: string;
    input: Record<string, unknown>;
    priority?: TaskPriority;
    dependsOn?: TaskId[];
  }) => TaskId;

  cancelTask: (id: TaskId) => void;
  cancelAll: () => void;
  
  getTask: (id: TaskId) => AgentTask | undefined;
  getTaskStream: (id: TaskId) => string;
  
  refreshTasks: () => void;
  refreshMetrics: () => void;
}

export const useTaskStore = create<TaskStoreState>((set, get) => ({
  engine: null,
  initialized: false,
  tasks: [],
  activeTasks: [],
  streamOutputs: new Map(),
  metrics: null,
  recentEvents: [],

  initialize: () => {
    if (get().initialized) return;

    const engine = new TaskExecutionEngine({
      maxConcurrency: 3,
      maxQueueSize: 500,
      defaultTimeoutMs: 120_000,
      tickIntervalMs: 200,
    });

    // Register all built-in handlers
    for (const handler of getAllHandlers()) {
      engine.registerHandler(handler);
    }

    // Subscribe to events for reactive updates
    engine.events.onAny((event: TaskEvent) => {
      // Update task list on state changes
      if (event.type.startsWith('task:')) {
        const tasks = engine.getAllTasks();
        const activeTasks = tasks.filter(t =>
          t.state === 'running' || t.state === 'scheduled' || t.state === 'queued'
        );

        set({
          tasks,
          activeTasks,
          recentEvents: [...get().recentEvents.slice(-99), event],
        });
      }

      // Accumulate stream output
      if (event.type === 'task:stream_chunk' && event.streamChunk) {
        const chunk = event.streamChunk;
        if (chunk.content) {
          const outputs = new Map(get().streamOutputs);
          const existing = outputs.get(event.taskId) || '';
          outputs.set(event.taskId, existing + chunk.content);
          set({ streamOutputs: outputs });
        }
      }

      // Update metrics periodically
      if (event.type === 'task:completed' || event.type === 'task:failed') {
        set({ metrics: engine.getMetrics() });
      }
    });

    engine.start();
    set({ engine, initialized: true, metrics: engine.getMetrics() });
  },

  destroy: () => {
    const { engine } = get();
    if (engine) {
      engine.destroy();
      set({ engine: null, initialized: false, tasks: [], activeTasks: [], streamOutputs: new Map(), metrics: null, recentEvents: [] });
    }
  },

  submitTask: (params) => {
    const { engine } = get();
    if (!engine) throw new Error('Engine not initialized');

    const id = engine.submit({
      type: params.type,
      name: params.name,
      description: params.description,
      input: params.input,
      priority: params.priority ?? TaskPriority.NORMAL,
      dependsOn: params.dependsOn,
    });

    // Immediate refresh
    set({
      tasks: engine.getAllTasks(),
      activeTasks: engine.getAllTasks().filter(t =>
        t.state === 'running' || t.state === 'scheduled' || t.state === 'queued'
      ),
    });

    return id;
  },

  cancelTask: (id) => {
    const { engine } = get();
    if (engine) {
      engine.cancel(id);
      get().refreshTasks();
    }
  },

  cancelAll: () => {
    const { engine } = get();
    if (engine) {
      engine.cancelAll();
      get().refreshTasks();
    }
  },

  getTask: (id) => {
    return get().engine?.getTask(id);
  },

  getTaskStream: (id) => {
    return get().streamOutputs.get(id) || '';
  },

  refreshTasks: () => {
    const { engine } = get();
    if (!engine) return;
    const tasks = engine.getAllTasks();
    set({
      tasks,
      activeTasks: tasks.filter(t =>
        t.state === 'running' || t.state === 'scheduled' || t.state === 'queued'
      ),
    });
  },

  refreshMetrics: () => {
    const { engine } = get();
    if (engine) set({ metrics: engine.getMetrics() });
  },
}));
