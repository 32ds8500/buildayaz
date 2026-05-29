import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useStore } from '../store/useStore';
import { Terminal, Trash2, Plus, X, ChevronDown, ChevronUp } from 'lucide-react';
import { generateId } from './../shared/utils/id';

// ─── Types ────────────────────────────────────────────────────────────────────
interface TerminalSession {
  id: string;
  name: string;
  history: string[];
  historyIdx: number;
  lines: { text: string; type: LineType }[];
}

type LineType = 'input' | 'output' | 'error' | 'success' | 'info';

// ─── Command processor ────────────────────────────────────────────────────────
function processCommand(
  cmd: string,
  getFiles: () => string[],
): { text: string; type: LineType }[] {
  const t = cmd.trim();
  const tl = t.toLowerCase();

  if (!t) return [];

  if (tl === 'help' || tl === 'yardim') {
    return [
      { text: '┌─ KodYap Terminal ──────────────────────────────┐', type: 'info' },
      { text: '│  help / yardim        Bu yardım mesajı         │', type: 'info' },
      { text: '│  clear / cls          Ekranı temizle           │', type: 'info' },
      { text: '│  ls / dir             Dosyaları listele        │', type: 'info' },
      { text: '│  cat <dosya>          Dosya içeriğini göster   │', type: 'info' },
      { text: '│  pwd                  Dizini göster            │', type: 'info' },
      { text: '│  whoami               Kullanıcı bilgisi        │', type: 'info' },
      { text: '│  date                 Tarih/saat               │', type: 'info' },
      { text: '│  echo <metin>         Metin yazdır             │', type: 'info' },
      { text: '│  node -v / npm -v     Sürüm bilgisi           │', type: 'info' },
      { text: '│  npm install          Bağımlılıkları yükle     │', type: 'info' },
      { text: '│  npm run dev          Dev sunucusu başlat      │', type: 'info' },
      { text: '│  npm run build        Projeyi derle            │', type: 'info' },
      { text: '│  npm test             Testleri çalıştır        │', type: 'info' },
      { text: '│  git status/log/init  Git komutları            │', type: 'info' },
      { text: '└────────────────────────────────────────────────┘', type: 'info' },
    ];
  }

  if (tl === 'clear' || tl === 'cls') {
    return [{ text: '__CLEAR__', type: 'info' }];
  }

  if (tl === 'ls' || tl === 'dir') {
    const files = getFiles();
    if (!files.length) return [{ text: '(proje yok)', type: 'output' }];
    const entries = [...new Set(files.map(f => {
      const parts = f.split('/');
      return parts.length > 1 ? parts[0] + '/' : parts[0];
    }))];
    return entries.map(d => ({ text: d, type: (d.endsWith('/') ? 'info' : 'output') as LineType }));
  }

  if (tl === 'pwd') return [{ text: '/home/kodyap/proje', type: 'output' }];
  if (tl === 'whoami') return [{ text: 'kodyap', type: 'output' }];

  if (tl === 'date' || tl === 'tarih') {
    return [{ text: new Date().toLocaleString('tr-TR', { dateStyle: 'full', timeStyle: 'medium' }), type: 'output' }];
  }

  if (t.startsWith('echo ')) return [{ text: t.slice(5), type: 'output' }];

  if (tl === 'node -v' || tl === 'node --version') return [{ text: 'v20.11.0', type: 'output' }];
  if (tl === 'npm -v' || tl === 'npm --version') return [{ text: '10.2.4', type: 'output' }];

  if (tl === 'npm install' || tl === 'npm i') {
    return [
      { text: 'npm warn idealTree:proje No description', type: 'output' },
      { text: 'added 234 packages, and audited 235 packages in 8.2s', type: 'output' },
      { text: '42 packages are looking for funding', type: 'info' },
      { text: 'found 0 vulnerabilities', type: 'success' },
    ];
  }

  if (tl.startsWith('npm install ') || tl.startsWith('npm i ')) {
    const pkg = t.replace(/^npm\s+(install|i)\s+/, '');
    return [
      { text: `added 1 package: ${pkg}`, type: 'output' },
      { text: `✓ ${pkg} başarıyla yüklendi`, type: 'success' },
    ];
  }

  if (tl === 'npm run dev') {
    return [
      { text: '', type: 'output' },
      { text: '  VITE v7.0.0  ready in 342 ms', type: 'success' },
      { text: '', type: 'output' },
      { text: '  ➜  Local:   http://localhost:5173/', type: 'info' },
      { text: '  ➜  press h + enter to show help', type: 'output' },
    ];
  }

  if (tl === 'npm run build') {
    return [
      { text: 'vite v7.0.0 building for production...', type: 'output' },
      { text: '✓ 42 modules transformed.', type: 'success' },
      { text: 'dist/index.html                  0.46 kB', type: 'output' },
      { text: 'dist/assets/index.js           143.36 kB', type: 'output' },
      { text: '✓ built in 1.42s', type: 'success' },
    ];
  }

  if (tl === 'npm test') {
    return [
      { text: ' PASS  src/App.test.tsx', type: 'success' },
      { text: '  ✓ renders correctly (24 ms)', type: 'success' },
      { text: 'Tests: 1 passed, 1 total', type: 'success' },
    ];
  }

  if (tl.startsWith('npx ')) {
    return [
      { text: `Need to install: ${tl.slice(4)}`, type: 'info' },
      { text: '✓ Komut çalıştırıldı', type: 'success' },
    ];
  }

  if (tl === 'git status') {
    return [
      { text: 'On branch main', type: 'output' },
      { text: 'Changes not staged for commit:', type: 'info' },
      { text: '  modified:   src/App.tsx', type: 'output' },
      { text: 'no changes added to commit', type: 'info' },
    ];
  }

  if (tl === 'git init') return [{ text: 'Initialized empty Git repository in /proje/.git/', type: 'success' }];

  if (tl === 'git log' || tl === 'git log --oneline') {
    return [
      { text: '3a7f2b1 (HEAD -> main) Initial commit', type: 'output' },
      { text: '1c2d3e4 Add components', type: 'output' },
    ];
  }

  if (tl.startsWith('git commit')) {
    const msg = t.match(/-m\s+["'](.+?)["']/)?.[1] ?? 'Update';
    return [{ text: `[main 3a7f2b1] ${msg}`, type: 'success' }];
  }

  if (tl.startsWith('git ')) {
    return [{ text: `git: komut tamamlandı`, type: 'info' }];
  }

  if (tl === 'cat package.json') {
    return [
      { text: '{', type: 'output' },
      { text: '  "name": "kodyap-proje",', type: 'output' },
      { text: '  "version": "1.0.0"', type: 'output' },
      { text: '}', type: 'output' },
    ];
  }

  if (tl.startsWith('cat ')) {
    return [{ text: `cat: ${t.slice(4)}: Dosya bulunamadı (sanal fs)`, type: 'error' }];
  }

  return [
    { text: `bash: ${t.split(' ')[0]}: komut bulunamadı`, type: 'error' },
    { text: `'help' yazarak komut listesini görebilirsiniz.`, type: 'info' },
  ];
}

// ─── CSS class per line type ──────────────────────────────────────────────────
function lineTypeToCss(type: LineType): string {
  switch (type) {
    case 'input':   return 'text-emerald-400';
    case 'error':   return 'text-red-400';
    case 'success': return 'text-emerald-400';
    case 'info':    return 'text-cyan-400';
    default:        return 'text-slate-200';
  }
}

// ─── Session factory ──────────────────────────────────────────────────────────
function makeSession(): TerminalSession {
  return {
    id: generateId(),
    name: 'bash',
    history: [],
    historyIdx: -1,
    lines: [
      { text: '╔═══════════════════════════════════════╗', type: 'info' },
      { text: '║  KodYap Terminal  v2.0                ║', type: 'info' },
      { text: '╚═══════════════════════════════════════╝', type: 'info' },
      { text: "Yardım için 'help' yazın.", type: 'info' },
      { text: '', type: 'output' },
    ],
  };
}

// ─── XTerm renderer (lazy loaded) ────────────────────────────────────────────
interface SessionViewProps {
  session: TerminalSession;
  onUpdate: (id: string, fn: (s: TerminalSession) => TerminalSession) => void;
  getFiles: () => string[];
}

const XTermRenderer: React.FC<SessionViewProps> = ({ session, onUpdate, getFiles }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;

    let disposed = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let term: any = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let fit: any = null;
    let ro: ResizeObserver | null = null;

    (async () => {
      try {
        // Dynamically load xterm CSS
        if (!document.querySelector('link[data-xterm]')) {
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.setAttribute('data-xterm', '1');
          link.href = 'https://cdn.jsdelivr.net/npm/@xterm/xterm@5.5.0/css/xterm.css';
          document.head.appendChild(link);
        }

        const { Terminal: XTerm } = await import('@xterm/xterm');
        const { FitAddon }        = await import('@xterm/addon-fit');
        const { WebLinksAddon }   = await import('@xterm/addon-web-links');

        if (disposed || !containerRef.current) return;

        term = new XTerm({
          theme: {
            background:   '#0d1117',
            foreground:   '#c9d1d9',
            cursor:       '#58a6ff',
            cursorAccent: '#0d1117',
            selectionBackground: '#264f78',
            black: '#484f58', red: '#ff7b72', green: '#3fb950',
            yellow: '#d29922', blue: '#58a6ff', magenta: '#bc8cff',
            cyan: '#39c5cf', white: '#b1bac4',
            brightBlack: '#6e7681', brightRed: '#ffa198', brightGreen: '#56d364',
            brightYellow: '#e3b341', brightBlue: '#79c0ff', brightMagenta: '#d2a8ff',
            brightCyan: '#56d4dd', brightWhite: '#f0f6fc',
          },
          fontFamily: '"JetBrains Mono", "Cascadia Code", "Fira Code", Consolas, monospace',
          fontSize: 12,
          lineHeight: 1.4,
          cursorBlink: true,
          cursorStyle: 'bar',
          allowTransparency: true,
          scrollback: 2000,
          convertEol: true,
        });

        fit = new FitAddon();
        term.loadAddon(fit);
        term.loadAddon(new WebLinksAddon());
        term.open(containerRef.current);
        fit.fit();

        // Replay history
        for (const line of session.lines) {
          if (line.type === 'input') {
            term.writeln(`\x1b[32m$ ${line.text.replace(/^\$ /, '')}\x1b[0m`);
          } else if (line.type === 'error') {
            term.writeln(`\x1b[31m${line.text}\x1b[0m`);
          } else if (line.type === 'success') {
            term.writeln(`\x1b[32m${line.text}\x1b[0m`);
          } else if (line.type === 'info') {
            term.writeln(`\x1b[36m${line.text}\x1b[0m`);
          } else {
            term.writeln(`\x1b[37m${line.text}\x1b[0m`);
          }
        }
        term.write(`\x1b[32m❯\x1b[0m \x1b[34m~/proje\x1b[0m \x1b[32m$\x1b[0m `);

        // Input state (local to this terminal instance)
        let currentInput = '';
        let histIdx = -1;
        let localHistory: string[] = [...session.history];

        term.onData((data: string) => {
          const code = data.charCodeAt(0);

          if (data === '\r') {
            // Enter
            const cmd = currentInput;
            currentInput = '';
            histIdx = -1;
            term.write('\r\n');

            if (cmd.trim()) {
              localHistory = [cmd, ...localHistory].slice(0, 100);
              term.write(`\x1b[32m$ ${cmd}\x1b[0m\r\n`);

              const results = processCommand(cmd, getFiles);

              if (results.some(r => r.text === '__CLEAR__')) {
                term.clear();
                onUpdate(session.id, s => ({ ...s, lines: [], history: localHistory }));
              } else {
                for (const r of results) {
                  const color = r.type === 'error' ? '\x1b[31m'
                    : r.type === 'success' ? '\x1b[32m'
                    : r.type === 'info'    ? '\x1b[36m'
                    : '\x1b[37m';
                  term.writeln(`${color}${r.text}\x1b[0m`);
                }
                onUpdate(session.id, s => ({
                  ...s,
                  history: localHistory,
                  lines: [...s.lines, { text: `$ ${cmd}`, type: 'input' as LineType }, ...results],
                }));
              }
            }

            term.write(`\x1b[32m❯\x1b[0m \x1b[34m~/proje\x1b[0m \x1b[32m$\x1b[0m `);

          } else if (data === '\x7f') {
            // Backspace
            if (currentInput.length > 0) {
              currentInput = currentInput.slice(0, -1);
              term.write('\b \b');
            }

          } else if (data === '\x1b[A') {
            // Arrow up
            if (localHistory.length > 0) {
              const ni = histIdx === -1 ? 0 : Math.min(histIdx + 1, localHistory.length - 1);
              histIdx = ni;
              const entry = localHistory[ni];
              term.write('\r\x1b[K');
              term.write(`\x1b[32m❯\x1b[0m \x1b[34m~/proje\x1b[0m \x1b[32m$\x1b[0m ${entry}`);
              currentInput = entry;
            }

          } else if (data === '\x1b[B') {
            // Arrow down
            if (histIdx > 0) {
              histIdx--;
              const entry = localHistory[histIdx];
              term.write('\r\x1b[K');
              term.write(`\x1b[32m❯\x1b[0m \x1b[34m~/proje\x1b[0m \x1b[32m$\x1b[0m ${entry}`);
              currentInput = entry;
            } else if (histIdx === 0) {
              histIdx = -1;
              term.write('\r\x1b[K');
              term.write(`\x1b[32m❯\x1b[0m \x1b[34m~/proje\x1b[0m \x1b[32m$\x1b[0m `);
              currentInput = '';
            }

          } else if (data === '\t') {
            // Tab completion
            const completions = ['help', 'clear', 'cls', 'ls', 'dir', 'pwd', 'whoami',
              'date', 'echo ', 'node -v', 'npm install', 'npm run dev', 'npm run build',
              'npm test', 'git status', 'git init', 'git log', 'cat '];
            const match = completions.find(c => c.startsWith(currentInput));
            if (match) {
              const add = match.slice(currentInput.length);
              term.write(add);
              currentInput += add;
            }

          } else if (data === '\x03') {
            // Ctrl+C
            term.write('^C\r\n');
            currentInput = '';
            histIdx = -1;
            term.write(`\x1b[32m❯\x1b[0m \x1b[34m~/proje\x1b[0m \x1b[32m$\x1b[0m `);

          } else if (data === '\x0c') {
            // Ctrl+L
            term.clear();
            term.write(`\x1b[32m❯\x1b[0m \x1b[34m~/proje\x1b[0m \x1b[32m$\x1b[0m `);
            currentInput = '';

          } else if (code >= 32) {
            currentInput += data;
            term.write(data);
          }
        });

        // Resize observer
        ro = new ResizeObserver(() => {
          try { fit?.fit(); } catch { /* ignore */ }
        });
        if (containerRef.current?.parentElement) {
          ro.observe(containerRef.current.parentElement);
        }

      } catch (err) {
        console.warn('[TerminalPanel] xterm load failed:', err);
      }
    })();

    return () => {
      disposed = true;
      ro?.disconnect();
      try { term?.dispose(); } catch { /* ignore */ }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id]);

  return (
    <div ref={containerRef} className="h-full w-full" style={{ padding: '2px' }} />
  );
};

// ─── Fallback: pure-CSS terminal (no xterm dependency) ───────────────────────
const FallbackRenderer: React.FC<SessionViewProps> = ({ session, onUpdate, getFiles }) => {
  const [input, setInput] = useState('');
  const [histIdx, setHistIdx] = useState(-1);
  const bottomRef  = useRef<HTMLDivElement>(null);
  const inputElRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [session.lines.length]);

  const submit = useCallback(() => {
    const cmd = input;
    setInput('');
    setHistIdx(-1);

    const results = processCommand(cmd, getFiles);

    if (results.some(r => r.text === '__CLEAR__')) {
      onUpdate(session.id, s => ({
        ...s,
        lines: [],
        history: cmd.trim() ? [cmd, ...s.history].slice(0, 100) : s.history,
      }));
    } else {
      onUpdate(session.id, s => ({
        ...s,
        history: cmd.trim() ? [cmd, ...s.history].slice(0, 100) : s.history,
        lines: [
          ...s.lines,
          ...(cmd.trim() ? [{ text: `$ ${cmd}`, type: 'input' as LineType }] : []),
          ...results,
        ],
      }));
    }
  }, [input, session.id, onUpdate, getFiles]);

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { submit(); return; }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!session.history.length) return;
      const ni = histIdx === -1 ? 0 : Math.min(histIdx + 1, session.history.length - 1);
      setHistIdx(ni); setInput(session.history[ni]);
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (histIdx <= 0) { setHistIdx(-1); setInput(''); }
      else { const ni = histIdx - 1; setHistIdx(ni); setInput(session.history[ni]); }
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      const cmds = ['help', 'clear', 'ls', 'pwd', 'whoami', 'date', 'echo ',
        'node -v', 'npm install', 'npm run dev', 'npm run build', 'npm test',
        'git status', 'git init', 'git log'];
      const match = cmds.find(c => c.startsWith(input));
      if (match) setInput(match);
    }
    if (e.ctrlKey && e.key === 'l') {
      e.preventDefault();
      onUpdate(session.id, s => ({ ...s, lines: [] }));
    }
  };

  return (
    <div
      className="h-full flex flex-col bg-[#0d1117] font-mono text-xs overflow-hidden cursor-text select-text"
      onClick={() => inputElRef.current?.focus()}
    >
      <div className="flex-1 overflow-y-auto p-3 space-y-0.5 min-h-0">
        {session.lines.map((line, i) => (
          <div
            key={i}
            className={`whitespace-pre-wrap leading-5 ${lineTypeToCss(line.type)}`}
          >
            {line.text}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      {/* Input row */}
      <div className="flex items-center gap-1.5 px-3 py-2 border-t border-slate-700/40 bg-[#0d1117] flex-shrink-0">
        <span className="text-emerald-400 select-none">❯</span>
        <span className="text-blue-400 select-none">~/proje</span>
        <span className="text-emerald-400 select-none">$</span>
        <input
          ref={inputElRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          className="flex-1 bg-transparent outline-none text-slate-100 caret-blue-400 ml-0.5"
          spellCheck={false}
          autoComplete="off"
          autoFocus
        />
      </div>
    </div>
  );
};

// ─── Smart renderer: tries xterm, falls back ─────────────────────────────────
const SessionView: React.FC<SessionViewProps> = (props) => {
  const [xtermAvailable, setXtermAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    import('@xterm/xterm')
      .then(() => setXtermAvailable(true))
      .catch(() => setXtermAvailable(false));
  }, []);

  if (xtermAvailable === null) {
    // Loading state — show fallback immediately, xterm will take over
    return <FallbackRenderer {...props} />;
  }

  return xtermAvailable
    ? <XTermRenderer {...props} />
    : <FallbackRenderer {...props} />;
};

// ─── Main TerminalPanel ───────────────────────────────────────────────────────
export const TerminalPanel: React.FC = () => {
  const { currentProject } = useStore();
  const [sessions, setSessions] = useState<TerminalSession[]>(() => [makeSession()]);
  const [activeId, setActiveId] = useState<string>(() => sessions[0].id);
  const [isMinimized, setIsMinimized] = useState(false);

  const activeSession = sessions.find(s => s.id === activeId) ?? sessions[0];

  const getFiles = useCallback((): string[] => {
    if (!currentProject) return [];
    const collect = (nodes: typeof currentProject.files, prefix = ''): string[] =>
      nodes.flatMap(n =>
        n.type === 'file'
          ? [`${prefix}${n.name}`]
          : [`${prefix}${n.name}/`, ...collect(n.children ?? [], `${prefix}${n.name}/`)]
      );
    return collect(currentProject.files);
  }, [currentProject]);

  const updateSession = useCallback((id: string, fn: (s: TerminalSession) => TerminalSession) => {
    setSessions(prev => prev.map(s => s.id === id ? fn(s) : s));
  }, []);

  const addSession = () => {
    const s = makeSession();
    setSessions(prev => [...prev, s]);
    setActiveId(s.id);
  };

  const closeSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSessions(prev => {
      const next = prev.filter(s => s.id !== id);
      if (next.length === 0) {
        const fresh = makeSession();
        setActiveId(fresh.id);
        return [fresh];
      }
      if (activeId === id) setActiveId(next[next.length - 1].id);
      return next;
    });
  };

  const clearActive = () => {
    updateSession(activeId, s => ({ ...s, lines: [] }));
  };

  return (
    <div className="h-full flex flex-col bg-[#0d1117] overflow-hidden">
      {/* Tab bar */}
      <div className="flex items-center justify-between px-2 py-1 bg-[#161b22] border-b border-slate-700/60 flex-shrink-0 min-h-[32px]">
        <div className="flex items-center gap-0.5 flex-1 overflow-x-auto min-w-0">
          <Terminal className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mr-1.5" />
          {sessions.map(s => (
            <button
              key={s.id}
              onClick={() => setActiveId(s.id)}
              className={`group flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-medium whitespace-nowrap transition-all flex-shrink-0 ${
                s.id === activeId
                  ? 'bg-slate-700 text-emerald-400 shadow-sm'
                  : 'text-slate-500 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              {s.name}
              {sessions.length > 1 && (
                <X
                  className="w-2.5 h-2.5 opacity-0 group-hover:opacity-60 hover:!opacity-100 hover:text-red-400 transition-opacity"
                  onClick={e => closeSession(s.id, e)}
                />
              )}
            </button>
          ))}
          <button
            onClick={addSession}
            className="p-1 ml-0.5 rounded text-slate-600 hover:text-slate-300 hover:bg-slate-800/60 transition flex-shrink-0"
            title="Yeni terminal oturumu (Ctrl+Shift+`)"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-0.5 flex-shrink-0 ml-2">
          <button
            onClick={clearActive}
            className="p-1 rounded text-slate-500 hover:text-slate-200 hover:bg-slate-700/60 transition"
            title="Temizle (Ctrl+L)"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setIsMinimized(v => !v)}
            className="p-1 rounded text-slate-500 hover:text-slate-200 hover:bg-slate-700/60 transition"
            title={isMinimized ? 'Genişlet' : 'Küçült'}
          >
            {isMinimized
              ? <ChevronUp className="w-3.5 h-3.5" />
              : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Content */}
      {!isMinimized && (
        <div className="flex-1 min-h-0 overflow-hidden">
          <SessionView
            key={activeSession.id}
            session={activeSession}
            onUpdate={updateSession}
            getFiles={getFiles}
          />
        </div>
      )}
    </div>
  );
};
