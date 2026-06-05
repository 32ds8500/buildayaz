/**
 * AI Provider Tests — mock-based
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getProvider, getAllModels, getFreeModels, getProviderHealth } from '../core/llm';

// Mock fetch globally
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

const makeOkResponse = (body: unknown) => ({
  ok: true,
  status: 200,
  text: () => Promise.resolve(JSON.stringify(body)),
  json: () => Promise.resolve(body),
  body: null,
});

const makeErrResponse = (status: number, body = 'Error') => ({
  ok: false,
  status,
  text: () => Promise.resolve(body),
  json: () => Promise.reject(new Error('not json')),
  body: null,
});

beforeEach(() => { mockFetch.mockReset(); });

describe('Provider Registry', () => {
  it('returns all 10 providers', () => {
    const providers = ['gemini','pollinations','groq','openrouter','together','huggingface','ollama','openai','anthropic','custom'];
    providers.forEach(p => {
      const provider = getProvider(p as Parameters<typeof getProvider>[0]);
      expect(provider).toBeTruthy();
      expect(provider.name).toBe(p);
    });
  });

  it('getFreeModels returns only free models', () => {
    const models = getFreeModels();
    expect(models.length).toBeGreaterThan(0);
    models.forEach(m => {
      expect(m.isFree).toBe(true);
      expect(m.costPer1kInput).toBe(0);
    });
  });

  it('getAllModels returns models from all providers', () => {
    const models = getAllModels();
    expect(models.length).toBeGreaterThan(5);
    const providers = new Set(models.map(m => m.provider));
    expect(providers.size).toBeGreaterThan(3);
  });

  it('getProviderHealth returns health for all providers', () => {
    const health = getProviderHealth();
    expect(health.length).toBeGreaterThan(0);
    health.forEach(h => {
      expect(['healthy','degraded','down']).toContain(h.status);
      expect(['closed','open','half-open']).toContain(h.circuitState);
    });
  });
});

describe('Pollinations Provider', () => {
  it('chat returns content', async () => {
    mockFetch.mockResolvedValueOnce(makeOkResponse({
      choices: [{ message: { content: 'Hello!' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    }));

    const provider = getProvider('pollinations');
    const response = await provider.chat({
      messages: [{ role: 'user', content: 'Hi' }],
      config: { provider: 'pollinations', model: 'openai', apiKey: '', temperature: 0.7 },
    });

    expect(response.content).toBe('Hello!');
    expect(response.provider).toBe('pollinations');
    expect(response.usage.totalTokens).toBe(15);
  });

  it('validateConfig returns null (no key needed)', () => {
    const provider = getProvider('pollinations');
    const err = provider.validateConfig({ provider: 'pollinations', model: 'openai', apiKey: '' });
    expect(err).toBeNull();
  });
});

describe('Gemini Provider', () => {
  it('validateConfig returns error when no API key', () => {
    const provider = getProvider('gemini');
    const err = provider.validateConfig({ provider: 'gemini', model: 'gemini-2.0-flash', apiKey: '' });
    expect(err).not.toBeNull();
    expect(err?.code).toBe('NO_API_KEY');
    expect(err?.retryable).toBe(false);
  });

  it('chat handles HTTP errors properly', async () => {
    mockFetch.mockResolvedValueOnce(makeErrResponse(429, '{"error":{"code":429,"message":"Rate limit exceeded"}}'));
    const provider = getProvider('gemini');
    await expect(provider.chat({
      messages: [{ role: 'user', content: 'Hi' }],
      config: { provider: 'gemini', model: 'gemini-2.0-flash', apiKey: 'test-key' },
    })).rejects.toMatchObject({ retryable: true, status: 429 });
  });

  it('has only free models', () => {
    const models = getProvider('gemini').getModels();
    expect(models.length).toBeGreaterThan(0);
    models.forEach(m => {
      expect(m.isFree).toBe(true);
      expect(m.costPer1kInput).toBe(0);
      expect(['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-flash', 'gemini-1.5-flash-8b']).toContain(m.id);
    });
  });
});

describe('Groq Provider', () => {
  it('validateConfig requires API key', () => {
    const err = getProvider('groq').validateConfig({ provider: 'groq', model: 'llama-3.3-70b-versatile', apiKey: '' });
    expect(err?.code).toBe('NO_API_KEY');
  });

  it('has free models with tools support', () => {
    const models = getProvider('groq').getModels();
    const toolModels = models.filter(m => m.supportsTools);
    expect(toolModels.length).toBeGreaterThan(0);
  });
});
