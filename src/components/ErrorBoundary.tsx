import React from 'react';
import { TriangleAlert, RefreshCw, ChevronDown } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  fallbackLabel?: string;   // e.g. "Kod Editörü"
  inline?: boolean;         // smaller inline variant
}

interface State {
  error: Error | null;
  expanded: boolean;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null, expanded: false };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', this.props.fallbackLabel ?? 'Component', error, info);
  }

  reset = () => this.setState({ error: null, expanded: false });

  render() {
    const { error, expanded } = this.state;
    const { children, fallbackLabel = 'Bileşen', inline = false } = this.props;

    if (!error) return children;

    if (inline) {
      return (
        <div className="flex items-center gap-2 px-3 py-2 bg-red-950/40 border border-red-800/40 rounded-lg text-xs text-red-400">
          <TriangleAlert className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="flex-1 truncate">{fallbackLabel} yüklenemedi</span>
          <button
            onClick={this.reset}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-red-900/40 hover:bg-red-800/40 transition text-red-300"
          >
            <RefreshCw className="w-3 h-3" />
            Yenile
          </button>
        </div>
      );
    }

    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 bg-[#0d1117] p-8 text-center">
        <div className="w-14 h-14 rounded-full bg-red-950/60 border border-red-800/40 flex items-center justify-center">
          <TriangleAlert className="w-7 h-7 text-red-400" />
        </div>

        <div>
          <h3 className="text-base font-semibold text-slate-200 mb-1">
            {fallbackLabel} çöktü
          </h3>
          <p className="text-sm text-slate-500 max-w-xs">
            Beklenmedik bir hata oluştu. Sayfayı yenilemeyi ya da aşağıdaki butonu kullanmayı deneyin.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={this.reset}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium transition"
          >
            <RefreshCw className="w-4 h-4" />
            Yeniden Dene
          </button>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-lg border border-slate-700 hover:border-slate-500 text-slate-400 hover:text-slate-200 text-sm transition"
          >
            Sayfayı Yenile
          </button>
        </div>

        {/* Expandable error details */}
        <button
          onClick={() => this.setState(s => ({ expanded: !s.expanded }))}
          className="flex items-center gap-1 text-xs text-slate-600 hover:text-slate-400 transition mt-1"
        >
          <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          Hata detayları
        </button>

        {expanded && (
          <pre className="max-w-full max-h-40 overflow-auto bg-slate-900 border border-slate-800 rounded-lg p-3 text-xs text-red-400 text-left whitespace-pre-wrap break-all">
            {error.message}
            {error.stack ? '\n\n' + error.stack : ''}
          </pre>
        )}
      </div>
    );
  }
}
