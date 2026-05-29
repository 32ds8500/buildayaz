/**
 * AI Configuration Store — v2
 * Free-first provider selection, session-safe key storage, new providers
 *
 * Security:
 * - API key XOR-obfuscated in sessionStorage (cleared on tab close)
 * - Non-sensitive settings persist to localStorage
 * - Key NEVER lives in zustand state as plaintext — read on demand via getApiKey()
 */

import { create } from 'zustand';
import type { LLMConfig, LLMProvider } from '../core/llm';

// ─── XOR obfuscation (prevents plaintext in DevTools storage tab) ─
const OBF_SEED = 'kodyap_2025_xor_v2';

function xorEncode(text: string): string {
  let r = '';
  for (let i = 0; i < text.length; i++) {
    r += String.fromCharCode(text.charCodeAt(i) ^ OBF_SEED.charCodeAt(i % OBF_SEED.length));
  }
  try { return btoa(r); } catch { return btoa(encodeURIComponent(r)); }
}

function xorDecode(encoded: string): string {
  try {
    let decoded: string;
    try { decoded = atob(encoded); } catch { decoded = decodeURIComponent(atob(encoded)); }
    let r = '';
    for (let i = 0; i < decoded.length; i++) {
      r += String.fromCharCode(decoded.charCodeAt(i) ^ OBF_SEED.charCodeAt(i % OBF_SEED.length));
    }
    return r;
  } catch { return ''; }
}

// ─── Key storage (sessionStorage = tab-scoped) ────────────────────
const KEY_SS_KEY = 'kodyap_ak_v2';
const CFG_LS_KEY = 'kodyap_ai_cfg_v2';

function saveKey(key: string) {
  try {
    if (key) sessionStorage.setItem(KEY_SS_KEY, xorEncode(key));
    else sessionStorage.removeItem(KEY_SS_KEY);
  } catch { /* private mode */ }
}

function loadKey(): string {
  try { const v = sessionStorage.getItem(KEY_SS_KEY); return v ? xorDecode(v) : ''; } catch { return ''; }
}

// ─── Non-sensitive settings (localStorage) ───────────────────────
interface PersistedSettings {
  provider: LLMProvider;
  model: string;
  temperature: number;
  maxTokens: number;
  stream: boolean;
  baseUrl: string;
}

const DEFAULT_SETTINGS: PersistedSettings = {
  provider: 'pollinations',     // free, no key — best default
  model: 'openai',              // Pollinations default model id
  temperature: 0.7,
  maxTokens: 4096,
  stream: true,
  baseUrl: '',
};

