import React, { useState, useMemo } from 'react';
import { useAIStore, PROVIDER_META, maskApiKey } from '../store/aiStore';
import { getFreeModels, getAllModels, getProvider } from '../core/llm';
import type { LLMProvider } from '../core/llm';
import {
  X, Key, Bot, Zap, Check, TriangleAlert, Eye, EyeOff,
  Wrench, MessageSquare, Brain, Globe, Cpu, ExternalLink,
} from 'lucide-react';

interface Props { onClose: () => void; }

type Tab = 'provider' | 'model' | 'advanced';

export const AISettingsModal: React.FC<Props> = ({ onClose }) => {
  const {
    config, isConfigured,
    setProvider, setModel, setApiKey, setBaseUrl, setTemperature, setMaxTokens,
    isReadyToChat,
  } = useAIStore();

  const [tab, setTab] = useState<Tab>('provider');
  const [keyVisible, setKeyVisible] = useState(false);
  const [keyDraft, setKeyDraft] = useState('');
  const [savingKey, setSavingKey] = useState(false);
  const [onlyFree, setOnlyFree] = useState(true);

  const currentMeta = PROVIDER_META.find(m => m.id === config.provider);
  const ready = isReadyToChat();

  const models = useMemo(() => {
    const all = onlyFree ? getFreeModels() : getAllModels();
    return all.filter(m => m.provider === config.provider);
  }, [config.provider, onlyFree]);

  function handleProviderChange(id: LLMProvider) {
    setProvider(id);
    const firstModel = getProvider(id).getModels()[0];
    if (firstModel) setModel(firstModel.id);
    setKeyDraft('');
  }

  function handleSaveKey() {
    setSavingKey(true);
    setApiKey(keyDraft.trim());
    setKeyDraft('');
    setTimeout(() => setSavingKey(false), 800);
  }

  const freeMeta  = PROVIDER_META.filter(p => p.isFree);
  const paidMeta  = PROVIDER_META.filter(p => !p.isFree);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-dark-800 border border-dark-600 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-dark-600 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-accent-blue" />
            <h2 className="text-base font-semibold text-white">AI Ayarları</h2>
            {ready
              ? <span className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full"><span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />Hazır</span>
              : <span className="flex items-center gap-1 text-xs text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded-full"><TriangleAlert className="w-3 h-3" />API anahtarı gerekli</span>
            }
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-dark-300 hover:text-white hover:bg-dark-700 transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-dark-600 flex-shrink-0">
          {([['provider', Globe, 'Provider'], ['model', Cpu, 'Model'], ['advanced', Wrench, 'Gelişmiş']] as const).map(([t, Icon, label]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition -mb-px ${
                tab === t ? 'border-accent-blue text-accent-blue' : 'border-transparent text-dark-300 hover:text-white'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />{label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 min-h-0">

          {/* ── Provider Tab ── */}
          {tab === 'provider' && (
            <div className="space-y-4">
              <p className="text-xs text-dark-300">Ücretsiz modellerden başlayın — API anahtarı gerekmeyenler bile var!</p>

              {/* Free providers */}
              <div>
                <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2">🆓 Ücretsiz Providerlar</p>
                <div className="space-y-2">
                  {freeMeta.map(meta => (
                    <ProviderCard
                      key={meta.id}
                      meta={meta}
                      selected={config.provider === meta.id}
                      onSelect={() => handleProviderChange(meta.id)}
                      apiKey={loadKeyForDisplay(meta.id, config)}
                      onSaveKey={setApiKey}
                    />
                  ))}
                </div>
              </div>

              {/* Paid providers */}
              <div>
                <p className="text-xs font-semibold text-dark-400 uppercase tracking-wider mb-2">💳 Ücretli Providerlar</p>
                <div className="space-y-2">
                  {paidMeta.map(meta => (
                    <ProviderCard
                      key={meta.id}
                      meta={meta}
                      selected={config.provider === meta.id}
                      onSelect={() => handleProviderChange(meta.id)}
                      apiKey={loadKeyForDisplay(meta.id, config)}
                      onSaveKey={setApiKey}
                    />
                  ))}
                </div>
              </div>

              {/* Key input for selected provider that needs one */}
              {currentMeta?.needsKey && (
                <div className="mt-4 p-4 bg-dark-700/50 border border-dark-600 rounded-xl">
                  <p className="text-xs font-medium text-white mb-2 flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-accent-blue" />
                    {currentMeta.label} API Anahtarı
                  </p>
                  {isConfigured && !keyDraft && (
                    <p className="text-xs text-emerald-400 mb-2">✓ Kaydedildi: {maskApiKey(config.apiKey)}</p>
                  )}
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type={keyVisible ? 'text' : 'password'}
                        value={keyDraft}
                        onChange={e => setKeyDraft(e.target.value)}
                        placeholder={`${currentMeta.keyPrefix || ''}...`}
                        className="w-full bg-dark-800 border border-dark-600 rounded-lg px-3 py-2 text-sm text-white placeholder-dark-400 focus:outline-none focus:border-accent-blue pr-9"
                        onKeyDown={e => e.key === 'Enter' && keyDraft && handleSaveKey()}
                      />
                      <button onClick={() => setKeyVisible(v => !v)} className="absolute right-2.5 top-2.5 text-dark-400 hover:text-white">
                        {keyVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <button
                      onClick={handleSaveKey}
                      disabled={!keyDraft}
                      className="px-3 py-2 rounded-lg bg-accent-blue hover:bg-accent-blue/80 disabled:opacity-40 text-white text-sm font-medium transition flex items-center gap-1.5"
                    >
                      {savingKey ? <Check className="w-3.5 h-3.5" /> : <Key className="w-3.5 h-3.5" />}
                      {savingKey ? 'Kaydedildi' : 'Kaydet'}
                    </button>
                  </div>
                  <a href={currentMeta.signupUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-accent-blue hover:underline mt-2">
                    <ExternalLink className="w-3 h-3" />Ücretsiz API anahtarı al →
                  </a>
                </div>
              )}
            </div>
          )}

          {/* ── Model Tab ── */}
          {tab === 'model' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-dark-300">{config.provider} için mevcut modeller</p>
                <label className="flex items-center gap-2 text-xs text-dark-300 cursor-pointer">
                  <input type="checkbox" checked={onlyFree} onChange={e => setOnlyFree(e.target.checked)} className="rounded" />
                  Sadece ücretsiz
                </label>
              </div>
              {models.length === 0 ? (
                <div className="text-center py-8 text-dark-400 text-sm">
                  Bu provider için{onlyFree ? ' ücretsiz' : ''} model bulunamadı.
                  {onlyFree && <button onClick={() => setOnlyFree(false)} className="ml-1 text-accent-blue hover:underline">Tümünü göster</button>}
                </div>
              ) : (
                <div className="space-y-2">
                  {models.map(m => (
                    <button
                      key={m.id}
                      onClick={() => setModel(m.id)}
                      className={`w-full text-left p-3 rounded-xl border transition ${
                        config.model === m.id
                          ? 'border-accent-blue bg-accent-blue/10'
                          : 'border-dark-600 bg-dark-700/50 hover:border-dark-500'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-white truncate">{m.name}</span>
                            {m.isFree && <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full flex-shrink-0">FREE</span>}
                            {m.tier === 'reasoning' && <span className="text-[10px] bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded-full flex-shrink-0">REASONING</span>}
                          </div>
                          <p className="text-xs text-dark-400 mt-0.5 truncate">{m.id}</p>
                          {m.description && <p className="text-xs text-dark-300 mt-1">{m.description}</p>}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-xs text-dark-400">{(m.contextWindow / 1000).toFixed(0)}K ctx</p>
                          <div className="flex items-center gap-1 mt-1 justify-end">
                            {m.supportsTools    && <span title="Tools"   className="text-[10px] bg-dark-600 text-dark-300 px-1 rounded">🔧</span>}
                            {m.supportsVision   && <span title="Vision"  className="text-[10px] bg-dark-600 text-dark-300 px-1 rounded">👁</span>}
                            {m.supportsStreaming && <span title="Stream"  className="text-[10px] bg-dark-600 text-dark-300 px-1 rounded">⚡</span>}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Advanced Tab ── */}
          {tab === 'advanced' && (
            <div className="space-y-5">
              {/* Temperature */}
              <div>
                <label className="block text-xs font-medium text-dark-200 mb-1.5">
                  Sıcaklık (Temperature): <span className="text-accent-blue font-semibold">{config.temperature?.toFixed(1) ?? '0.7'}</span>
                </label>
                <input
                  type="range" min="0" max="2" step="0.1"
                  value={config.temperature ?? 0.7}
                  onChange={e => setTemperature(parseFloat(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-[10px] text-dark-400 mt-1">
                  <span>Odaklı (0)</span><span>Dengeli (0.7)</span><span>Yaratıcı (2)</span>
                </div>
              </div>

              {/* Max tokens */}
              <div>
                <label className="block text-xs font-medium text-dark-200 mb-1.5">
                  Maks. Token: <span className="text-accent-blue font-semibold">{config.maxTokens ?? 4096}</span>
                </label>
                <input
                  type="range" min="256" max="16384" step="256"
                  value={config.maxTokens ?? 4096}
                  onChange={e => setMaxTokens(parseInt(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-[10px] text-dark-400 mt-1">
                  <span>256</span><span>4096</span><span>16384</span>
                </div>
              </div>

              {/* Base URL (custom / ollama) */}
              {(config.provider === 'custom' || config.provider === 'ollama') && (
                <div>
                  <label className="block text-xs font-medium text-dark-200 mb-1.5">
                    <Wrench className="inline w-3 h-3 mr-1" />
                    Base URL
                    <span className="ml-1 text-dark-400">{config.provider === 'ollama' ? '(varsayılan: http://localhost:11434)' : ''}</span>
                  </label>
                  <input
                    type="text"
                    value={config.baseUrl || ''}
                    onChange={e => setBaseUrl(e.target.value)}
                    placeholder={config.provider === 'ollama' ? 'http://localhost:11434' : 'https://...'}
                    className="w-full bg-dark-800 border border-dark-600 rounded-lg px-3 py-2 text-sm text-white placeholder-dark-400 focus:outline-none focus:border-accent-blue"
                  />
                </div>
              )}

              {/* Stats */}
              <div className="p-3 bg-dark-700/50 border border-dark-600 rounded-xl">
                <p className="text-xs font-medium text-dark-200 mb-2 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-accent-blue" />Oturum İstatistikleri
                </p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-dark-800 rounded-lg p-2">
                    <p className="text-dark-400">Provider</p>
                    <p className="text-white font-medium">{config.provider}</p>
                  </div>
                  <div className="bg-dark-800 rounded-lg p-2">
                    <p className="text-dark-400">Model</p>
                    <p className="text-white font-medium truncate">{config.model || '—'}</p>
                  </div>
                </div>
              </div>

              {/* Provider info */}
              {currentMeta && (
                <div className="text-xs text-dark-400 p-3 bg-dark-700/30 rounded-xl">
                  <p className="font-medium text-dark-200 mb-1 flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5" />{currentMeta.label}
                  </p>
                  <p>{currentMeta.description}</p>
                  {currentMeta.signupUrl && (
                    <a href={currentMeta.signupUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-accent-blue hover:underline mt-1.5">
                      <ExternalLink className="w-3 h-3" />Kayıt / API key
                    </a>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-dark-600 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2 text-xs text-dark-400">
            <Bot className="w-3.5 h-3.5" />
            {ready
              ? <span className="text-emerald-400">Sohbete hazır</span>
              : <span>API anahtarı girilmeden sadece Pollinations kullanılabilir</span>
            }
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-accent-blue hover:bg-accent-blue/80 text-white text-sm font-medium transition"
          >
            Tamam
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── ProviderCard ──────────────────────────────────────────────────
function loadKeyForDisplay(id: LLMProvider, config: { provider: LLMProvider; apiKey: string }) {
  return config.provider === id ? config.apiKey : '';
}

interface ProviderCardProps {
  meta: typeof PROVIDER_META[number];
  selected: boolean;
  onSelect: () => void;
  apiKey: string;
  onSaveKey: (k: string) => void;
}

const ProviderCard: React.FC<ProviderCardProps> = ({ meta, selected, onSelect }) => {
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left p-3 rounded-xl border transition ${
        selected ? 'border-accent-blue bg-accent-blue/10' : 'border-dark-600 bg-dark-700/50 hover:border-dark-500'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white">{meta.label}</span>
            {!meta.needsKey && <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full">No Key</span>}
            {meta.isFree && meta.needsKey && <span className="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded-full">Free</span>}
          </div>
          <p className="text-xs text-dark-400 mt-0.5">{meta.description}</p>
        </div>
        {selected && <Check className="w-4 h-4 text-accent-blue flex-shrink-0 ml-2" />}
      </div>
    </button>
  );
};
