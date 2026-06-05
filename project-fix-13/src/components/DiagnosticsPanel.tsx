import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { FileNode } from '../store/useStore';
import { analyzeProject, applyFix, applyAllFixes, Diagnostic, AgentReport, Severity } from '../services/errorAgent';
import toast from 'react-hot-toast';
import {
import { useProjectStore } from '../store/projectStore';
import { useEditorStore } from '../store/editorStore';
  TriangleAlert, Info, Lightbulb, Wrench,
  CircleCheckBig, CircleX, ChevronDown, ChevronRight,
  Zap, RefreshCw, Filter, FileCode2, Shield, Sparkles
} from 'lucide-react';

function flatFiles(nodes: FileNode[]): { name: string; path: string; content: string }[] {
  const r: { name: string; path: string; content: string }[] = [];
  for (const n of nodes) {
    if (n.type === 'file' && n.content) r.push({ name: n.name, path: n.path, content: n.content });
    if (n.children) r.push(...flatFiles(n.children));
  }
  return r;
}

const severityIcon = (s: Severity) => {
  switch (s) {
    case 'error': return <CircleX className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />;
    case 'warning': return <TriangleAlert className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />;
    case 'info': return <Info className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />;
    case 'hint': return <Lightbulb className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />;
  }
};

const severityColor = (s: Severity) => {
  switch (s) {
    case 'error': return 'border-red-500/30 bg-red-500/5';
    case 'warning': return 'border-yellow-500/30 bg-yellow-500/5';
    case 'info': return 'border-blue-500/30 bg-blue-500/5';
    case 'hint': return 'border-purple-500/30 bg-purple-500/5';
  }
};

const scoreColor = (score: number) => {
  if (score >= 90) return 'text-green-400';
  if (score >= 70) return 'text-yellow-400';
  if (score >= 50) return 'text-orange-400';
  return 'text-red-400';
};

const scoreRing = (score: number) => {
  if (score >= 90) return 'border-green-400';
  if (score >= 70) return 'border-yellow-400';
  if (score >= 50) return 'border-orange-400';
  return 'border-red-400';
};

