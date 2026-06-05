import { sanitizeAiText, sanitizePath } from '../shared/utils/sanitize';
import { logger } from '../core/llm/logging/logger';

const log = logger.forModule('ChatPanel');
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { FileNode, getLanguage } from '../store/useStore';
import { useAIStore, PROVIDER_META } from '../store/aiStore';
import { streamAIResponse } from '../services/aiService';
import {
  Send, Sparkles, Copy, Check, Code2, Loader2,
  Trash2, Bot, User, FileDown, CircleStop
} from 'lucide-react';
import toast from 'react-hot-toast';
import { generateId } from './../shared/utils/id';
import { useEditorStore } from '../store/editorStore';
import { useProjectStore } from '../store/projectStore';
import { useChatStore } from '../store/chatStore';

function findFileInTree(files: FileNode[], path: string): FileNode | null {
  for (const f of files) {
    if (f.path === path) return f;
    if (f.children) { const found = findFileInTree(f.children, path); if (found) return found; }
  }
  return null;
}


const CodeBlock: React.FC<{ code: string; language: string; filename?: string }> = ({ code, language, filename }) => {
  const [copied, setCopied] = useState(false);
  const { activeFile } = useEditorStore();
  const { updateFileContent } = useProjectStore();
  
  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(code); } catch { /* fallback */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApply = () => {
    if (activeFile) {
      updateFileContent(activeFile.path, code);
      toast.success(`"${activeFile.name}" dosyasına uygulandı`);
    } else {
      toast.error('Önce bir dosya açın');
    }
  };

  return (
    <div className="my-3 rounded-lg overflow-hidden border border-dark-500 bg-dark-900">
      <div className="flex items-center justify-between px-3 py-1.5 bg-dark-700 border-b border-dark-500">
        <div className="flex items-center gap-2">
          <Code2 className="w-3.5 h-3.5 text-dark-300" />
          <span className="text-xs text-dark-200">{filename || language}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleApply}
            className="flex items-center gap-1 text-xs text-accent-blue hover:text-blue-300 transition"
            title="Açık dosyaya uygula"
          >
            <FileDown className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Uygula</span>
          </button>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-xs text-dark-300 hover:text-white transition"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{copied ? 'Kopyalandı' : 'Kopyala'}</span>
          </button>
        </div>
      </div>
      <pre className="p-3 overflow-x-auto text-xs leading-relaxed">
        <code className="text-dark-100 font-mono">{code}</code>
      </pre>
    </div>
  );
};

