/**
 * TaskPanel — Real-time task orchestration visibility
 * Shows active tasks, progress, streaming output, metrics
 */

import React, { useEffect, useMemo } from 'react';
import { useTaskStore } from '../store/taskStore';
import type { AgentTask } from '../core/tasks';
import {
  Cpu, Play, Square, CircleCheckBig, CircleX, Clock,
  Loader2, RefreshCw, Trash2, BarChart3, Zap,
  ChevronDown, ChevronRight, TriangleAlert
} from 'lucide-react';

const stateConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  pending: { color: 'text-dark-300', icon: <Clock className="w-3 h-3" />, label: 'Bekliyor' },
  queued: { color: 'text-yellow-400', icon: <Clock className="w-3 h-3" />, label: 'Kuyrukta' },
  scheduled: { color: 'text-blue-400', icon: <Zap className="w-3 h-3" />, label: 'Planlandı' },
  running: { color: 'text-accent-blue', icon: <Loader2 className="w-3 h-3 animate-spin" />, label: 'Çalışıyor' },
  waiting: { color: 'text-orange-400', icon: <Clock className="w-3 h-3" />, label: 'Bekliyor' },
  retrying: { color: 'text-yellow-400', icon: <RefreshCw className="w-3 h-3" />, label: 'Yeniden Deneniyor' },
  completed: { color: 'text-accent-green', icon: <CircleCheckBig className="w-3 h-3" />, label: 'Tamamlandı' },
  failed: { color: 'text-red-400', icon: <CircleX className="w-3 h-3" />, label: 'Başarısız' },
  cancelled: { color: 'text-dark-300', icon: <Square className="w-3 h-3" />, label: 'İptal' },
  timed_out: { color: 'text-orange-400', icon: <TriangleAlert className="w-3 h-3" />, label: 'Zaman Aşımı' },
};

