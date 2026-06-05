import React, { useState, useMemo, useEffect } from 'react';
import { FileNode } from '../store/useStore';
import { useAIStore } from '../store/aiStore';
import { FileTree } from './FileTree';
import { CodeEditor } from './CodeEditor';
import { ChatPanel } from './ChatPanel';
import { TerminalPanel } from './TerminalPanel';
import { PreviewPanel } from './PreviewPanel';
import { DiagnosticsPanel } from './DiagnosticsPanel';
import { TaskPanel } from './TaskPanel';
import { AISettingsModal } from './AISettingsModal';
import { exportProjectAsZip } from '../services/importService';
import { analyzeProject } from '../services/errorAgent';
import { ErrorBoundary } from './ErrorBoundary';
import { useZipExport } from '../hooks/useZipExport';
import { Group as PanelGroup, Panel, Separator as PanelResizeHandle } from 'react-resizable-panels';
import toast from 'react-hot-toast';
import {
import { useProjectStore } from '../store/projectStore';
import { useUIStore } from '../store/uiStore';
import { useEditorStore } from '../store/editorStore';
  Zap, FolderTree, Search, GitBranch, Puzzle,
  MessageSquare, Terminal, Eye, ChevronLeft,
  Menu, X, Play, Download,
  Home, PanelLeftClose, PanelLeft,
  Code2, Monitor, Bot, ShieldCheck, Cpu
} from 'lucide-react';

type MobileTab = 'editor' | 'preview' | 'chat' | 'terminal';

