// Client for the LLMmap sidecar server (tools/LLMmap/server/llmmap_server.py).
//
// LLMmap fingerprints an LLM from its responses to a small fixed set of probe
// queries. Because it is PyTorch-based it can't run in the browser, so HexProbe
// talks to a local sidecar over HTTP — the same pattern used for Ollama.

export const LLMMAP_CONFIG_KEY = 'hexprobe-llmmap-config-v1';
export const DEFAULT_LLMMAP_URL = 'http://localhost:8765';

export interface LLMmapConfig {
  baseUrl: string;
}

export function loadLLMmapConfig(): LLMmapConfig {
  try {
    const raw = localStorage.getItem(LLMMAP_CONFIG_KEY);
    if (raw) return { baseUrl: DEFAULT_LLMMAP_URL, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { baseUrl: DEFAULT_LLMMAP_URL };
}

export function saveLLMmapConfig(cfg: LLMmapConfig) {
  try { localStorage.setItem(LLMMAP_CONFIG_KEY, JSON.stringify(cfg)); } catch { /* ignore */ }
}

export interface LLMmapHealth {
  status: string;
  ready: boolean;
  loading: boolean;
  error: string | null;
  mock: boolean;
  model_path: string;
  n_queries: number;
  llms_supported: number;
}

export interface LLMmapQueries {
  queries: string[];
  max_chars: number;
}

export interface Prediction {
  rank: number;
  model: string;
  distance: number;
}

export interface FingerprintResult {
  top_model: string | null;
  predictions: Prediction[];
}

const trimUrl = (u: string) => u.replace(/\/+$/, '');

export async function getHealth(baseUrl: string, timeoutMs = 5_000): Promise<LLMmapHealth> {
  const res = await fetch(`${trimUrl(baseUrl)}/health`, { signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`Server returned HTTP ${res.status}`);
  return res.json() as Promise<LLMmapHealth>;
}

export async function getQueries(baseUrl: string, timeoutMs = 10_000): Promise<LLMmapQueries> {
  const res = await fetch(`${trimUrl(baseUrl)}/queries`, { signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { msg = (await res.json()).error || msg; } catch { /* ignore */ }
    throw new Error(msg);
  }
  return res.json() as Promise<LLMmapQueries>;
}

export async function fingerprint(
  baseUrl: string,
  answers: string[],
  topK = 10,
  timeoutMs = 30_000,
): Promise<FingerprintResult> {
  const res = await fetch(`${trimUrl(baseUrl)}/fingerprint`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answers, top_k: topK }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { msg = (await res.json()).error || msg; } catch { /* ignore */ }
    throw new Error(msg);
  }
  return res.json() as Promise<FingerprintResult>;
}