export const DiagnosticsPanel: React.FC = () => {
  const { currentProject, updateFileContent } = useProjectStore();
  const { openFile } = useEditorStore();
  const [report, setReport] = useState<AgentReport | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [filterSev, setFilterSev] = useState<Severity | 'all'>('all');
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const [autoMode, setAutoMode] = useState(true);
  const [lastAnalyzed, setLastAnalyzed] = useState(0);

  const runAnalysis = useCallback(() => {
    if (!currentProject) return;
    setAnalyzing(true);
    // requestIdleCallback gibi davran
    setTimeout(() => {
      const files = flatFiles(currentProject.files);
      const r = analyzeProject(files);
      setReport(r);
      setAnalyzing(false);
      setLastAnalyzed(Date.now());
      // İlk dosyayı otomatik genişlet
      const fileSet = new Set<string>();
      r.diagnostics.forEach(d => fileSet.add(d.file));
      setExpandedFiles(fileSet);
    }, 100);
  }, [currentProject]);

  // Otomatik analiz — dosya değişikliğinde
  useEffect(() => {
    if (!autoMode || !currentProject) return;
    const timer = setTimeout(() => {
      runAnalysis();
    }, 1500); // 1.5sn debounce
    return () => clearTimeout(timer);
  }, [currentProject?.files, autoMode, runAnalysis]);

  // İlk mount'ta analiz (deferred to avoid setState-in-effect lint warning)
  useEffect(() => {
    if (currentProject && !report) {
      const t = setTimeout(() => runAnalysis(), 0);
      return () => clearTimeout(t);
    }
  }, [currentProject, report, runAnalysis]);

  const filtered = useMemo(() => {
    if (!report) return [];
    if (filterSev === 'all') return report.diagnostics;
    return report.diagnostics.filter(d => d.severity === filterSev);
  }, [report, filterSev]);

  const groupedByFile = useMemo(() => {
    const map = new Map<string, Diagnostic[]>();
    filtered.forEach(d => {
      if (!map.has(d.file)) map.set(d.file, []);
      map.get(d.file)!.push(d);
    });
    return map;
  }, [filtered]);

  const counts = useMemo(() => {
    if (!report) return { error: 0, warning: 0, info: 0, hint: 0, fixable: 0 };
    return {
      error: report.diagnostics.filter(d => d.severity === 'error').length,
      warning: report.diagnostics.filter(d => d.severity === 'warning').length,
      info: report.diagnostics.filter(d => d.severity === 'info').length,
      hint: report.diagnostics.filter(d => d.severity === 'hint').length,
      fixable: report.diagnostics.filter(d => d.fix).length,
    };
  }, [report]);

  const handleFix = useCallback((diag: Diagnostic) => {
    if (!diag.fix || !currentProject) return;
    // Dosyayı bul
    const findFile = (nodes: FileNode[]): FileNode | null => {
      for (const n of nodes) {
        if (n.name === diag.file) return n;
        if (n.children) { const f = findFile(n.children); if (f) return f; }
      }
      return null;
    };
    const file = findFile(currentProject.files);
    if (!file || !file.content) return;

    const newContent = applyFix(file.content, diag.fix);
    updateFileContent(file.path, newContent);
    toast.success(`✓ Düzeltildi: ${diag.code}`);

    // Yeniden analiz
    setTimeout(runAnalysis, 300);
  }, [currentProject, updateFileContent, runAnalysis]);

  const handleFixAll = useCallback(() => {
    if (!currentProject || !report) return;
    const fileMap = new Map<string, FileNode>();
    const findAll = (nodes: FileNode[]) => {
      for (const n of nodes) {
        if (n.type === 'file') fileMap.set(n.name, n);
        if (n.children) findAll(n.children);
      }
    };
    findAll(currentProject.files);

    let fixCount = 0;
    const grouped = new Map<string, Diagnostic[]>();
    report.diagnostics.filter(d => d.fix).forEach(d => {
      if (!grouped.has(d.file)) grouped.set(d.file, []);
      grouped.get(d.file)!.push(d);
    });

    grouped.forEach((diags, fileName) => {
      const file = fileMap.get(fileName);
      if (!file || !file.content) return;
      const newContent = applyAllFixes(file.content, diags);
      updateFileContent(file.path, newContent);
      fixCount += diags.length;
    });

    if (fixCount > 0) {
      toast.success(`✓ ${fixCount} sorun otomatik düzeltildi!`);
      setTimeout(runAnalysis, 300);
    } else {
      toast('Düzeltilebilir sorun bulunamadı', { icon: 'ℹ️' });
    }
  }, [currentProject, report, updateFileContent, runAnalysis]);

  const handleGoToFile = (diag: Diagnostic) => {
    if (!currentProject) return;
    const findFile = (nodes: FileNode[]): FileNode | null => {
      for (const n of nodes) {
        if (n.name === diag.file) return n;
        if (n.children) { const f = findFile(n.children); if (f) return f; }
      }
      return null;
    };
    const file = findFile(currentProject.files);
    if (file) openFile(file);
  };

  const toggleFile = (file: string) => {
    setExpandedFiles(prev => {
      const next = new Set(prev);
      if (next.has(file)) next.delete(file); else next.add(file);
      return next;
    });
  };

  return (
    <div className="h-full flex flex-col bg-dark-800 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-dark-600 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-accent-blue" />
          <span className="text-xs font-semibold text-white">Kod Analizi</span>
          {analyzing && <RefreshCw className="w-3 h-3 text-accent-blue animate-spin" />}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setAutoMode(!autoMode)}
            className={`p-1 rounded text-[10px] font-medium transition ${autoMode ? 'bg-accent-green/20 text-accent-green' : 'bg-dark-600 text-dark-300'}`}
            title={autoMode ? 'Otomatik analiz açık' : 'Otomatik analiz kapalı'}
          >
            <Zap className="w-3 h-3" />
          </button>
          <button
            onClick={runAnalysis}
            className="p-1 rounded text-dark-300 hover:text-white hover:bg-dark-600 transition"
            title="Yeniden analiz et"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Score Card */}
      {report && (
        <div className="px-3 py-3 border-b border-dark-600 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl border-2 ${scoreRing(report.score)} flex items-center justify-center flex-shrink-0`}>
              <span className={`text-lg font-bold ${scoreColor(report.score)}`}>{report.score}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-white font-medium">{report.summary}</p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {counts.error > 0 && <span className="text-[10px] text-red-400 flex items-center gap-0.5"><CircleX className="w-3 h-3" />{counts.error}</span>}
                {counts.warning > 0 && <span className="text-[10px] text-yellow-400 flex items-center gap-0.5"><TriangleAlert className="w-3 h-3" />{counts.warning}</span>}
                {counts.info > 0 && <span className="text-[10px] text-blue-400 flex items-center gap-0.5"><Info className="w-3 h-3" />{counts.info}</span>}
                {counts.hint > 0 && <span className="text-[10px] text-purple-400 flex items-center gap-0.5"><Lightbulb className="w-3 h-3" />{counts.hint}</span>}
              </div>
            </div>
          </div>

          {/* Fix All Button */}
          {counts.fixable > 0 && (
            <button
              onClick={handleFixAll}
              className="w-full mt-2 flex items-center justify-center gap-1.5 px-3 py-2 bg-accent-blue/10 hover:bg-accent-blue/20 border border-accent-blue/20 rounded-lg text-accent-blue text-xs font-medium transition"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Tümünü Düzelt ({counts.fixable} sorun)
            </button>
          )}
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-dark-600 flex-shrink-0 overflow-x-auto no-scrollbar">
        <Filter className="w-3 h-3 text-dark-300 flex-shrink-0 mr-1" />
        {(['all', 'error', 'warning', 'info', 'hint'] as const).map(s => (
          <button
            key={s}
            onClick={() => setFilterSev(s)}
            className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition flex-shrink-0 ${
              filterSev === s
                ? s === 'error' ? 'bg-red-500/20 text-red-400'
                : s === 'warning' ? 'bg-yellow-500/20 text-yellow-400'
                : s === 'info' ? 'bg-blue-500/20 text-blue-400'
                : s === 'hint' ? 'bg-purple-500/20 text-purple-400'
                : 'bg-dark-500 text-white'
                : 'bg-dark-600/50 text-dark-300 hover:text-white'
            }`}
          >
            {s === 'all' ? `Hepsi (${report?.diagnostics.length || 0})` : s === 'error' ? `Hata (${counts.error})` : s === 'warning' ? `Uyarı (${counts.warning})` : s === 'info' ? `Bilgi (${counts.info})` : `İpucu (${counts.hint})`}
          </button>
        ))}
      </div>

      {/* Diagnostics List */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {!report && !analyzing && (
          <div className="flex flex-col items-center justify-center h-full text-center p-4">
            <Shield className="w-10 h-10 text-dark-400 mb-3" />
            <p className="text-dark-200 text-sm font-medium mb-1">Kod Analizi</p>
            <p className="text-dark-300 text-xs">Analiz butonu ile kodunuzu tarayın</p>
          </div>
        )}

        {report && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center p-4">
            <CircleCheckBig className="w-10 h-10 text-green-400 mb-3" />
            <p className="text-white text-sm font-medium mb-1">Sorun Bulunamadı!</p>
            <p className="text-dark-300 text-xs">Kodunuz temiz görünüyor 🎉</p>
          </div>
        )}

        {Array.from(groupedByFile.entries()).map(([fileName, diags]) => (
          <div key={fileName} className="border-b border-dark-600/50">
            <button
              onClick={() => toggleFile(fileName)}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-dark-700/50 transition text-left"
            >
              {expandedFiles.has(fileName) ? <ChevronDown className="w-3 h-3 text-dark-300" /> : <ChevronRight className="w-3 h-3 text-dark-300" />}
              <FileCode2 className="w-3.5 h-3.5 text-accent-blue flex-shrink-0" />
              <span className="text-xs text-white font-medium truncate">{fileName}</span>
              <span className="text-[10px] text-dark-400 ml-auto flex-shrink-0">{diags.length}</span>
            </button>

            {expandedFiles.has(fileName) && (
              <div className="pb-1">
                {diags.map(d => (
                  <div
                    key={d.id}
                    className={`mx-2 mb-1 px-3 py-2 rounded-lg border ${severityColor(d.severity)} cursor-pointer hover:opacity-80 transition`}
                    onClick={() => handleGoToFile(d)}
                  >
                    <div className="flex items-start gap-2">
                      {severityIcon(d.severity)}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-white leading-relaxed">{d.message}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-dark-400">Satır {d.line}</span>
                          <span className="text-[10px] text-dark-400 bg-dark-600 px-1.5 rounded">{d.code}</span>
                          <span className="text-[10px] text-dark-400">{d.category}</span>
                        </div>
                      </div>
                      {d.fix && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleFix(d); }}
                          className="flex items-center gap-1 px-2 py-1 bg-accent-blue/10 hover:bg-accent-blue/20 text-accent-blue rounded-lg text-[10px] font-medium transition flex-shrink-0"
                          title={d.fix.description}
                        >
                          <Wrench className="w-3 h-3" />
                          Düzelt
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      {lastAnalyzed > 0 && (
        <div className="px-3 py-1.5 border-t border-dark-600 flex items-center justify-between text-[10px] text-dark-400 flex-shrink-0">
          <span>Son analiz: {new Date(lastAnalyzed).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
          <span className="flex items-center gap-1">
            {autoMode && <><Zap className="w-3 h-3 text-accent-green" />Otomatik</>}
          </span>
        </div>
      )}
    </div>
  );
};
