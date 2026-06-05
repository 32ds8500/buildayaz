import React, { useCallback, useState, useEffect, useRef } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import { EditorTabs } from './EditorTabs';
import { analyzeFile } from '../services/errorAgent';
import { Code2, Sparkles, Loader2, ShieldCheck } from 'lucide-react';
import { useEditorStore } from '../store/editorStore';
import { useActiveFileContent } from '../store/selectors';
import { useProjectStore } from '../store/projectStore';

type MonacoEditor = Parameters<OnMount>[0];
type Monaco = Parameters<OnMount>[1];

export const CodeEditor: React.FC = () => {
  const { activeFile, openFiles } = useEditorStore();
  const { updateFileContent } = useProjectStore();
  const [editorReady, setEditorReady] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [diagCount, setDiagCount] = useState({ errors: 0, warnings: 0 });
  const editorRef = useRef<MonacoEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const decorationsRef = useRef<string[]>([]);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleEditorChange = useCallback((value: string | undefined) => {
    if (activeFile && value !== undefined) {
      updateFileContent(activeFile.path, value);
    }
  }, [activeFile, updateFileContent]);

  // ── Monaco'ya inline diagnostics marker/decorator uygula ──
  const applyDiagnostics = useCallback((content: string, filename: string) => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;

    const model = editor.getModel();
    if (!model) return;

    const diags = analyzeFile(content, filename);

    // Monaco markers (kırmızı/sarı alt çizgi)
    const markers = diags.map(d => ({
      severity: d.severity === 'error' ? monaco.MarkerSeverity.Error
        : d.severity === 'warning' ? monaco.MarkerSeverity.Warning
        : d.severity === 'info' ? monaco.MarkerSeverity.Info
        : monaco.MarkerSeverity.Hint,
      message: `[${d.code}] ${d.message}`,
      startLineNumber: d.line,
      startColumn: d.col,
      endLineNumber: d.endLine,
      endColumn: d.endCol || d.col + 10,
      source: d.source,
    }));

    monaco.editor.setModelMarkers(model, 'kodyap-agent', markers);

    // Inline decorations — hatalı satırları vurgula
    const newDecorations = diags.map((d): Parameters<typeof editor.deltaDecorations>[1][0] => ({
      range: new monaco.Range(d.line, 1, d.line, 1),
      options: {
        isWholeLine: true,
        className: d.severity === 'error' ? 'line-error-bg' : d.severity === 'warning' ? 'line-warning-bg' : '',
        glyphMarginClassName: d.severity === 'error' ? 'glyph-error' : d.severity === 'warning' ? 'glyph-warning' : d.severity === 'info' ? 'glyph-info' : '',
        overviewRuler: {
          color: d.severity === 'error' ? '#ef4444' : d.severity === 'warning' ? '#f59e0b' : '#3b82f6',
          position: monaco.editor.OverviewRulerLane.Right,
        },
      },
    }));

    decorationsRef.current = editor.deltaDecorations(decorationsRef.current, newDecorations);

    setDiagCount({
      errors: diags.filter(d => d.severity === 'error').length,
      warnings: diags.filter(d => d.severity === 'warning').length,
    });
  }, []);

  // Dosya değiştiğinde veya içerik değiştiğinde diagnostics uygula
  useEffect(() => {
    if (!activeFile || !editorReady) return;
    const timer = setTimeout(() => {
      applyDiagnostics(activeFile.content || '', activeFile.name);
    }, 800);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFile?.content, activeFile?.name, editorReady, applyDiagnostics]);

  if (openFiles.length === 0 || !activeFile) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-dark-800 text-dark-300 p-4">
        <div className="mb-4 sm:mb-6">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-dark-700 flex items-center justify-center mx-auto">
            <Code2 className="w-8 h-8 sm:w-10 sm:h-10 text-dark-400" />
          </div>
        </div>
        <h3 className="text-base sm:text-lg font-semibold text-dark-200 mb-2">Dosya Seçilmedi</h3>
        <p className="text-xs sm:text-sm text-dark-300 text-center max-w-xs">
          Sol panelden bir dosya seçin veya AI asistanla yeni bir dosya oluşturun
        </p>
        <div className="flex flex-col gap-2 text-xs text-dark-400 mt-4 sm:mt-6">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI ile kod oluşturmak için sohbet panelini kullanın</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-dark-800 overflow-hidden">
      <EditorTabs />
      <div className="flex-1 min-h-0 relative">
        {!editorReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-dark-800 z-10">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 text-accent-blue animate-spin" />
              <span className="text-dark-200 text-sm">Editör yükleniyor...</span>
            </div>
          </div>
        )}
        <Editor
          key={activeFile.path}
          height="100%"
          language={activeFile.language || 'plaintext'}
          value={activeFile.content || ''}
          onChange={handleEditorChange}
          theme="vs-dark"
          loading={null}
          options={{
            fontSize: isMobile ? 12 : 14,
            fontFamily: "'JetBrains Mono', monospace",
            minimap: { enabled: !isMobile, maxColumn: 80 },
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            lineNumbers: isMobile ? 'off' : 'on',
            renderLineHighlight: 'all',
            cursorBlinking: 'smooth',
            cursorSmoothCaretAnimation: 'on',
            smoothScrolling: true,
            padding: { top: 8, bottom: 8 },
            bracketPairColorization: { enabled: true },
            autoClosingBrackets: 'always',
            autoClosingQuotes: 'always',
            formatOnPaste: true,
            tabSize: 2,
            suggestOnTriggerCharacters: true,
            quickSuggestions: !isMobile,
            folding: !isMobile,
            foldingHighlight: true,
            links: true,
            colorDecorators: true,
            glyphMargin: !isMobile,
            lineDecorationsWidth: isMobile ? 4 : 14,
            lineNumbersMinChars: isMobile ? 2 : 3,
            overviewRulerBorder: false,
            scrollbar: {
              verticalScrollbarSize: isMobile ? 4 : 8,
              horizontalScrollbarSize: isMobile ? 4 : 8,
            },
          }}
          beforeMount={(monaco) => {
            monaco.editor.defineTheme('kodyap-dark', {
              base: 'vs-dark',
              inherit: true,
              rules: [
                { token: 'comment', foreground: '5a5a75', fontStyle: 'italic' },
                { token: 'keyword', foreground: 'c792ea' },
                { token: 'string', foreground: 'c3e88d' },
                { token: 'number', foreground: 'f78c6c' },
                { token: 'type', foreground: 'ffcb6b' },
                { token: 'function', foreground: '82aaff' },
                { token: 'variable', foreground: 'eeffff' },
                { token: 'tag', foreground: 'f07178' },
                { token: 'attribute.name', foreground: 'ffcb6b' },
                { token: 'attribute.value', foreground: 'c3e88d' },
              ],
              colors: {
                'editor.background': '#12121a',
                'editor.foreground': '#e0e0f0',
                'editor.lineHighlightBackground': '#1a1a2e',
                'editor.selectionBackground': '#3b82f640',
                'editor.inactiveSelectionBackground': '#3b82f620',
                'editorCursor.foreground': '#3b82f6',
                'editorLineNumber.foreground': '#3a3a55',
                'editorLineNumber.activeForeground': '#8a8aa5',
                'editorIndentGuide.background': '#1a1a2e',
                'editorIndentGuide.activeBackground': '#2a2a45',
                'editor.selectionHighlightBackground': '#3b82f615',
                'editorBracketMatch.background': '#3b82f620',
                'editorBracketMatch.border': '#3b82f650',
                'editorOverviewRuler.errorForeground': '#ef4444',
                'editorOverviewRuler.warningForeground': '#f59e0b',
                'editorOverviewRuler.infoForeground': '#3b82f6',
              },
            });
          }}
          onMount={(editor, monaco) => {
            editorRef.current = editor;
            monacoRef.current = monaco;
            monaco.editor.setTheme('kodyap-dark');
            setEditorReady(true);

            // Ctrl+S
            editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => { /* auto-save */ });

            // İlk analiz
            if (activeFile) {
              setTimeout(() => applyDiagnostics(activeFile.content || '', activeFile.name), 300);
            }
          }}
        />
      </div>
      {/* Status bar */}
      <div className="flex items-center justify-between px-3 py-1 bg-dark-700 border-t border-dark-600 text-[10px] sm:text-xs text-dark-300 flex-shrink-0">
        <div className="flex items-center gap-2 sm:gap-3">
          <span>{activeFile.language || 'Düz Metin'}</span>
          <span className="hidden sm:inline">UTF-8</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Inline diagnostic count */}
          {(diagCount.errors > 0 || diagCount.warnings > 0) ? (
            <span className="flex items-center gap-1.5">
              {diagCount.errors > 0 && <span className="text-red-400 flex items-center gap-0.5"><span>✕</span>{diagCount.errors}</span>}
              {diagCount.warnings > 0 && <span className="text-yellow-400 flex items-center gap-0.5"><span>⚠</span>{diagCount.warnings}</span>}
            </span>
          ) : (
            <span className="text-accent-green flex items-center gap-1"><ShieldCheck className="w-3 h-3" />Temiz</span>
          )}
          <span className="hidden sm:inline">Boşluk: 2</span>
          <span className="text-accent-green text-[9px]">● Kaydedildi</span>
        </div>
      </div>
    </div>
  );
};