export const Workspace: React.FC = () => {
  const { currentProject } = useProjectStore();
  const { sidebarOpen, chatOpen, terminalOpen, previewOpen, toggleSidebar, toggleChat, toggleTerminal, togglePreview, activePanel, setActivePanel, setView, mobileMenuOpen, toggleMobileMenu } = useUIStore();
  const { activeFile } = useEditorStore();

  const [mobileTab, setMobileTab] = useState<MobileTab>('editor');
  const [isMobileView, setIsMobileView] = useState(() => window.innerWidth < 1024);
  const { exportZip, isExporting } = useZipExport();
  const [showAISettings, setShowAISettings] = useState(false);

  // Reactive mobile detection
  useEffect(() => {
    const handler = () => setIsMobileView(window.innerWidth < 1024);
    window.addEventListener('resize', handler, { passive: true });
    return () => window.removeEventListener('resize', handler);
  }, []);
  // isMobileView drives CSS class selection (lg:hidden / lg:flex)
  void isMobileView;
  const aiConfigured = useAIStore(s => s.isConfigured);

  // Canlı hata sayacı — must be before early return (Rules of Hooks)
  const diagCounts = useMemo(() => {
    if (!currentProject) return { errors: 0, warnings: 0 };
    const flat: { name: string; path: string; content: string }[] = [];
    const walk = (nodes: FileNode[]) => { for (const n of nodes) { if (n.type === 'file' && n.content) flat.push({ name: n.name, path: n.path, content: n.content }); if (n.children) walk(n.children); } };
    walk(currentProject.files);
    const report = analyzeProject(flat);
    return {
      errors: report.diagnostics.filter(d => d.severity === 'error').length,
      warnings: report.diagnostics.filter(d => d.severity === 'warning').length,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProject]);

  if (!currentProject) return null;

  const sidebarIcons = [
    { id: 'files' as const, icon: <FolderTree className="w-5 h-5" />, label: 'Dosyalar' },
    { id: 'search' as const, icon: <Search className="w-5 h-5" />, label: 'Ara' },
    { id: 'diagnostics' as const, icon: <div className="relative"><ShieldCheck className="w-5 h-5" />{(diagCounts.errors + diagCounts.warnings) > 0 && <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-red-500 border border-dark-800 text-[7px] text-white flex items-center justify-center font-bold">{diagCounts.errors + diagCounts.warnings > 9 ? '!' : diagCounts.errors + diagCounts.warnings}</span>}</div>, label: 'Kod Analizi' },
    { id: 'tasks' as const, icon: <Cpu className="w-5 h-5" />, label: 'Görev Motoru' },
    { id: 'git' as const, icon: <GitBranch className="w-5 h-5" />, label: 'Git' },
    { id: 'extensions' as const, icon: <Puzzle className="w-5 h-5" />, label: 'Eklentiler' },
  ];

  const handleExportZip = async () => {
    if (!currentProject) return;
    try {
      await exportProjectAsZip(currentProject);
      toast.success('Proje ZIP olarak indirildi!');
    } catch (err) {
      console.warn('[Workspace] ZIP export failed:', err);
      toast.error('ZIP oluşturulurken hata oluştu');
    }
  };

  return (
    <div className="h-full w-full flex flex-col bg-dark-900 overflow-hidden">
      {/* Top Bar */}
      <header className="h-10 min-h-[40px] flex items-center justify-between px-2 bg-dark-700 border-b border-dark-600 flex-shrink-0 z-30">
        <div className="flex items-center gap-1 min-w-0">
          {/* Mobile menu */}
          <button
            onClick={toggleMobileMenu}
            className="lg:hidden p-1.5 rounded hover:bg-dark-500 text-dark-200 flex-shrink-0"
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
          
          <button
            onClick={() => setView('landing')}
            className="flex items-center gap-1.5 px-1.5 py-1 rounded hover:bg-dark-500 transition flex-shrink-0"
          >
            <div className="w-5 h-5 rounded gradient-bg flex items-center justify-center">
              <Zap className="w-3 h-3 text-white" />
            </div>
            <span className="text-xs font-bold text-white hidden sm:inline">KodYap</span>
          </button>

          <div className="w-px h-4 bg-dark-500 mx-0.5 hidden sm:block flex-shrink-0" />

          <button
            onClick={() => setView('landing')}
            className="p-1.5 rounded hover:bg-dark-500 text-dark-300 hover:text-white transition hidden sm:block flex-shrink-0"
            title="Ana Sayfa"
          >
            <Home className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center min-w-0 flex-1 justify-center mx-1">
          <button
            onClick={() => {
              // Trigger Ctrl+K programmatically
              window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
            }}
            className="flex items-center gap-1.5 px-3 py-1 bg-dark-600/50 hover:bg-dark-500/50 rounded-lg text-xs text-dark-200 truncate max-w-[220px] sm:max-w-md transition cursor-pointer border border-transparent hover:border-dark-400"
          >
            <Search className="w-3 h-3 flex-shrink-0 text-dark-300" />
            <span className="truncate">{currentProject.name}</span>
            {activeFile && (
              <>
                <ChevronLeft className="w-3 h-3 rotate-180 flex-shrink-0 hidden sm:block" />
                <span className="truncate text-white hidden sm:block">{activeFile.name}</span>
              </>
            )}
            <kbd className="hidden sm:inline-flex ml-auto px-1.5 py-0.5 bg-dark-600 rounded text-[9px] text-dark-300 font-mono border border-dark-500">⌘K</kbd>
          </button>
        </div>

        <div className="flex items-center gap-0.5 flex-shrink-0">
          {/* Desktop toggles */}
          <button
            onClick={togglePreview}
            className={`hidden lg:block p-1.5 rounded transition ${previewOpen ? 'bg-accent-blue/20 text-accent-blue' : 'text-dark-300 hover:text-white hover:bg-dark-500'}`}
            title="Önizleme"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={toggleChat}
            className={`hidden lg:block p-1.5 rounded transition ${chatOpen ? 'bg-accent-purple/20 text-accent-purple' : 'text-dark-300 hover:text-white hover:bg-dark-500'}`}
            title="AI Sohbet"
          >
            <MessageSquare className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={toggleTerminal}
            className={`hidden lg:block p-1.5 rounded transition ${terminalOpen ? 'bg-accent-green/20 text-accent-green' : 'text-dark-300 hover:text-white hover:bg-dark-500'}`}
            title="Terminal"
          >
            <Terminal className="w-3.5 h-3.5" />
          </button>

          <div className="w-px h-4 bg-dark-500 mx-0.5 hidden sm:block" />

          <button className="p-1.5 rounded text-dark-300 hover:text-accent-green hover:bg-dark-500 transition hidden sm:block" title="Çalıştır">
            <Play className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleExportZip}
            className="p-1.5 rounded text-dark-300 hover:text-white hover:bg-dark-500 transition"
            title="ZIP olarak indir"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setShowAISettings(true)}
            className={`p-1.5 rounded transition hidden sm:block ${aiConfigured ? 'text-accent-green hover:bg-dark-500' : 'text-accent-orange hover:bg-dark-500 animate-pulse'}`}
            title={aiConfigured ? 'AI Ayarları (yapılandırıldı)' : 'AI Ayarları (API key gerekli)'}
          >
            <Cpu className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        {/* Activity Bar (sidebar icons) - Desktop Only */}
        <div className="hidden lg:flex flex-col items-center w-12 bg-dark-800 border-r border-dark-600 py-2 gap-1 flex-shrink-0">
          <button
            onClick={toggleSidebar}
            className="p-2 rounded-lg text-dark-300 hover:text-white hover:bg-dark-600 transition mb-2"
            title={sidebarOpen ? 'Paneli Kapat' : 'Paneli Aç'}
          >
            {sidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeft className="w-4 h-4" />}
          </button>
          
          {sidebarIcons.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                if (activePanel === item.id && sidebarOpen) {
                  toggleSidebar();
                } else {
                  setActivePanel(item.id);
                  if (!sidebarOpen) toggleSidebar();
                }
              }}
              className={`p-2 rounded-lg transition ${
                activePanel === item.id && sidebarOpen
                  ? 'text-white bg-dark-600 border-l-2 border-accent-blue'
                  : 'text-dark-300 hover:text-white hover:bg-dark-600'
              }`}
              title={item.label}
            >
              {item.icon}
            </button>
          ))}
        </div>

        {/* Mobile Sidebar Overlay */}
        {mobileMenuOpen && (
          <div className="lg:hidden fixed inset-0 z-40 flex" style={{ top: '40px' }}>
            <div className="w-72 max-w-[80vw] bg-dark-800 border-r border-dark-600 flex flex-col animate-slide-in h-full">
              <div className="p-3 border-b border-dark-600 flex items-center justify-between flex-shrink-0">
                <span className="text-sm font-semibold text-white">Dosyalar</span>
                <button onClick={toggleMobileMenu} className="p-1 rounded hover:bg-dark-600 text-dark-300">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <FileTree />
              </div>
            </div>
            <div className="flex-1 bg-black/50" onClick={toggleMobileMenu} />
          </div>
        )}

        {/* Desktop Layout */}
        <div className="hidden lg:flex flex-1 min-w-0 min-h-0">
          <PanelGroup orientation="horizontal">
            {sidebarOpen && (
              <>
                <Panel defaultSize={18} minSize={12} maxSize={30}>
                  <div className="h-full bg-dark-800 border-r border-dark-600 flex flex-col overflow-hidden">
                    <div className="px-3 py-2 border-b border-dark-600 flex-shrink-0">
                      <span className="text-xs font-semibold text-dark-200 uppercase tracking-wider">
                        {activePanel === 'files' && 'Gezgin'}
                        {activePanel === 'search' && 'Arama'}
                        {activePanel === 'diagnostics' && 'Kod Analizi'}
                        {activePanel === 'tasks' && 'Görev Motoru'}
                        {activePanel === 'git' && 'Kaynak Kontrol'}
                        {activePanel === 'extensions' && 'Eklentiler'}
                      </span>
                    </div>
                    <div className="flex-1 overflow-y-auto min-h-0">
                      {activePanel === 'files' && <FileTree />}
                      {activePanel === 'search' && <SearchPanel />}
                      {activePanel === 'diagnostics' && <DiagnosticsPanel />}
                      {activePanel === 'tasks' && <TaskPanel />}
                      {activePanel === 'git' && <GitPanel />}
                      {activePanel === 'extensions' && <ExtensionsPanel />}
                    </div>
                  </div>
                </Panel>
                <PanelResizeHandle className="w-1 bg-dark-600 hover:bg-accent-blue/50 transition-colors cursor-col-resize" />
              </>
            )}

            <Panel defaultSize={chatOpen || previewOpen ? 45 : 82} minSize={25}>
              <PanelGroup orientation="vertical">
                <Panel defaultSize={terminalOpen ? 70 : 100} minSize={25}>
                  <ErrorBoundary fallbackLabel="Kod Editörü">
                    <CodeEditor />
                  </ErrorBoundary>
                </Panel>
                {terminalOpen && (
                  <>
                    <PanelResizeHandle className="h-1 bg-dark-600 hover:bg-accent-blue/50 transition-colors cursor-row-resize" />
                    <Panel defaultSize={30} minSize={12} maxSize={55}>
                      <ErrorBoundary fallbackLabel="Terminal">
                        <TerminalPanel />
                      </ErrorBoundary>
                    </Panel>
                  </>
                )}
              </PanelGroup>
            </Panel>

            {(chatOpen || previewOpen) && (
              <>
                <PanelResizeHandle className="w-1 bg-dark-600 hover:bg-accent-blue/50 transition-colors cursor-col-resize" />
                <Panel defaultSize={37} minSize={18} maxSize={55}>
                  {chatOpen && previewOpen ? (
                    <PanelGroup orientation="vertical">
                      <Panel defaultSize={50} minSize={20}>
                        <ErrorBoundary fallbackLabel="Önizleme">
                          <PreviewPanel />
                        </ErrorBoundary>
                      </Panel>
                      <PanelResizeHandle className="h-1 bg-dark-600 hover:bg-accent-blue/50 transition-colors cursor-row-resize" />
                      <Panel defaultSize={50} minSize={20}>
                        <ErrorBoundary fallbackLabel="Sohbet">
                          <ChatPanel />
                        </ErrorBoundary>
                      </Panel>
                    </PanelGroup>
                  ) : chatOpen ? (
                    <ErrorBoundary fallbackLabel="Sohbet">
                      <ChatPanel />
                    </ErrorBoundary>
                  ) : (
                    <ErrorBoundary fallbackLabel="Önizleme">
                      <PreviewPanel />
                    </ErrorBoundary>
                  )}
                </Panel>
              </>
            )}
          </PanelGroup>
        </div>

        {/* Mobile Layout - Tab based */}
        <div className="lg:hidden flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="flex-1 min-h-0 overflow-hidden">
            {mobileTab === 'editor' && (
              <ErrorBoundary fallbackLabel="Kod Editörü">
                <CodeEditor />
              </ErrorBoundary>
            )}
            {mobileTab === 'preview' && (
              <ErrorBoundary fallbackLabel="Önizleme">
                <PreviewPanel />
              </ErrorBoundary>
            )}
            {mobileTab === 'chat' && (
              <ErrorBoundary fallbackLabel="Sohbet">
                <ChatPanel />
              </ErrorBoundary>
            )}
            {mobileTab === 'terminal' && (
              <ErrorBoundary fallbackLabel="Terminal">
                <TerminalPanel />
              </ErrorBoundary>
            )}
          </div>

          {/* Mobile Bottom Tab Bar */}
          <div className="flex-shrink-0 bg-dark-800 border-t border-dark-600 safe-bottom">
            <div className="flex items-center justify-around h-12">
              <button
                onClick={() => setMobileTab('editor')}
                className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1 rounded-lg transition ${
                  mobileTab === 'editor' ? 'text-accent-blue' : 'text-dark-300'
                }`}
              >
                <Code2 className="w-5 h-5" />
                <span className="text-[9px] font-medium">Editör</span>
              </button>
              <button
                onClick={() => setMobileTab('preview')}
                className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1 rounded-lg transition ${
                  mobileTab === 'preview' ? 'text-accent-blue' : 'text-dark-300'
                }`}
              >
                <Monitor className="w-5 h-5" />
                <span className="text-[9px] font-medium">Önizleme</span>
              </button>
              <button
                onClick={() => setMobileTab('chat')}
                className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1 rounded-lg transition ${
                  mobileTab === 'chat' ? 'text-accent-purple' : 'text-dark-300'
                }`}
              >
                <Bot className="w-5 h-5" />
                <span className="text-[9px] font-medium">AI</span>
              </button>
              <button
                onClick={() => setMobileTab('terminal')}
                className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1 rounded-lg transition ${
                  mobileTab === 'terminal' ? 'text-accent-green' : 'text-dark-300'
                }`}
              >
                <Terminal className="w-5 h-5" />
                <span className="text-[9px] font-medium">Terminal</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Status Bar - Desktop only */}
      <footer className="hidden lg:flex h-6 items-center justify-between px-3 bg-accent-blue text-white text-[10px] flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <GitBranch className="w-3 h-3" />
            main
          </span>
          <button
            onClick={() => { setActivePanel('diagnostics'); if (!sidebarOpen) toggleSidebar(); }}
            className="flex items-center gap-2 hover:opacity-80 transition"
          >
            {diagCounts.errors > 0 && <span className="flex items-center gap-0.5">✕ {diagCounts.errors} Hata</span>}
            {diagCounts.warnings > 0 && <span className="flex items-center gap-0.5">⚠ {diagCounts.warnings} Uyarı</span>}
            {diagCounts.errors === 0 && diagCounts.warnings === 0 && <span className="flex items-center gap-0.5">✓ Sorun yok</span>}
          </button>
        </div>
        <div className="flex items-center gap-3">
          <span>{activeFile?.language || 'Düz Metin'}</span>
          <span>UTF-8</span>
          <span>Boşluk: 2</span>
        </div>
      </footer>

      {/* AI Settings Modal */}
      {showAISettings && <AISettingsModal onClose={() => setShowAISettings(false)} />}
    </div>
  );
};