const formatMessage = (content: string): React.ReactNode => {
  const parts = sanitizeAiText(content).split(/(```[\s\S]*?```)/g);
  
  return parts.map((part, i) => {
    if (part.startsWith('```') && part.endsWith('```')) {
      const firstNewline = part.indexOf('\n');
      const langLine = part.slice(3, firstNewline).trim();
      const [lang, ...rest] = langLine.split(/\s+\/\/\s+/);
      const filename = rest.join(' ') || undefined;
      const code = part.slice(firstNewline + 1, -3).trim();
      return <CodeBlock key={i} code={code} language={lang || 'plaintext'} filename={filename} />;
    }
    
    // Format markdown-like content
    return (
      <span key={i}>
        {part.split('\n').map((line, j) => {
          let formatted: React.ReactNode = line;
          
          // Bold
          formatted = line.split(/(\*\*.*?\*\*)/g).map((seg, k) => {
            if (seg.startsWith('**') && seg.endsWith('**')) {
              return <strong key={k} className="text-white font-semibold">{seg.slice(2, -2)}</strong>;
            }
            // Inline code
            return seg.split(/(`[^`]+`)/g).map((s, l) => {
              if (s.startsWith('`') && s.endsWith('`')) {
                return <code key={l} className="px-1.5 py-0.5 bg-dark-600 rounded text-accent-blue text-xs font-mono">{s.slice(1, -1)}</code>;
              }
              return s;
            });
          });
          
          // List items
          if (line.startsWith('- ')) {
            return <div key={j} className="flex gap-2 ml-2"><span className="text-accent-blue">•</span><span>{formatted}</span></div>;
          }
          
          return <React.Fragment key={j}>{formatted}{j < part.split('\n').length - 1 && <br />}</React.Fragment>;
        })}
      </span>
    );
  });
};


const ProviderBadge = React.memo(() => {
  const { config, isReadyToChat } = useAIStore();
  const meta = PROVIDER_META.find(m => m.id === config.provider);
  const ready = isReadyToChat();
  return (
    <span className={`text-[10px] flex items-center gap-1 ${ready ? 'text-accent-green' : 'text-yellow-400'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${ready ? 'bg-accent-green animate-pulse' : 'bg-yellow-400'}`} />
      {meta?.label ?? config.provider}
      {!meta?.needsKey && ready && <span className="text-dark-400">(free)</span>}
    </span>
  );
});
ProviderBadge.displayName = 'ProviderBadge';

export const ChatPanel: React.FC = () => {
  const { messages: chatMessages, isLoading: chatLoading, addMessage: addChatMessage, setLoading: setChatLoading, clearMessages: clearChat } = useChatStore();
  const { currentProject } = useProjectStore();
  const { activeFile } = useEditorStore();
  
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, chatLoading]);

  const abortRef = useRef<AbortController | null>(null);

  const handleSend = useCallback(async () => {
    const msg = input.trim();
    if (!msg || chatLoading) return;

    const userMsg = {
      id: Date.now().toString(36),
      role: 'user' as const,
      content: msg,
      timestamp: Date.now(),
    };
    
    addChatMessage(userMsg);
    setInput('');
    setChatLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;
    const aiStore = useAIStore.getState();
    aiStore.setStreaming(true, controller);

    // Create placeholder assistant message
    const assistantId = generateId();
    let fullContent = '';

    addChatMessage({
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    });

    try {
      for await (const chunk of streamAIResponse(
        msg,
        currentProject?.files || [],
        activeFile,
        chatMessages,
        controller.signal
      )) {
        if (chunk.type === 'text' && chunk.content) {
          fullContent += chunk.content;
          // Update the message in-place for streaming effect
          const messages = useChatStore.getState().messages;
          const updated = messages.map(m =>
            m.id === assistantId ? { ...m, content: fullContent } : m
          );
          
        }
        if (chunk.type === 'file_changes' && chunk.fileChanges) {
          // Auto-apply file changes — with path traversal guard
          const BLOCKED = [/\.\./, /^\/etc\//, /^\/proc\//, /^\/sys\//, /^\/dev\//, /node_modules\//];
          for (const fc of chunk.fileChanges) {
            if (!fc.content || !currentProject) continue;
            // ── Security: validate path ───────────────────────────────────────
            const safePath = fc.path.trim().replace(/\\/g, '/');
            const isBlocked = BLOCKED.some(re => re.test(safePath));
            const hasValidPrefix = safePath.startsWith('/') || safePath.startsWith('./');
            if (isBlocked || !hasValidPrefix || safePath.length > 260) {
              log.warn('Rejected unsafe filepath', { path: fc.path });
              toast.error(`Güvensiz dosya yolu reddedildi: ${fc.path}`);
              continue;
            }
            // ── Apply ─────────────────────────────────────────────────────────
            
            const exists = findFileInTree(currentProject.files, safePath);
            if (exists) {
              updateFileContent(safePath, fc.content);
              toast.success(`📝 ${safePath.split('/').pop()} güncellendi`);
            } else {
              const parts = safePath.split('/');
              const fileName = parts.pop() || '';
              const parentPath = parts.join('/') || '/src';
              addFile(parentPath, {
                name: fileName,
                path: safePath,
                type: 'file',
                content: fc.content,
                language: getLanguage(fileName),
              });
              toast.success(`✨ ${fileName} oluşturuldu`);
            }
          }
        }
        if (chunk.type === 'error') {
          fullContent += '\n\n❌ ' + (chunk.content || 'Bir hata oluştu');
          const messages = useChatStore.getState().messages;
          const updated = messages.map(m =>
            m.id === assistantId ? { ...m, content: fullContent } : m
          );
          
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        fullContent += '\n\n❌ Hata: ' + (err.message || 'Beklenmeyen bir hata oluştu');
        const messages = useChatStore.getState().messages;
        const updated = messages.map(m =>
          m.id === assistantId ? { ...m, content: fullContent } : m
        );
        
      }
    } finally {
      setChatLoading(false);
      aiStore.setStreaming(false);
      abortRef.current = null;
    }
  }, [input, chatLoading, chatMessages, currentProject, activeFile, addChatMessage, setChatLoading]);

  const handleStop = () => {
    abortRef.current?.abort();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const suggestions = [
    'Bir buton bileşeni oluştur',
    'Navbar yap',
    'Form ekle',
    'Todo uygulaması yap',
    'API servisi oluştur',
  ];

  return (
    <div className="h-full flex flex-col bg-dark-800">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-dark-600">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg gradient-bg flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">AI Asistan</h3>
            <ProviderBadge />
          </div>
        </div>
        <button
          onClick={clearChat}
          className="p-1.5 rounded-lg text-dark-300 hover:text-white hover:bg-dark-600 transition"
          title="Sohbeti Temizle"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
        {chatMessages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-2xl gradient-bg flex items-center justify-center mb-4">
              <Bot className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">KodYap AI</h3>
            <p className="text-sm text-dark-200 mb-6 max-w-xs">
              Size kod yazma, hata ayıklama ve bileşen oluşturma konusunda yardımcı olabilirim.
            </p>
            <div className="flex flex-wrap gap-2 justify-center max-w-sm">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => setInput(s)}
                  className="text-xs px-3 py-1.5 rounded-full bg-dark-600 text-dark-200 hover:bg-dark-500 hover:text-white transition"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {chatMessages.map((msg) => (
          <div
            key={msg.id}
            className={`chat-message flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}
          >
            {msg.role !== 'user' && (
              <div className={`w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center ${
                msg.role === 'system' ? 'bg-dark-600' : 'gradient-bg'
              }`}>
                {msg.role === 'system' ? (
                  <Sparkles className="w-3.5 h-3.5 text-accent-blue" />
                ) : (
                  <Bot className="w-3.5 h-3.5 text-white" />
                )}
              </div>
            )}
            <div className={`max-w-[85%] ${
              msg.role === 'user'
                ? 'bg-accent-blue/20 border border-accent-blue/30 rounded-2xl rounded-tr-sm px-4 py-2.5'
                : msg.role === 'system'
                ? 'bg-dark-700 border border-dark-500 rounded-2xl rounded-tl-sm px-4 py-2.5'
                : 'bg-dark-700/50 border border-dark-500/50 rounded-2xl rounded-tl-sm px-4 py-3'
            }`}>
              <div className="text-sm text-dark-100 leading-relaxed">
                {formatMessage(msg.content)}
              </div>
              <div className="text-[10px] text-dark-400 mt-2">
                {new Date(msg.timestamp).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
            {msg.role === 'user' && (
              <div className="w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center bg-accent-blue/20">
                <User className="w-3.5 h-3.5 text-accent-blue" />
              </div>
            )}
          </div>
        ))}

        {chatLoading && (
          <div className="chat-message flex gap-3">
            <div className="w-7 h-7 rounded-lg gradient-bg flex items-center justify-center flex-shrink-0">
              <Bot className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="bg-dark-700/50 border border-dark-500/50 rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 text-accent-blue animate-spin" />
                <span className="text-sm text-dark-200">Düşünüyorum...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Spacer */}

      {/* Input */}
      <div className="p-2 sm:p-3 border-t border-dark-600 flex-shrink-0">
        <div className="relative flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Mesajınızı yazın..."
              rows={1}
              className="w-full bg-dark-700 border border-dark-500 rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 text-sm text-white placeholder-dark-300 resize-none outline-none focus:border-accent-blue transition max-h-28"
              style={{ minHeight: '40px' }}
            />
          </div>
          {chatLoading ? (
            <button
              onClick={handleStop}
              className="p-2 sm:p-2.5 rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500/30 transition flex-shrink-0"
              title="Durdur"
            >
              <CircleStop className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className={`p-2 sm:p-2.5 rounded-xl transition flex-shrink-0 ${
                input.trim()
                  ? 'gradient-bg text-white hover:opacity-90'
                  : 'bg-dark-600 text-dark-400 cursor-not-allowed'
              }`}
            >
              <Send className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
