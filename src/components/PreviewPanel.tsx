import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { FileNode } from '../store/useStore';
import {
import { useProjectStore } from '../store/projectStore';
import { flattenFileTree } from '../store/editorStore';
  Globe, RefreshCw, Smartphone, Monitor, Tablet,
  ExternalLink, Maximize2, Minimize2, TriangleAlert,
} from 'lucide-react';

type DeviceMode = 'desktop' | 'tablet' | 'mobile';

// ─── File tree flattener ──────────────────────────────────────────────────────

// ─── HTML builder ─────────────────────────────────────────────────────────────
function buildPreviewHtml(files: FileNode[]): string {
  const all = flattenFileTree(files);

  // ── Pure HTML project ──
  const htmlFile = all.find(
    f => f.name.toLowerCase().endsWith('.html') && /index/i.test(f.name)
  ) ?? all.find(f => f.name.toLowerCase().endsWith('.html'));

  if (htmlFile?.content) {
    let html = htmlFile.content;
    const cssContent = all
      .filter(f => f.name.endsWith('.css'))
      .map(f => f.content ?? '')
      .join('\n');
    const jsContent = all
      .filter(f => f.name.endsWith('.js') && !/\.config\.js$/.test(f.name))
      .map(f => f.content ?? '')
      .join('\n');

    // Remove existing local asset refs
    html = html
      .replace(/<link[^>]*href=["'][^"']*\.css["'][^>]*>/g, '')
      .replace(/<script[^>]*src=["'][^"']*\.(js|ts|jsx|tsx)["'][^>]*><\/script>/g, '');

    if (cssContent) {
      html = html.replace('</head>', `<style>${cssContent}</style></head>`);
    }
    if (jsContent) {
      html = html.replace('</body>', `<script>${jsContent}</script></body>`);
    }
    return html;
  }

  // ── React / JSX project ──
  const tsxFiles = all.filter(f => /\.(tsx|jsx)$/.test(f.name));
  const appFile  = tsxFiles.find(f => /^App\.(tsx|jsx)$/.test(f.name))
    ?? tsxFiles.find(f => /^page\.(tsx|jsx)$/.test(f.name));

  if (appFile?.content) {
    const cssContent = all
      .filter(f => f.name.endsWith('.css'))
      .map(f => f.content ?? '')
      .join('\n');

    // ── Convert JSX → static HTML ──────────────────────────────────────────
    let jsx = '';

    // Try to extract the outermost JSX return
    const returnMatch = appFile.content.match(/return\s*\(\s*([\s\S]*?)\s*\);\s*\}/);
    if (returnMatch) {
      jsx = returnMatch[1];
    } else {
      // Fallback: scan for first top-level JSX tag
      const tagMatch = appFile.content.match(/<([A-Z][a-zA-Z]*)[\s\S]*?<\/\1>/);
      jsx = tagMatch ? tagMatch[0] : '<div><h1>React Uygulaması</h1><p>Düzenleyin, önizleme güncellenir.</p></div>';
    }

    // Sanitise JSX for static rendering
    jsx = jsx
      // className → class
      .replace(/className=/g, 'class=')
      // Remove event handlers
      .replace(/\s+on[A-Z][a-zA-Z]*=\{[^}]*\}/g, '')
      // Remove import/require references left as {Foo} → empty
      .replace(/\{[A-Z][a-zA-Z]*\}/g, '')
      // Replace {expression} with safe placeholders
      .replace(/\{`[^`]*`\}/g, '…')
      .replace(/\{'[^']*'\}/g, '')
      .replace(/\{"[^"]*"\}/g, '')
      .replace(/\{([a-zA-Z_$][a-zA-Z0-9_.]*)\}/g, (_m, name) => {
        const lower = name.toLowerCase();
        if (/count|sayac|num|idx|index|id/.test(lower)) return '0';
        if (/text|title|name|label|msg|message/.test(lower)) return '…';
        return '';
      })
      // Remove remaining bare expressions
      .replace(/\{[^}]{0,120}\}/g, '')
      // Self-closing → paired
      .replace(/<([a-zA-Z][a-zA-Z0-9]*)([^>]*?)\/>/g, '<$1$2></$1>')
      // Strip TypeScript generics in JSX position
      .replace(/<[A-Z][a-zA-Z]*</g, s => s.replace(/<[A-Z][a-zA-Z]*/, ''))
      // Comments
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

    return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com data: blob:; script-src 'unsafe-inline' https://cdn.tailwindcss.com; style-src 'unsafe-inline' https://cdn.tailwindcss.com;">
  <title>Önizleme — ${appFile.name}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { margin: 0; font-family: system-ui, -apple-system, sans-serif; }
    ${cssContent}
  </style>
</head>
<body>
  ${jsx}
</body>
</html>`;
  }

  // ── Node/Express API project ──
  const serverFile = all.find(f =>
    /^(index|server|app)\.(ts|js)$/.test(f.name) && f.content?.includes('express')
  );
  if (serverFile) {
    // Extract route paths via regex
    const routeRe = /\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)/gi;
    const routes: { method: string; path: string }[] = [];
    let m: RegExpExecArray | null;
    while ((m = routeRe.exec(serverFile.content ?? '')) !== null) {
      routes.push({ method: m[1].toUpperCase(), path: m[2] });
    }

    const routeHtml = routes.length
      ? routes.map(r => `
          <div class="route">
            <span class="method ${r.method.toLowerCase()}">${r.method}</span>
            <span class="path">${r.path}</span>
          </div>`).join('')
      : '<div class="route"><span class="method get">GET</span><span class="path">/</span></div>';

    return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <title>API Önizleme</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:system-ui,sans-serif;background:#0f172a;color:#e2e8f0;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:2rem}
    .card{max-width:520px;width:100%}
    h1{font-size:1.75rem;font-weight:700;margin-bottom:.5rem}
    .badge{display:inline-flex;align-items:center;gap:.375rem;padding:.25rem .75rem;background:#22c55e1a;color:#22c55e;border-radius:999px;font-size:.8rem;margin-bottom:1.5rem}
    .dot{width:8px;height:8px;border-radius:50%;background:#22c55e;animation:pulse 1.5s infinite}
    @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
    .route{display:flex;align-items:center;gap:.75rem;background:#1e293b;border:1px solid #334155;border-radius:.5rem;padding:.75rem 1rem;margin:.4rem 0}
    .method{font-weight:700;font-size:.75rem;padding:.15rem .5rem;border-radius:.25rem;min-width:52px;text-align:center}
    .get{background:#22c55e1a;color:#22c55e}
    .post{background:#3b82f61a;color:#60a5fa}
    .put{background:#f59e0b1a;color:#fbbf24}
    .delete{background:#ef44441a;color:#f87171}
    .patch{background:#a855f71a;color:#c084fc}
    .path{color:#93c5fd;font-family:monospace;font-size:.85rem}
  </style>
</head>
<body>
  <div class="card">
    <h1>🚀 API Sunucusu</h1>
    <div class="badge"><span class="dot"></span> Çalışıyor · Port 3000</div>
    ${routeHtml}
  </div>
</body>
</html>`;
  }

  // ── Generic empty state ──
  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Önizleme</title>
  <style>
    body{margin:0;font-family:system-ui,sans-serif;background:#0f172a;color:#e2e8f0;display:flex;align-items:center;justify-content:center;min-height:100vh;flex-direction:column;gap:1rem;text-align:center;padding:2rem}
    svg{opacity:.3;margin-bottom:.5rem}
    h2{font-size:1.25rem;font-weight:600;color:#94a3b8}
    p{font-size:.875rem;color:#475569;max-width:320px}
  </style>
</head>
<body>
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
    <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
  </svg>
  <h2>Önizleme Hazır</h2>
  <p>Bir dosya düzenleyin — önizleme otomatik olarak güncellenecektir.</p>
</body>
</html>`;
}

// ─── Component ────────────────────────────────────────────────────────────────
export const PreviewPanel: React.FC = () => {
  const { currentProject } = useProjectStore();
  const [deviceMode, setDeviceMode] = useState<DeviceMode>('desktop');
  const [refreshKey, setRefreshKey]   = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [iframeError, setIframeError]   = useState(false);
  const iframeRef  = useRef<HTMLIFrameElement>(null);

  // Build HTML whenever files change or user hits refresh
  const previewHtml = useMemo(() => {
    if (!currentProject) return '';
    return buildPreviewHtml(currentProject.files);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProject?.files, refreshKey]);

  // Create/revoke blob URL in an effect (never in render/useMemo)
  const [blobUrl, setBlobUrl] = useState('');

  useEffect(() => {
    if (!previewHtml) {
      setBlobUrl('');
      return;
    }
    const url = URL.createObjectURL(new Blob([previewHtml], { type: 'text/html' }));
    setBlobUrl(url);
    setIframeError(false);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [previewHtml]);

  const handleRefresh = useCallback(() => {
    setIframeError(false);
    setRefreshKey(k => k + 1);
  }, []);

  const openExternal = useCallback(() => {
    if (blobUrl) window.open(blobUrl, '_blank', 'noopener');
  }, [blobUrl]);

  const deviceConfig: Record<DeviceMode, { width: string; label: string }> = {
    desktop: { width: '100%',  label: 'Masaüstü' },
    tablet:  { width: '768px', label: 'Tablet'    },
    mobile:  { width: '375px', label: 'Mobil'     },
  };

  const hostUrl = 'http://localhost:5173';

  return (
    <div className={`h-full flex flex-col bg-[#0d1117] ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}>
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#161b22] border-b border-slate-700/60 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Globe className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-xs text-slate-300 font-medium">Önizleme</span>
        </div>
        <div className="flex items-center gap-0.5">
          {/* Device switcher */}
          {(['mobile', 'tablet', 'desktop'] as const).map(d => (
            <button
              key={d}
              onClick={() => setDeviceMode(d)}
              className={`p-1.5 rounded transition ${
                deviceMode === d
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/60'
              }`}
              title={deviceConfig[d].label}
            >
              {d === 'mobile'  && <Smartphone className="w-3.5 h-3.5" />}
              {d === 'tablet'  && <Tablet className="w-3.5 h-3.5" />}
              {d === 'desktop' && <Monitor className="w-3.5 h-3.5" />}
            </button>
          ))}
          <div className="w-px h-4 bg-slate-700 mx-1" />
          <button
            onClick={handleRefresh}
            className="p-1.5 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-800/60 transition"
            title="Yenile"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setIsFullscreen(v => !v)}
            className="p-1.5 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-800/60 transition"
            title={isFullscreen ? 'Küçült' : 'Tam ekran'}
          >
            {isFullscreen
              ? <Minimize2 className="w-3.5 h-3.5" />
              : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={openExternal}
            disabled={!blobUrl}
            className="p-1.5 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-800/60 transition disabled:opacity-30"
            title="Yeni sekmede aç"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── Address bar ── */}
      <div className="flex items-center gap-2 px-3 py-1 bg-[#161b22]/70 border-b border-slate-700/40 flex-shrink-0">
        <div className="flex items-center gap-1.5 flex-1 bg-slate-800/60 rounded-md px-2.5 py-1 border border-slate-700/40">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${blobUrl ? 'bg-emerald-400' : 'bg-slate-600'}`} />
          <span className="flex-1 text-xs text-slate-400 truncate select-none">
            {blobUrl ? hostUrl : 'Proje yok'}
          </span>
        </div>
      </div>

      {/* ── Viewport ── */}
      <div className="flex-1 flex items-stretch justify-center bg-slate-900/40 overflow-hidden min-h-0">
        <div
          style={{ width: deviceConfig[deviceMode].width, maxWidth: '100%' }}
          className={`overflow-hidden transition-all duration-300 flex flex-col ${
            deviceMode !== 'desktop'
              ? 'border-2 border-slate-600 rounded-xl mx-auto my-3 shadow-2xl'
              : 'flex-1'
          }`}
        >
          {/* Device frame bar for mobile/tablet */}
          {deviceMode !== 'desktop' && (
            <div className="bg-slate-800 flex items-center justify-center py-1.5 flex-shrink-0">
              <div className="w-12 h-1 bg-slate-600 rounded-full" />
            </div>
          )}

          {iframeError ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 bg-slate-900 text-center p-6">
              <TriangleAlert className="w-8 h-8 text-yellow-500" />
              <p className="text-sm text-slate-300 font-medium">Önizleme yüklenemedi</p>
              <button
                onClick={handleRefresh}
                className="px-4 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-xs transition"
              >
                Yeniden dene
              </button>
            </div>
          ) : blobUrl ? (
            <iframe
              ref={iframeRef}
              key={`${refreshKey}-${blobUrl}`}
              src={blobUrl}
              className="flex-1 w-full border-none bg-white"
              title="Canlı Önizleme"
              sandbox="allow-scripts allow-forms allow-modals"
              onError={() => setIframeError(true)}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center bg-slate-900">
              <p className="text-xs text-slate-500">Proje seçin</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