// Search Panel
const SearchPanel: React.FC = () => {
  const [query, setQuery] = useState('');
  // currentProject already destructured above
  const [results, setResults] = useState<{ path: string; line: string; lineNum: number }[]>([]);

  const handleSearch = () => {
    if (!query.trim() || !currentProject) return;
    const found: { path: string; line: string; lineNum: number }[] = [];
    
    const searchFiles = (nodes: typeof currentProject.files) => {
      for (const node of nodes) {
        if (node.type === 'file' && node.content) {
          const lines = node.content.split('\n');
          lines.forEach((line, i) => {
            if (line.toLowerCase().includes(query.toLowerCase())) {
              found.push({ path: node.path, line: line.trim(), lineNum: i + 1 });
            }
          });
        }
        if (node.children) searchFiles(node.children);
      }
    };
    
    searchFiles(currentProject.files);
    setResults(found.slice(0, 50));
  };

  return (
    <div className="p-3 space-y-3">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        placeholder="Dosyalarda ara..."
        className="w-full bg-dark-700 border border-dark-500 rounded-lg px-3 py-1.5 text-xs text-white placeholder-dark-300 outline-none focus:border-accent-blue"
      />
      <div className="space-y-1 overflow-y-auto">
        {results.map((r, i) => (
          <div key={i} className="p-2 rounded bg-dark-700/50 text-xs">
            <div className="text-accent-blue truncate">{r.path}:{r.lineNum}</div>
            <div className="text-dark-200 truncate mt-0.5 font-mono">{r.line}</div>
          </div>
        ))}
        {results.length === 0 && query && (
          <p className="text-dark-300 text-xs text-center py-4">Sonuç bulunamadı</p>
        )}
      </div>
    </div>
  );
};

