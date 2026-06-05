import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FileNode } from '../store/useStore';
import {
import { useProjectStore } from '../store/projectStore';
import { useUIStore } from '../store/uiStore';
import { useEditorStore, flattenFileTree } from '../store/editorStore';
  Search, FileCode2, Terminal, Eye, MessageSquare,
  FolderTree, Home, GitBranch, Zap,
  Plus, ShieldCheck
} from 'lucide-react';


interface Command {
  id: string;
  label: string;
  desc?: string;
  icon: React.ReactNode;
  action: () => void;
  category: 'file' | 'action' | 'nav';
}

export const CommandPalette: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const { currentProject } = useProjectStore();
  const { openFile } = useEditorStore();
  const { setView, toggleChat, toggleTerminal, togglePreview, toggleSidebar } = useUIStore();

  // Global shortcut Ctrl+K / Cmd+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(prev => !prev);
        setQuery('');
        setSelectedIndex(0);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  const commands: Command[] = [];

  // Dosya arama
  if (currentProject) {
    const files = flattenFileTree(currentProject.files);
    files.forEach(f => {
      commands.push({
        id: 'file-' + f.path,
        label: f.name,
        desc: f.path,
        icon: <FileCode2 className="w-4 h-4 text-blue-400" />,
        action: () => { openFile(f); setOpen(false); },
        category: 'file',
      });
    });
  }

  // Eylemler
  commands.push(
    { id: 'toggle-terminal', label: 'Terminal Aç/Kapat', icon: <Terminal className="w-4 h-4 text-green-400" />, action: () => { toggleTerminal(); setOpen(false); }, category: 'action' },
    { id: 'toggle-preview', label: 'Önizleme Aç/Kapat', icon: <Eye className="w-4 h-4 text-cyan-400" />, action: () => { togglePreview(); setOpen(false); }, category: 'action' },
    { id: 'toggle-chat', label: 'AI Sohbet Aç/Kapat', icon: <MessageSquare className="w-4 h-4 text-purple-400" />, action: () => { toggleChat(); setOpen(false); }, category: 'action' },
    { id: 'toggle-sidebar', label: 'Kenar Çubuğu Aç/Kapat', icon: <FolderTree className="w-4 h-4 text-yellow-400" />, action: () => { toggleSidebar(); setOpen(false); }, category: 'action' },
    { id: 'go-home', label: 'Ana Sayfaya Git', icon: <Home className="w-4 h-4 text-orange-400" />, action: () => { setView('landing'); setOpen(false); }, category: 'nav' },
    { id: 'new-project', label: 'Yeni Proje Oluştur', icon: <Plus className="w-4 h-4 text-blue-400" />, action: () => { setView('landing'); setOpen(false); }, category: 'nav' },
    { id: 'git-status', label: 'Git Durumu', icon: <GitBranch className="w-4 h-4 text-orange-400" />, action: () => { setOpen(false); }, category: 'action' },
    { id: 'diagnostics', label: 'Kod Analizi Aç', desc: 'Otomatik hata ayıklama', icon: <ShieldCheck className="w-4 h-4 text-red-400" />, action: () => { const s = useStore.getState(); s.setActivePanel('diagnostics'); if (!s.sidebarOpen) s.toggleSidebar(); setOpen(false); }, category: 'action' },
  );

  const filtered = query
    ? commands.filter(c => c.label.toLowerCase().includes(query.toLowerCase()) || (c.desc || '').toLowerCase().includes(query.toLowerCase()))
    : commands;

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(i => Math.min(i + 1, filtered.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(i => Math.max(i - 1, 0)); }
    if (e.key === 'Enter' && filtered[selectedIndex]) { filtered[selectedIndex].action(); }
  }, [filtered, selectedIndex]);

  // scroll selected into view
  useEffect(() => {
    const el = listRef.current?.children[selectedIndex] as HTMLElement;
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[15vh] px-4" onClick={() => setOpen(false)}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-xl bg-dark-800 border border-dark-500 rounded-2xl shadow-2xl overflow-hidden animate-fade-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-dark-600">
          <Search className="w-5 h-5 text-dark-300 flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setSelectedIndex(0); }}
            onKeyDown={handleKeyDown}
            placeholder="Dosya ara, komut çalıştır..."
            className="flex-1 bg-transparent text-white text-sm outline-none placeholder-dark-300"
          />
          <kbd className="px-2 py-0.5 bg-dark-600 rounded text-[10px] text-dark-200 font-mono">ESC</kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-80 overflow-y-auto py-2">
          {filtered.length === 0 && (
            <div className="px-4 py-8 text-center text-dark-300 text-sm">Sonuç bulunamadı</div>
          )}
          {filtered.map((cmd, i) => (
            <button
              key={cmd.id}
              onClick={cmd.action}
              onMouseEnter={() => setSelectedIndex(i)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition ${
                i === selectedIndex ? 'bg-accent-blue/10 text-white' : 'text-dark-100 hover:bg-dark-700'
              }`}
            >
              <span className="flex-shrink-0">{cmd.icon}</span>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium">{cmd.label}</span>
                {cmd.desc && <span className="text-xs text-dark-300 ml-2 truncate">{cmd.desc}</span>}
              </div>
              <span className="text-[10px] text-dark-400 flex-shrink-0">
                {cmd.category === 'file' ? 'Dosya' : cmd.category === 'action' ? 'Eylem' : 'Git'}
              </span>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-dark-600 text-[10px] text-dark-300">
          <div className="flex items-center gap-3">
            <span>↑↓ Gezin</span>
            <span>↵ Seç</span>
            <span>ESC Kapat</span>
          </div>
          <div className="flex items-center gap-1">
            <Zap className="w-3 h-3 text-accent-blue" />
            <span>KodYap</span>
          </div>
        </div>
      </div>
    </div>
  );
};
