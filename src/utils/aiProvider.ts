// Shared AI provider configuration + chat-completion calls.
// Both the AI Evaluator and Direct Model Interaction features read the same
// stored credentials, so the user only configures their keys once.

export type Provider = 'ollama' | 'anthropic' | 'openai';

export interface ProviderConfig {
  provider: Provider;
  ollamaUrl: string;
  ollamaModel: string;
  anthropicKey: string;
  anthropicModel: string;
  openaiKey: string;
  openaiModel: string;
}

export const PROVIDER_STORAGE_KEY = 'ai-eval-provider-config';

export const ANTHROPIC_MODELS = [
  { id: 'claude-opus-4-7',           label: 'Claude Opus 4.7' },
  { id: 'claude-sonnet-4-6',         label: 'Claude Sonnet 4.6' },
  { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
];

export const OPENAI_MODELS = [
  { id: 'gpt-4o',       label: 'GPT-4o' },
  { id: 'gpt-4o-mini',  label: 'GPT-4o Mini' },
  { id: 'gpt-4-turbo',  label: 'GPT-4 Turbo' },
  { id: 'o1-mini',      label: 'o1 Mini' },
];

export function defaultProviderConfig(): ProviderConfig {
  return {
    provider:       'ollama',
    ollamaUrl:      'http://localhost:11434',
    ollamaModel:    'llama3.2',
    anthropicKey:   '',
    anthropicModel: 'claude-sonnet-4-6',
    openaiKey:      '',
    openaiModel:    'gpt-4o',
  };
}

export function loadProviderConfig(): ProviderConfig {
  try {
    const raw = localStorage.getItem(PROVIDER_STORAGE_KEY);
    if (raw) return { ...defaultProviderConfig(), ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return defaultProviderConfig();
}

export function saveProviderConfig(cfg: ProviderConfig) {
  localStorage.setItem(PROVIDER_STORAGE_KEY, JSON.stringify(cfg));
}

export function providerLabel(p: Provider): string {
  return p === 'anthropic' ? 'Anthropic' : p === 'openai' ? 'OpenAI' : 'Ollama';
}

export function providerModel(cfg: ProviderConfig): string {
  return cfg.provider === 'anthropic' ? cfg.anthropicModel
    : cfg.provider === 'openai'       ? cfg.openaiModel
    : cfg.ollamaModel;
}

export function providerConfigured(cfg: ProviderConfig): boolean {
  if (cfg.provider === 'anthropic') return !!cfg.anthropicKey;
  if (cfg.provider === 'openai')    return !!cfg.openaiKey;
  return !!cfg.ollamaUrl && !!cfg.ollamaModel;
}

async function errBody(res: Response): Promise<string> {
  const body = await res.text().catch(() => '');
  try { return JSON.parse(body)?.error?.message ?? body ?? res.statusText; }
  catch { return body || res.statusText; }
}

interface ChatOpts {
  maxTokens?: number;
  signal?: AbortSignal;
}

// Generic chat completion across providers. Returns the assistant's raw text.
export async function chatComplete(
  cfg: ProviderConfig,
  system: string,
  user: string,
  opts: ChatOpts = {},
): Promise<string> {
  const signal = opts.signal ?? AbortSignal.timeout(60_000);

  if (cfg.provider === 'anthropic') {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': cfg.anthropicKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: cfg.anthropicModel,
        max_tokens: opts.maxTokens ?? 256,
        system,
        messages: [{ role: 'user', content: user }],
      }),
      signal,
    });
    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await errBody(res)}`);
    const data = await res.json();
    return data?.content?.[0]?.text ?? '';
  }

  if (cfg.provider === 'openai') {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cfg.openaiKey}`,
      },
      body: JSON.stringify({
        model: cfg.openaiModel,
        max_tokens: opts.maxTokens ?? 256,
        messages: [
          { role: 'system', content: system },
          { role: 'user',   content: user },
        ],
      }),
      signal,
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await errBody(res)}`);
    const data = await res.json();
    return data?.choices?.[0]?.message?.content ?? '';
  }

  // Ollama
  const res = await fetch(`${cfg.ollamaUrl.replace(/\/$/, '')}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: cfg.ollamaModel,
      messages: [
        { role: 'system', content: system },
        { role: 'user',   content: user },
      ],
      stream: false,
      ...(opts.maxTokens ? { options: { num_predict: opts.maxTokens } } : {}),
    }),
    signal,
  });
  if (!res.ok) throw new Error(`Ollama ${res.status}: ${await errBody(res)}`);
  const data = await res.json();
  return data?.message?.content ?? data?.response ?? '';
}

// Pull a JSON object out of model output that may be wrapped in prose or fences.
export function extractJsonObject<T = unknown>(raw: string): T {
  try { return JSON.parse(raw.trim()) as T; } catch { /* fall through */ }

  const fence = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/i);
  if (fence) {
    try { return JSON.parse(fence[1].trim()) as T; } catch { /* fall through */ }
  }

  const greedy = raw.match(/\{[\s\S]*\}/);
  if (greedy) {
    try { return JSON.parse(greedy[0]) as T; } catch { /* fall through */ }
  }

  throw new Error(`No valid JSON object found in model output. Raw (first 200 chars): ${raw.slice(0, 200)}`);
}