// Git Panel
const GitPanel: React.FC = () => {
  return (
    <div className="p-3 space-y-4">
      <div className="flex items-center gap-2 text-xs text-dark-200">
        <GitBranch className="w-4 h-4 text-accent-blue" />
        <span className="font-medium text-white">main</span>
      </div>
      <div>
        <h4 className="text-xs font-medium text-dark-100 mb-2">Değişiklikler</h4>
        <div className="space-y-1">
          <div className="flex items-center gap-2 p-1.5 rounded hover:bg-dark-700/50 text-xs">
            <span className="w-4 h-4 rounded-full bg-accent-orange/20 text-accent-orange text-[10px] flex items-center justify-center font-bold">M</span>
            <span className="text-dark-200 truncate">src/App.tsx</span>
          </div>
          <div className="flex items-center gap-2 p-1.5 rounded hover:bg-dark-700/50 text-xs">
            <span className="w-4 h-4 rounded-full bg-accent-green/20 text-accent-green text-[10px] flex items-center justify-center font-bold">A</span>
            <span className="text-dark-200 truncate">src/components/Button.tsx</span>
          </div>
        </div>
      </div>
      <div>
        <input
          placeholder="Commit mesajı..."
          className="w-full bg-dark-700 border border-dark-500 rounded-lg px-3 py-1.5 text-xs text-white placeholder-dark-300 outline-none focus:border-accent-blue"
        />
        <button className="w-full mt-2 py-1.5 bg-accent-blue text-white rounded-lg text-xs font-medium hover:bg-blue-600 transition">
          ✓ Commit
        </button>
      </div>
    </div>
  );
};