const TaskRow: React.FC<{ task: AgentTask }> = ({ task }) => {
  const { cancelTask, getTaskStream } = useTaskStore();
  const [expanded, setExpanded] = React.useState(false);
  const cfg = stateConfig[task.state] || stateConfig.pending;
  const stream = getTaskStream(task.id);
  const isRunning = task.state === 'running' || task.state === 'scheduled';
   
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isRunning]);
  const duration = task.startedAt ? ((task.completedAt || now) - task.startedAt) : 0;

  return (
    <div className="border-b border-dark-600/50">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-dark-700/50 transition text-left"
      >
        {expanded ? <ChevronDown className="w-3 h-3 text-dark-300" /> : <ChevronRight className="w-3 h-3 text-dark-300" />}
        <span className={cfg.color}>{cfg.icon}</span>
        <span className="text-xs text-white font-medium truncate flex-1">{task.name}</span>
        <span className="text-[10px] text-dark-400">{task.type}</span>
        {duration > 0 && <span className="text-[10px] text-dark-400">{(duration / 1000).toFixed(1)}s</span>}
        {isRunning && (
          <button
            onClick={(e) => { e.stopPropagation(); cancelTask(task.id); }}
            className="p-0.5 text-dark-400 hover:text-red-400 transition"
            title="İptal"
          >
            <Square className="w-3 h-3" />
          </button>
        )}
      </button>

      {expanded && (
        <div className="px-3 pb-2 space-y-1 animate-fade-in">
          <div className="flex flex-wrap gap-2 text-[10px]">
            <span className={`px-1.5 py-0.5 rounded ${cfg.color} bg-dark-600`}>{cfg.label}</span>
            <span className="text-dark-400">Deneme: {task.attempt + 1}/{task.retryPolicy.maxRetries + 1}</span>
            {task.priority !== undefined && <span className="text-dark-400">Öncelik: {task.priority}</span>}
          </div>
          {task.description && <p className="text-[11px] text-dark-300">{task.description}</p>}
          {task.error && (
            <div className="text-[11px] text-red-400 bg-red-500/5 border border-red-500/20 rounded px-2 py-1">
              [{task.error.code}] {task.error.message}
            </div>
          )}
          {stream && (
            <pre className="text-[10px] text-dark-200 bg-dark-900 rounded p-2 max-h-24 overflow-y-auto font-mono whitespace-pre-wrap">
              {stream.slice(-500)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
};

export const TaskPanel: React.FC = () => {
  const { initialize, initialized, tasks, activeTasks, metrics, cancelAll, refreshMetrics } = useTaskStore();

  useEffect(() => {
    if (!initialized) initialize();
  }, [initialized, initialize]);

  useEffect(() => {
    const timer = setInterval(refreshMetrics, 2000);
    return () => clearInterval(timer);
  }, [refreshMetrics]);

  const grouped = useMemo(() => {
    const running = tasks.filter(t => t.state === 'running' || t.state === 'scheduled');
    const queued = tasks.filter(t => t.state === 'queued' || t.state === 'pending');
    const recent = tasks
      .filter(t => t.state === 'completed' || t.state === 'failed' || t.state === 'cancelled')
      .slice(-10)
      .reverse();
    return { running, queued, recent };
  }, [tasks]);

  return (
    <div className="h-full flex flex-col bg-dark-800 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-dark-600 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-accent-blue" />
          <span className="text-xs font-semibold text-white">Görev Motoru</span>
          {activeTasks.length > 0 && (
            <span className="px-1.5 py-0.5 bg-accent-blue/20 text-accent-blue text-[10px] rounded-full font-medium">
              {activeTasks.length} aktif
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {activeTasks.length > 0 && (
            <button onClick={cancelAll} className="p-1 text-dark-300 hover:text-red-400 transition" title="Tümünü İptal Et">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Metrics Bar */}
      {metrics && metrics.totalTasks > 0 && (
        <div className="flex items-center gap-3 px-3 py-1.5 border-b border-dark-600/50 text-[10px] flex-shrink-0">
          <span className="text-accent-green flex items-center gap-0.5">
            <CircleCheckBig className="w-3 h-3" />{metrics.completedTasks}
          </span>
          {metrics.failedTasks > 0 && (
            <span className="text-red-400 flex items-center gap-0.5">
              <CircleX className="w-3 h-3" />{metrics.failedTasks}
            </span>
          )}
          <span className="text-dark-400 flex items-center gap-0.5">
            <BarChart3 className="w-3 h-3" />Ort: {(metrics.avgDurationMs / 1000).toFixed(1)}s
          </span>
          <span className="text-dark-400">Toplam: {metrics.totalTasks}</span>
        </div>
      )}

      {/* Task List */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {tasks.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center p-4">
            <Cpu className="w-8 h-8 text-dark-400 mb-2" />
            <p className="text-dark-200 text-xs font-medium">Görev Motoru Hazır</p>
            <p className="text-dark-400 text-[10px] mt-1">AI görevleri burada görünecek</p>
          </div>
        )}

        {/* Running */}
        {grouped.running.length > 0 && (
          <div>
            <div className="px-3 py-1 text-[10px] text-accent-blue font-semibold uppercase tracking-wider bg-dark-700/30 flex items-center gap-1">
              <Play className="w-3 h-3" /> Çalışan ({grouped.running.length})
            </div>
            {grouped.running.map(t => <TaskRow key={t.id} task={t} />)}
          </div>
        )}

        {/* Queued */}
        {grouped.queued.length > 0 && (
          <div>
            <div className="px-3 py-1 text-[10px] text-yellow-400 font-semibold uppercase tracking-wider bg-dark-700/30 flex items-center gap-1">
              <Clock className="w-3 h-3" /> Kuyrukta ({grouped.queued.length})
            </div>
            {grouped.queued.map(t => <TaskRow key={t.id} task={t} />)}
          </div>
        )}

        {/* Recent */}
        {grouped.recent.length > 0 && (
          <div>
            <div className="px-3 py-1 text-[10px] text-dark-300 font-semibold uppercase tracking-wider bg-dark-700/30">
              Son ({grouped.recent.length})
            </div>
            {grouped.recent.map(t => <TaskRow key={t.id} task={t} />)}
          </div>
        )}
      </div>
    </div>
  );
};
