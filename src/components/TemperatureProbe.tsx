import React, { useState, useEffect, useRef } from 'react';
import {
  Thermometer, Play, Square, Download, AlertTriangle, Loader2,
  Terminal, Code2, Activity, Zap, Hash,
} from 'lucide-react';
import type { Store } from '../hooks/useStore';
import {
  type InteractionSpec, loadInteractionSpec, sendToTarget, isRateLimited,
} from '../utils/interactionSpec';

// ── Result shape (mirrors the reference probe CSV columns) ──────────────────────

interface ProbeResult {
  request_number: number;
  timestamp: string;
  status_code: number;
  success: boolean;
  response_text: string | null;
  error_text: string | null;
  response_time_ms: number;
  conversation_id: string | null;
}

interface RateLimitInfo {
  request_num: number;
  threshold: number;   // actual req/min achieved before throttling
  status_code: number;
  elapsed_time: number; // seconds
  error?: string;
}

// ── Token & stats helpers (mirror the Python _tokens / basic_stats) ─────────────

function tokens(s: string): string[] {
  return s.match(/\w+|[^\w\s]/gu) ?? [];
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

interface LengthStats { n: number; avg: number; median: number; min: number; max: number }

function basicStats(batch: string[]): LengthStats {
  const lens = batch.map(s => tokens(s).length);
  if (lens.length === 0) return { n: 0, avg: 0, median: 0, min: 0, max: 0 };
  return {
    n: lens.length,
    avg: lens.reduce((a, b) => a + b, 0) / lens.length,
    median: median(lens),
    min: Math.min(...lens),
    max: Math.max(...lens),
  };
}

function csvField(v: unknown): string {
  const s = v == null ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

// ── Component ───────────────────────────────────────────────────────────────────

interface Props { store: Store }

export default function TemperatureProbe({ store }: Props) {
  const [spec, setSpec] = useState<InteractionSpec | null>(loadInteractionSpec);

  const [message, setMessage] = useState('What are your store hours?');
  const [numRequests, setNumRequests] = useState(10);
  const [ratePerMin, setRatePerMin] = useState(20);
  const [concurrent, setConcurrent] = useState(false);

  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<ProbeResult[]>([]);
  const [progress, setProgress] = useState(0);
  const [rateLimit, setRateLimit] = useState<RateLimitInfo | null>(null);
  const [totalTimeMs, setTotalTimeMs] = useState(0);

  const cancelRef = useRef(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Re-read the spec whenever this tab mounts (it may have been built since).
  useEffect(() => { setSpec(loadInteractionSpec()); }, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [results]);

  const delayMs = ratePerMin > 0 ? 60_000 / ratePerMin : 0;

  function toResult(n: number, r: Awaited<ReturnType<typeof sendToTarget>>): ProbeResult {
    const success = r.ok && !r.error;
    return {
      request_number: n,
      timestamp: new Date().toISOString(),
      status_code: r.status,
      success,
      response_text: success ? r.replyText : null,
      error_text: success ? null : (r.error || `HTTP ${r.status} ${r.statusText}`),
      response_time_ms: Math.round(r.responseTimeMs),
      conversation_id: r.conversationId ?? null,
    };
  }

  async function runSequential() {
    const start = performance.now();
    const collected: ProbeResult[] = [];

    for (let i = 1; i <= numRequests; i++) {
      if (cancelRef.current) break;
      const r = await sendToTarget(spec!, message, 60_000);
      const res = toResult(i, r);
      collected.push(res);
      setResults([...collected]);
      setProgress(i);

      if (!res.success && isRateLimited(res.status_code, res.error_text || '')) {
        const elapsed = (performance.now() - start) / 1000;
        setRateLimit({
          request_num: i,
          threshold: elapsed > 0 ? (i / elapsed) * 60 : 0,
          status_code: res.status_code,
          elapsed_time: elapsed,
          error: res.error_text || undefined,
        });
        break;
      }
      if (i < numRequests && !cancelRef.current) await sleep(delayMs);
    }
    setTotalTimeMs(performance.now() - start);
  }

  async function runConcurrent() {
    const start = performance.now();
    const collected: ProbeResult[] = [];
    let limitHit = false;

    const launch = async (i: number) => {
      const scheduledDelay = (i - 1) * delayMs;
      const wait = scheduledDelay - (performance.now() - start);
      if (wait > 0) await sleep(wait);
      if (cancelRef.current || limitHit) return;

      const r = await sendToTarget(spec!, message, 60_000);
      const res = toResult(i, r);
      collected.push(res);
      setResults(collected.slice().sort((a, b) => a.request_number - b.request_number));
      setProgress(p => p + 1);

      if (!res.success && isRateLimited(res.status_code, res.error_text || '') && !limitHit) {
        limitHit = true;
        const elapsed = (performance.now() - start) / 1000;
        setRateLimit({
          request_num: i,
          threshold: elapsed > 0 ? (i / elapsed) * 60 : 0,
          status_code: res.status_code,
          elapsed_time: elapsed,
          error: res.error_text || undefined,
        });
      }
    };

    const tasks: Promise<void>[] = [];
    for (let i = 1; i <= numRequests; i++) {
      if (cancelRef.current || limitHit) break;
      tasks.push(launch(i));
    }
    await Promise.all(tasks);

    collected.sort((a, b) => a.request_number - b.request_number);
    setResults([...collected]);
    setTotalTimeMs(performance.now() - start);
  }

  async function startProbe() {
    if (!spec || running) return;
    cancelRef.current = false;
    setRunning(true);
    setResults([]);
    setProgress(0);
    setRateLimit(null);
    setTotalTimeMs(0);
    try {
      if (concurrent) await runConcurrent();
      else await runSequential();
    } finally {
      setRunning(false);
    }
  }

  function stopProbe() {
    cancelRef.current = true;
  }

  function exportCsv() {
    const fields = [
      'request_number', 'timestamp', 'status_code', 'success',
      'response_text', 'error_text', 'response_time_ms', 'conversation_id',
    ] as const;
    const lines = [fields.join(',')];
    for (const r of results) {
      lines.push(fields.map(f => csvField(r[f])).join(','));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `probe_results_${concurrent ? 'concurrent' : 'sequential'}_${ts}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // ── Derived analysis ──────────────────────────────────────────────────────
  const successful = results.filter(r => r.success);
  const successText = successful.map(r => r.response_text || '');
  const uniqueResponses = new Set(successText.filter(Boolean)).size;
  const stats = basicStats(successText.filter(Boolean));
  const actualRate = totalTimeMs > 0 ? (results.length / (totalTimeMs / 1000)) * 60 : 0;

  let determinism = '';
  let determinismColor = 'text-cyber-dim';
  if (successful.length > 1) {
    if (uniqueResponses === 1) { determinism = 'Fully deterministic'; determinismColor = 'text-cyber-green'; }
    else if (uniqueResponses === successful.length) { determinism = 'Non-deterministic'; determinismColor = 'text-cyber-red'; }
    else { determinism = `Partially deterministic (${uniqueResponses} variations)`; determinismColor = 'text-cyber-amber'; }
  }

  // ── No-spec gate ──────────────────────────────────────────────────────────
  if (!spec) {
    return (
      <div className="card border-l-2 border-l-cyber-amber">
        <div className="flex items-start gap-3">
          <AlertTriangle size={18} className="text-cyber-amber flex-shrink-0 mt-0.5" />
          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-cyber-text">No interaction script found</h3>
              <p className="text-xs text-cyber-dim mt-1 max-w-xl">
                The Temperature Probe replays the interaction script built in <span className="text-cyber-blue">Direct Interaction</span>.
                Build a script there first — paste a sample request/response and let the AI generate the endpoint spec — then return here to probe determinism and rate limits.
              </p>
            </div>
            <button onClick={() => store.setView('interact')} className="btn-primary text-xs gap-1.5">
              <Terminal size={13} /> Go to Direct Interaction
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Target summary ── */}
      <div className="card">
        <div className="flex items-center gap-2 mb-2">
          <Code2 size={15} className="text-cyber-green" />
          <span className="text-sm font-semibold text-cyber-text">Target Endpoint</span>
          <span className="text-xs text-cyber-dim">— from Direct Interaction</span>
          <button onClick={() => store.setView('interact')} className="btn-ghost text-xs ml-auto">Edit script</button>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="badge bg-cyber-muted text-cyber-blue border-0 font-mono">{spec.method}</span>
          <span className="font-mono text-cyber-dim truncate max-w-[55%]">{spec.url}</span>
          <span className="text-cyber-dim">→ reply at</span>
          <span className="font-mono text-cyber-green">{spec.responsePath || '(raw body)'}</span>
        </div>
      </div>

      {/* ── Config ── */}
      <div className="card space-y-4">
        <div className="flex items-center gap-2">
          <Thermometer size={15} className="text-cyber-blue" />
          <span className="text-sm font-semibold text-cyber-text">Probe Configuration</span>
        </div>

        <div>
          <label className="text-xs text-cyber-dim block mb-1">Message (sent identically each request)</label>
          <textarea
            className="textarea h-20 text-xs"
            value={message}
            onChange={e => setMessage(e.target.value)}
            disabled={running}
            placeholder="The prompt to send repeatedly…"
          />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="text-xs text-cyber-dim block mb-1">Requests</label>
            <input
              type="number" min={1} max={500} className="input text-xs"
              value={numRequests}
              onChange={e => setNumRequests(Math.max(1, Number(e.target.value) || 1))}
              disabled={running}
            />
          </div>
          <div>
            <label className="text-xs text-cyber-dim block mb-1">Rate (req/min)</label>
            <input
              type="number" min={1} max={600} className="input text-xs"
              value={ratePerMin}
              onChange={e => setRatePerMin(Math.max(1, Number(e.target.value) || 1))}
              disabled={running}
            />
          </div>
          <div>
            <label className="text-xs text-cyber-dim block mb-1">Delay</label>
            <div className="input text-xs flex items-center text-cyber-dim font-mono">{(delayMs / 1000).toFixed(3)}s</div>
          </div>
          <div>
            <label className="text-xs text-cyber-dim block mb-1">Mode</label>
            <button
              onClick={() => !running && setConcurrent(c => !c)}
              disabled={running}
              className={`input text-xs flex items-center gap-1.5 ${concurrent ? 'text-cyber-purple' : 'text-cyber-dim'} disabled:opacity-60`}
              title="Concurrent fires requests on schedule regardless of response time"
            >
              {concurrent ? <Zap size={12} /> : <Activity size={12} />}
              {concurrent ? 'Concurrent' : 'Sequential'}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!running ? (
            <button onClick={startProbe} className="btn-primary text-xs gap-1.5">
              <Play size={13} /> Run Probe
            </button>
          ) : (
            <button onClick={stopProbe} className="btn-secondary text-xs gap-1.5">
              <Square size={13} /> Stop
            </button>
          )}
          {running && (
            <span className="text-xs text-cyber-dim flex items-center gap-1.5">
              <Loader2 size={12} className="animate-spin" /> {progress}/{numRequests} sent…
            </span>
          )}
          {results.length > 0 && (
            <button onClick={exportCsv} className="btn-ghost text-xs gap-1 ml-auto">
              <Download size={12} /> Export CSV
            </button>
          )}
        </div>

        <p className="text-[11px] text-cyber-dim">
          Browser requests are subject to CORS. If the target rejects cross-origin calls, run the app behind a proxy or use an endpoint that allows browser origins.
        </p>
      </div>

      {/* ── Summary ── */}
      {results.length > 0 && (
        <div className="card space-y-4">
          <div className="flex items-center gap-2">
            <Activity size={15} className="text-cyber-blue" />
            <span className="text-sm font-semibold text-cyber-text">Results Summary</span>
            {running && <Loader2 size={12} className="animate-spin text-cyber-dim" />}
          </div>

          {/* Stat tiles */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Total Sent" value={String(results.length)} />
            <Stat label="Successful" value={`${successful.length}/${results.length}`} />
            <Stat label="Actual Rate" value={`${actualRate.toFixed(1)} /min`} />
            <Stat label="Total Time" value={`${(totalTimeMs / 1000).toFixed(2)}s`} />
          </div>

          {/* Rate limit banner */}
          {rateLimit && (
            <div className="text-xs text-cyber-red bg-cyber-red bg-opacity-10 border border-cyber-red border-opacity-30 rounded-lg px-3 py-2 space-y-0.5">
              <div className="font-semibold flex items-center gap-1.5">
                <AlertTriangle size={13} /> Rate limiting detected at request {rateLimit.request_num}
              </div>
              <div className="text-cyber-dim">
                Status {rateLimit.status_code} · achieved ~{rateLimit.threshold.toFixed(2)} req/min over {rateLimit.elapsed_time.toFixed(2)}s
                {rateLimit.error ? ` · ${rateLimit.error}` : ''}
              </div>
            </div>
          )}

          {/* Determinism + length stats */}
          {successful.length > 1 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="prompt-block">
                <div className="text-cyber-dim mb-1 flex items-center gap-1.5"><Hash size={12} /> Determinism</div>
                <div className={`font-medium ${determinismColor}`}>{determinism}</div>
                <div className="text-cyber-dim mt-1">{uniqueResponses}/{successful.length} unique responses</div>
              </div>
              <div className="prompt-block">
                <div className="text-cyber-dim mb-1 flex items-center gap-1.5"><Activity size={12} /> Response length (tokens)</div>
                <div className="text-cyber-text font-mono">
                  avg {stats.avg.toFixed(1)} · median {stats.median.toFixed(1)} · min {stats.min} · max {stats.max}
                </div>
              </div>
            </div>
          )}

          {/* Per-request table */}
          <div className="overflow-x-auto max-h-96 overflow-y-auto border border-cyber-border rounded-lg">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-cyber-card">
                <tr className="text-cyber-dim text-left border-b border-cyber-border">
                  <th className="px-2 py-1.5 font-medium">#</th>
                  <th className="px-2 py-1.5 font-medium">Status</th>
                  <th className="px-2 py-1.5 font-medium">Time</th>
                  <th className="px-2 py-1.5 font-medium">Response / Error</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {results.map(r => (
                  <tr key={r.request_number} className="border-b border-cyber-border border-opacity-40 align-top">
                    <td className="px-2 py-1.5 text-cyber-dim">{r.request_number}</td>
                    <td className="px-2 py-1.5">
                      <span className={r.success ? 'text-cyber-green' : 'text-cyber-red'}>
                        {r.status_code || '—'}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-cyber-dim">{r.response_time_ms}ms</td>
                    <td className={`px-2 py-1.5 whitespace-pre-wrap break-words max-w-md ${r.success ? 'text-cyber-text' : 'text-cyber-red'}`}>
                      {r.success ? (r.response_text || '(empty)') : (r.error_text || 'error')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div ref={logEndRef} />
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="prompt-block text-center">
      <div className="text-cyber-dim text-[11px] uppercase tracking-wider">{label}</div>
      <div className="text-cyber-text font-semibold mt-0.5">{value}</div>
    </div>
  );
}
