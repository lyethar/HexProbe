import React, { useState, useEffect } from 'react';
import {
  Fingerprint, Plug, Loader2, AlertTriangle, CheckCircle2, Send, Copy, Check,
  Radar, Terminal, RefreshCw, Trophy, Server,
} from 'lucide-react';
import type { Store } from '../hooks/useStore';
import {
  loadInteractionSpec, sendToTarget, type InteractionSpec,
} from '../utils/interactionSpec';
import {
  loadLLMmapConfig, saveLLMmapConfig, getHealth, getQueries, fingerprint,
  type LLMmapConfig, type LLMmapHealth, type FingerprintResult,
} from '../utils/llmmap';

type Mode = 'auto' | 'manual';

function CopyBtn({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1200); }}
      className="btn-ghost text-xs gap-1"
    >
      {done ? <Check size={11} className="text-cyber-green" /> : <Copy size={11} />}
      {done ? 'Copied' : 'Copy'}
    </button>
  );
}

interface Props { store: Store }

export default function ModelFingerprint({ store }: Props) {
  const [cfg, setCfg] = useState<LLMmapConfig>(loadLLMmapConfig);
  useEffect(() => { saveLLMmapConfig(cfg); }, [cfg]);

  const [spec] = useState<InteractionSpec | null>(loadInteractionSpec);

  const [health, setHealth] = useState<LLMmapHealth | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [connError, setConnError] = useState('');

  const [queries, setQueries] = useState<string[]>([]);
  const [maxChars, setMaxChars] = useState(650);

  const [mode, setMode] = useState<Mode>(spec ? 'auto' : 'manual');
  const [answers, setAnswers] = useState<string[]>([]);
  const [probeStatus, setProbeStatus] = useState<('' | 'pending' | 'ok' | 'error')[]>([]);
  const [collecting, setCollecting] = useState(false);

  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<FingerprintResult | null>(null);
  const [runError, setRunError] = useState('');

  // ── Connect to the sidecar ────────────────────────────────────────────────
  async function connect() {
    setConnecting(true);
    setConnError('');
    try {
      const h = await getHealth(cfg.baseUrl);
      setHealth(h);
      if (h.ready) {
        const q = await getQueries(cfg.baseUrl);
        setQueries(q.queries);
        setMaxChars(q.max_chars);
        setAnswers(Array(q.queries.length).fill(''));
        setProbeStatus(Array(q.queries.length).fill(''));
        setResult(null);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const isConn = /fetch|network|Failed to fetch|NetworkError|timeout|aborted/i.test(msg);
      setConnError(isConn
        ? `Could not reach the LLMmap sidecar at ${cfg.baseUrl}. Start it from the repo root with: python scripts/llmmap_server.py`
        : msg);
      setHealth(null);
    } finally {
      setConnecting(false);
    }
  }

  // ── Auto mode: fire the probes at the target endpoint ─────────────────────
  async function collectFromTarget() {
    if (!spec || collecting) return;
    setCollecting(true);
    setRunError('');
    const next = Array(queries.length).fill('');
    const stat: ('' | 'pending' | 'ok' | 'error')[] = Array(queries.length).fill('pending');
    setProbeStatus([...stat]);
    for (let i = 0; i < queries.length; i++) {
      const r = await sendToTarget(spec, queries[i], 60_000);
      if (r.ok && !r.error) {
        next[i] = (r.replyText || '').slice(0, maxChars);
        stat[i] = 'ok';
      } else {
        next[i] = '';
        stat[i] = 'error';
      }
      setAnswers([...next]);
      setProbeStatus([...stat]);
    }
    setCollecting(false);
  }

  // ── Run the fingerprint ───────────────────────────────────────────────────
  async function runFingerprint() {
    if (running) return;
    if (answers.some(a => !a.trim())) {
      setRunError('All probe responses must be filled before fingerprinting.');
      return;
    }
    setRunning(true);
    setRunError('');
    setResult(null);
    try {
      const res = await fingerprint(cfg.baseUrl, answers, 10);
      setResult(res);
    } catch (e) {
      setRunError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }

  const ready = health?.ready === true;
  const allFilled = answers.length > 0 && answers.every(a => a.trim());
  const maxDist = result ? Math.max(...result.predictions.map(p => p.distance), 1) : 1;
  const minDist = result ? Math.min(...result.predictions.map(p => p.distance)) : 0;

  return (
    <div className="space-y-6">
      {/* ── Intro ── */}
      <div className="card">
        <div className="flex items-start gap-3">
          <Fingerprint size={20} className="text-cyber-purple flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-cyber-text">Model Fingerprinting — LLMmap</h3>
            <p className="text-xs text-cyber-dim mt-1 max-w-3xl">
              Identify the LLM behind an endpoint by its behavioural traces. LLMmap sends a small set of fixed probe
              queries; the responses are matched against signatures for 50+ known models.
              Inference runs in a local Python sidecar (PyTorch) — start it with <span className="font-mono text-cyber-blue">python scripts/llmmap_server.py</span> and
              connect below.
            </p>
          </div>
        </div>
      </div>

      {/* ── Sidecar connection ── */}
      <div className="card space-y-3">
        <div className="flex items-center gap-2">
          <Server size={15} className="text-cyber-blue" />
          <span className="text-sm font-semibold text-cyber-text">LLMmap Sidecar</span>
          {health && (
            ready
              ? <span className="badge bg-cyber-green bg-opacity-15 text-cyber-green border-0 ml-1">ready</span>
              : health.loading
                ? <span className="badge bg-cyber-amber bg-opacity-15 text-cyber-amber border-0 ml-1">loading model…</span>
                : <span className="badge bg-cyber-red bg-opacity-15 text-cyber-red border-0 ml-1">not ready</span>
          )}
          {health?.mock && <span className="badge bg-cyber-purple bg-opacity-15 text-cyber-purple border-0">mock</span>}
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[260px]">
            <label className="text-xs text-cyber-dim block mb-1">Server URL</label>
            <input
              className="input text-xs font-mono"
              value={cfg.baseUrl}
              onChange={e => setCfg({ ...cfg, baseUrl: e.target.value })}
              placeholder="http://localhost:8765"
              spellCheck={false}
            />
          </div>
          <button onClick={connect} disabled={connecting} className="btn-primary text-xs gap-1.5">
            {connecting ? <Loader2 size={13} className="animate-spin" /> : <Plug size={13} />}
            {connecting ? 'Connecting…' : 'Connect'}
          </button>
        </div>

        {connError && (
          <div className="text-xs text-cyber-red bg-cyber-red bg-opacity-10 border border-cyber-red border-opacity-30 rounded-lg px-3 py-2">
            {connError}
          </div>
        )}

        {health && !ready && health.loading && (
          <div className="text-xs text-cyber-amber flex items-center gap-1.5">
            <Loader2 size={12} className="animate-spin" />
            Model is loading (first run downloads the embedding model). Click <b>Connect</b> again in a moment.
          </div>
        )}
        {health?.error && (
          <div className="text-xs text-cyber-red">Server error: {health.error}</div>
        )}
        {ready && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-cyber-dim">
            <span className="flex items-center gap-1"><CheckCircle2 size={12} className="text-cyber-green" /> {health!.n_queries} probe queries</span>
            <span>{health!.llms_supported} models in signature DB</span>
            <span className="font-mono truncate max-w-[40%]">{health!.model_path}</span>
          </div>
        )}
      </div>

      {/* ── Probe & collect ── */}
      {ready && queries.length > 0 && (
        <div className="card space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Radar size={15} className="text-cyber-blue" />
              <span className="text-sm font-semibold text-cyber-text">Probe Responses</span>
            </div>
            {/* Mode toggle */}
            <div className="flex items-center gap-1 text-xs">
              <button
                onClick={() => setMode('auto')}
                disabled={!spec}
                className={`px-2.5 py-1 rounded-md border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                  mode === 'auto' ? 'border-cyber-blue text-cyber-blue' : 'border-cyber-border text-cyber-dim'
                }`}
                title={spec ? 'Send probes to the Direct Interaction target automatically' : 'Build an interaction script in Direct Interaction to enable auto mode'}
              >
                Auto (target)
              </button>
              <button
                onClick={() => setMode('manual')}
                className={`px-2.5 py-1 rounded-md border transition-colors ${
                  mode === 'manual' ? 'border-cyber-blue text-cyber-blue' : 'border-cyber-border text-cyber-dim'
                }`}
              >
                Manual (paste)
              </button>
            </div>
          </div>

          {/* Auto-mode controls */}
          {mode === 'auto' && (
            spec ? (
              <div className="flex flex-wrap items-center gap-3">
                <button onClick={collectFromTarget} disabled={collecting} className="btn-primary text-xs gap-1.5">
                  {collecting ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                  {collecting ? 'Probing target…' : `Send ${queries.length} probes to target`}
                </button>
                <span className="text-xs text-cyber-dim font-mono truncate max-w-[50%]">
                  {spec.method} {spec.url}
                </span>
                <button onClick={() => store.setView('interact')} className="btn-ghost text-xs">Edit target</button>
              </div>
            ) : (
              <div className="text-xs text-cyber-amber bg-cyber-amber bg-opacity-10 border border-cyber-amber border-opacity-25 rounded-lg px-3 py-2 flex items-center gap-2">
                <AlertTriangle size={13} />
                No interaction script found. Build one in
                <button onClick={() => store.setView('interact')} className="underline text-cyber-blue inline-flex items-center gap-1">
                  <Terminal size={11} /> Direct Interaction
                </button>
                to auto-probe, or use Manual mode.
              </div>
            )
          )}

          {/* Per-query rows */}
          <div className="space-y-3">
            {queries.map((q, i) => (
              <div key={i} className="border border-cyber-border rounded-lg p-3 space-y-2" style={{ background: 'rgba(8,8,15,0.4)' }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="text-xs text-cyber-dim">
                    <span className="text-cyber-purple font-semibold">Probe {i + 1}/{queries.length}</span>
                    <span className="font-mono text-cyber-text ml-2 break-words whitespace-pre-wrap">{q}</span>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {probeStatus[i] === 'pending' && <Loader2 size={12} className="animate-spin text-cyber-amber" />}
                    {probeStatus[i] === 'ok' && <CheckCircle2 size={12} className="text-cyber-green" />}
                    {probeStatus[i] === 'error' && <AlertTriangle size={12} className="text-cyber-red" />}
                    <CopyBtn text={q} />
                  </div>
                </div>
                <textarea
                  className="textarea h-20 text-xs font-mono"
                  value={answers[i] ?? ''}
                  onChange={e => {
                    const next = [...answers];
                    next[i] = e.target.value.slice(0, maxChars);
                    setAnswers(next);
                  }}
                  placeholder={mode === 'auto' ? 'Response will appear here after probing…' : 'Paste the target model’s response to this probe…'}
                  spellCheck={false}
                />
                <div className="text-[10px] text-cyber-dim text-right">{(answers[i] ?? '').length}/{maxChars}</div>
              </div>
            ))}
          </div>

          {runError && (
            <div className="text-xs text-cyber-red bg-cyber-red bg-opacity-10 border border-cyber-red border-opacity-30 rounded-lg px-3 py-2">
              {runError}
            </div>
          )}

          <button
            onClick={runFingerprint}
            disabled={running || !allFilled}
            className="btn-primary text-sm gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {running ? <Loader2 size={14} className="animate-spin" /> : <Fingerprint size={14} />}
            {running ? 'Fingerprinting…' : 'Identify Model'}
          </button>
        </div>
      )}

      {/* ── Results ── */}
      {result && (
        <div className="card space-y-4">
          <div className="flex items-center gap-2">
            <Trophy size={15} className="text-cyber-amber" />
            <span className="text-sm font-semibold text-cyber-text">Fingerprint Result</span>
          </div>

          {result.top_model && (
            <div className="rounded-lg px-4 py-3 border border-cyber-purple border-opacity-40"
                 style={{ background: 'rgba(199,125,255,0.08)' }}>
              <div className="text-xs text-cyber-dim">Best match</div>
              <div className="text-lg font-bold text-cyber-purple font-mono break-words">{result.top_model}</div>
              <div className="text-xs text-cyber-dim mt-0.5">
                closest signature · distance {result.predictions[0]?.distance.toFixed(2)} (lower = more confident)
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            {result.predictions.map(p => {
              // Closer (smaller distance) => fuller bar.
              const frac = maxDist === minDist ? 1 : 1 - (p.distance - minDist) / (maxDist - minDist);
              return (
                <div key={p.rank} className="flex items-center gap-3 text-xs">
                  <span className="text-cyber-dim w-5 text-right">{p.rank}</span>
                  <span className={`font-mono flex-1 truncate ${p.rank === 1 ? 'text-cyber-purple font-semibold' : 'text-cyber-text'}`}>
                    {p.model}
                  </span>
                  <div className="w-40 h-1.5 rounded-full bg-cyber-border overflow-hidden flex-shrink-0">
                    <div className="h-full rounded-full"
                         style={{ width: `${Math.max(4, frac * 100)}%`, background: p.rank === 1 ? '#c77dff' : '#00d4ff' }} />
                  </div>
                  <span className="text-cyber-dim font-mono w-16 text-right">{p.distance.toFixed(2)}</span>
                </div>
              );
            })}
          </div>

          <button onClick={runFingerprint} disabled={running} className="btn-ghost text-xs gap-1">
            <RefreshCw size={12} /> Re-run
          </button>
        </div>
      )}
    </div>
  );
}