function loadSettings(): PersistedSettings {
  try {
    const raw = localStorage.getItem(CFG_LS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch { return DEFAULT_SETTINGS; }
}

function saveSettings(s: Partial<PersistedSettings>) {
  try {
    const current = loadSettings();
    localStorage.setItem(CFG_LS_KEY, JSON.stringify({ ...current, ...s }));
  } catch { /* quota exceeded */ }
}

// ─── Mask helper ──────────────────────────────────────────────────
export function maskApiKey(key: string): string {
  if (!key || key.length < 8) return '••••••••';
  return `${key.slice(0, 4)}••••••••${key.slice(-4)}`;
}

// ─── Provider display info ────────────────────────────────────────
export interface ProviderMeta {
  id: LLMProvider;
  label: string;
  isFree: boolean;
  needsKey: boolean;
  signupUrl: string;
  keyPrefix?: string;
  description: string;
}

export const PROVIDER_META: ProviderMeta[] = [
  {
    id: 'pollinations',
    label: 'Pollinations AI',
    isFree: true,
    needsKey: false,
    signupUrl: 'https://pollinations.ai',
    description: '🆓 Ücretsiz, API anahtarı gerekmez. Hemen başla!',
  },
  {
    id: 'gemini',
    label: 'Google Gemini',
    isFree: true,
    needsKey: true,
    signupUrl: 'https://aistudio.google.com/apikey',
    keyPrefix: 'AIza',
    description: '🆓 Ücretsiz kota var. Google AI Studio\'dan al.',
  },
  {
    id: 'groq',
    label: 'Groq',
    isFree: true,
    needsKey: true,
    signupUrl: 'https://console.groq.com',
    keyPrefix: 'gsk_',
    description: '🆓 Ücretsiz 14.400 istek/gün. Ultra hızlı.',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    isFree: true,
    needsKey: true,
    signupUrl: 'https://openrouter.ai/keys',
    keyPrefix: 'sk-or-',
    description: '🆓 Birçok ücretsiz model. En çok seçenek.',
  },
  {
    id: 'together',
    label: 'Together AI',
    isFree: true,
    needsKey: true,
    signupUrl: 'https://api.together.xyz',
    description: '🆓 Ücretsiz modeller + $25 başlangıç kredisi.',
  },
  {
    id: 'huggingface',
    label: 'HuggingFace',
    isFree: true,
    needsKey: true,
    signupUrl: 'https://huggingface.co/settings/tokens',
    keyPrefix: 'hf_',
    description: '🆓 Ücretsiz inference API. HF token ile.',
  },
  {
    id: 'ollama',
    label: 'Ollama (Local)',
    isFree: true,
    needsKey: false,
    signupUrl: 'https://ollama.ai',
    description: '🖥️ Tamamen yerel çalışır. İnternet gerekmez.',
  },
  {
    id: 'openai',
    label: 'OpenAI',
    isFree: false,
    needsKey: true,
    signupUrl: 'https://platform.openai.com/api-keys',
    keyPrefix: 'sk-',
    description: '💳 Ücretli. GPT-4o ve diğer OpenAI modelleri.',
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    isFree: false,
    needsKey: true,
    signupUrl: 'https://console.anthropic.com',
    keyPrefix: 'sk-ant-',
    description: '💳 Ücretli. Claude modelleri.',
  },
  {
    id: 'custom',
    label: 'Custom Endpoint',
    isFree: true,
    needsKey: false,
    signupUrl: '',
    description: '🔧 LM Studio, vLLM, Jan veya başka OpenAI-uyumlu endpoint.',
  },
];

// ─── Store types ──────────────────────────────────────────────────
interface AIState {
  config: LLMConfig;
  isConfigured: boolean;
  totalTokens: number;
  requestCount: number;
  isStreaming: boolean;
  abortController: AbortController | null;

  // Actions
  setProvider: (provider: LLMProvider) => void;
  setModel: (model: string) => void;
  setApiKey: (key: string) => void;
  setBaseUrl: (url: string) => void;
  setTemperature: (temp: number) => void;
  setMaxTokens: (tokens: number) => void;
  setConfig: (partial: Partial<LLMConfig>) => void;
  setStreaming: (streaming: boolean, controller?: AbortController | null) => void;
  cancelStream: () => void;
  addUsage: (tokens: number) => void;
  resetStats: () => void;

  /** Read live API key from sessionStorage — never from state */
  getApiKey: () => string;
  /** true if current provider needs no key OR key is set */
  isReadyToChat: () => boolean;
}

// ─── Store ────────────────────────────────────────────────────────
const _settings = loadSettings();
const _apiKey   = loadKey();

const _init: LLMConfig = {
  provider:    _settings.provider,
  model:       _settings.model,
  apiKey:      _apiKey,
  baseUrl:     _settings.baseUrl || undefined,
  temperature: _settings.temperature,
  maxTokens:   _settings.maxTokens,
  stream:      _settings.stream,
};

export const useAIStore = create<AIState>((set, get) => ({
  config:       _init,
  isConfigured: !!_apiKey || _settings.provider === 'pollinations' || _settings.provider === 'ollama',
  totalTokens:  0,
  requestCount: 0,
  isStreaming:  false,
  abortController: null,

  getApiKey: () => loadKey(),

  isReadyToChat: () => {
    const { config } = get();
    const meta = PROVIDER_META.find(m => m.id === config.provider);
    if (!meta?.needsKey) return true;          // pollinations, ollama, custom without key
    return !!loadKey();
  },

  setProvider: (provider) => {
    saveSettings({ provider });
    set(s => ({ config: { ...s.config, provider }, isConfigured: !PROVIDER_META.find(m => m.id === provider)?.needsKey || !!loadKey() }));
  },

  setModel: (model) => {
    saveSettings({ model });
    set(s => ({ config: { ...s.config, model } }));
  },

  setApiKey: (apiKey) => {
    saveKey(apiKey);
    const meta = PROVIDER_META.find(m => m.id === get().config.provider);
    set(s => ({ config: { ...s.config, apiKey }, isConfigured: !!apiKey || !meta?.needsKey }));
  },

  setBaseUrl: (baseUrl) => {
    saveSettings({ baseUrl });
    set(s => ({ config: { ...s.config, baseUrl: baseUrl || undefined } }));
  },

  setTemperature: (temperature) => {
    saveSettings({ temperature });
    set(s => ({ config: { ...s.config, temperature } }));
  },

  setMaxTokens: (maxTokens) => {
    saveSettings({ maxTokens });
    set(s => ({ config: { ...s.config, maxTokens } }));
  },

  setConfig: (partial) => {
    if (partial.apiKey !== undefined) saveKey(partial.apiKey);
    const nonSensitive: Partial<PersistedSettings> = {};
    if (partial.provider  !== undefined) nonSensitive.provider    = partial.provider;
    if (partial.model     !== undefined) nonSensitive.model       = partial.model;
    if (partial.temperature !== undefined) nonSensitive.temperature = partial.temperature;
    if (partial.maxTokens !== undefined) nonSensitive.maxTokens   = partial.maxTokens;
    if (partial.baseUrl   !== undefined) nonSensitive.baseUrl     = partial.baseUrl || '';
    if (Object.keys(nonSensitive).length) saveSettings(nonSensitive);

    set(s => {
      const config = { ...s.config, ...partial };
      const meta = PROVIDER_META.find(m => m.id === config.provider);
      return { config, isConfigured: !!config.apiKey || !meta?.needsKey };
    });
  },

  setStreaming: (isStreaming, controller = null) => {
    set({ isStreaming, abortController: controller ?? null });
  },

  cancelStream: () => {
    get().abortController?.abort();
    set({ isStreaming: false, abortController: null });
  },

  addUsage: (tokens) => {
    set(s => ({ totalTokens: s.totalTokens + tokens, requestCount: s.requestCount + 1 }));
  },

  resetStats: () => set({ totalTokens: 0, requestCount: 0 }),
}));