// Extensions Panel
const ExtensionsPanel: React.FC = () => {
  const extensions = [
    { name: 'ESLint', desc: 'JavaScript/TypeScript linting', installed: true },
    { name: 'Prettier', desc: 'Kod biçimlendirici', installed: true },
    { name: 'Tailwind IntelliSense', desc: 'Tailwind otomatik tamamlama', installed: true },
    { name: 'Auto Rename Tag', desc: 'HTML/JSX tag adlandırma', installed: false },
    { name: 'GitLens', desc: 'Gelişmiş Git özellikleri', installed: false },
    { name: 'Error Lens', desc: 'Satır içi hata gösterimi', installed: false },
  ];

  return (
    <div className="p-3 space-y-3">
      <input
        placeholder="Eklenti ara..."
        className="w-full bg-dark-700 border border-dark-500 rounded-lg px-3 py-1.5 text-xs text-white placeholder-dark-300 outline-none focus:border-accent-blue"
      />
      <div className="space-y-2">
        {extensions.map((ext) => (
          <div key={ext.name} className="flex items-start gap-3 p-2 rounded-lg hover:bg-dark-700/50">
            <div className="w-8 h-8 rounded-lg bg-dark-600 flex items-center justify-center flex-shrink-0">
              <Puzzle className="w-4 h-4 text-accent-purple" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-white">{ext.name}</div>
              <div className="text-[10px] text-dark-300">{ext.desc}</div>
            </div>
            <button className={`px-2 py-0.5 rounded text-[10px] font-medium flex-shrink-0 ${
              ext.installed
                ? 'bg-accent-green/20 text-accent-green'
                : 'bg-dark-600 text-dark-200 hover:bg-accent-blue/20 hover:text-accent-blue'
            }`}>
              {ext.installed ? 'Yüklü' : 'Yükle'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
