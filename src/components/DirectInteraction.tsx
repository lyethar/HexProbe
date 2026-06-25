import React, { useState, useEffect, useRef } from 'react';
import {
  Terminal, Wand2, Send, Trash2, Eye, EyeOff, Copy, Check, Settings,
  AlertTriangle, Loader2, ChevronDown, ChevronUp, Code2, RefreshCw, Cpu,
} from 'lucide-react';
import type { Store } from '../hooks/useStore';
import {
  chatComplete, extractJsonObject, loadProviderConfig, providerConfigured,
  providerLabel, providerModel, type ProviderConfig,
} from '../utils/aiProvider';
import {
  type InteractionSpec, PROMPT_TOKEN, DIRECT_INTERACTION_KEY,
  fetchSnippet, validateSpec, sendToTarget,
} from '../utils/interactionSpec';

// ── Types ──────────────────────────────────────────────────────────────────────

interface RawExchange {
  request: { method: string; url: string; headers: Record<string, string>; body: string };
  response?: { status: number; statusText: string; headers: Record<string, string>; body: string };
  error?: string;
}

interface ConsoleMessage {
  id: string;
  role: 'prompt' | 'response' | 'error';
  text: string;
  raw?: RawExchange;
  ts: string;
}

interface Persisted {
  sampleRequest: string;
  sampleResponse: string;
  specText: string;
}

const STORAGE_KEY = DIRECT_INTERACTION_KEY;

// ── Builder prompt ──────────────────────────────────────────────────────────────

const BUILD_SYSTEM = `You are an API integration assistant for an authorized AI red-teaming tool. The operator is a security tester probing an LLM endpoint they are authorized to assess.

You are given a sample HTTP REQUEST and its HTTP RESPONSE for an LLM / chat API. Produce a JSON "interaction spec" the tool will use to replay that request with new prompt text and extract the model's reply.

Output rules:
- "method": the HTTP method (e.g. POST).
- "url": the full request URL including scheme and host.
- "headers": an object with every header needed to authenticate and call the endpoint, copied verbatim from the sample (KEEP Authorization / x-api-key / api-key values exactly so the tool can replay them). Omit hop-by-hop headers: Host, Content-Length, Connection, Accept-Encoding.
- "bodyTemplate": the request body as a string, identical to the sample body but with the user's prompt text replaced by the literal token ${PROMPT_TOKEN}. Preserve every other field exactly. For JSON bodies keep it valid JSON apart from the token.
- "responsePath": a dot-notation path into the parsed JSON response that locates the assistant's reply text, using numeric indices for arrays (e.g. choices.0.message.content or content.0.text). If the response body is plain text, use an empty string.
- "name": a short human label for this endpoint.
- "notes": one short sentence flagging anything the tester must adjust (e.g. "replace REDACTED api key"). Empty string if nothing.

Output ONLY the JSON object — no markdown fences, no commentary:
{"name":"","method":"","url":"","headers":{},"bodyTemplate":"","responsePath":"","notes":""}`;

// ── Helpers ─────────────────────────────────────────────────────────────────────

function loadPersisted(): Persisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { sampleRequest: '', sampleResponse: '', specText: '', ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { sampleRequest: '', sampleResponse: '', specText: '' };
}

// ── Small copy button ────────────────────────────────────────────────────────────

function CopyBtn({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); }}
      className="btn-ghost text-xs gap-1"
    >
      {done ? <Check size={12} className="text-cyber-green" /> : <Copy size={12} />}
      {done ? 'Copied' : 'Copy'}
    </button>
  );
}

// ── Component ────────────────────────────────────────────────────────────────────

interface Props { store: Store }

export default function DirectInteraction({ store }: Props) {
  const persisted = loadPersisted();

  // Provider (shared with the AI Evaluator)
  const [cfg] = useState<ProviderConfig>(loadProviderConfig);
  const configured = providerConfigured(cfg);

  // Builder inputs
  const [sampleRequest,  setSampleRequest]  = useState(persisted.sampleRequest);
  const [sampleResponse, setSampleResponse] = useState(persisted.sampleResponse);
  const [specText,       setSpecText]       = useState(persisted.specText);
  const [building,       setBuilding]       = useState(false);
  const [buildError,     setBuildError]     = useState('');
  const [showBuilder,    setShowBuilder]    = useState(!persisted.specText);
  const [showSpec,       setShowSpec]       = useState(true);

  // Console
  const [messages, setMessages] = useState<ConsoleMessage[]>([]);
  const [input,    setInput]    = useState('');
  const [sending,  setSending]  = useState(false);
  const [verbose,  setVerbose]  = useState(false);

  const consoleEndRef = useRef<HTMLDivElement>(null);

  // Persist builder state
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ sampleRequest, sampleResponse, specText }));
  }, [sampleRequest, sampleResponse, specText]);

  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const provLabel = providerLabel(cfg.provider);

  // Parse the (possibly user-edited) spec text.
  let parsedSpec: InteractionSpec | null = null;
  let specParseError = '';
  if (specText.trim()) {
    try { parsedSpec = validateSpec(JSON.parse(specText)); }
    catch (e) { specParseError = e instanceof Error ? e.message : String(e); }
  }

  // ── Build the interaction script via the configured AI provider ────────────

  async function buildConsole() {
    if (!configured) {
      setBuildError(`No ${provLabel} credentials set. Configure a provider in Prompt Lab → AI Evaluator first.`);
      return;
    }
    if (!sampleRequest.trim()) {
      setBuildError('Paste a sample HTTP request first.');
      return;
    }
    setBuildError('');
    setBuilding(true);
    try {
      const userMsg =
        `SAMPLE HTTP REQUEST:\n${sampleRequest}\n\n` +
        `SAMPLE HTTP RESPONSE:\n${sampleResponse || '(none provided)'}`;
      const raw = await chatComplete(cfg, BUILD_SYSTEM, userMsg, { maxTokens: 2048 });
      const spec = validateSpec(extractJsonObject(raw));
      setSpecText(JSON.stringify(spec, null, 2));
      setShowBuilder(false);
      setShowSpec(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const isConn = /fetch|network|Failed to fetch|NetworkError/i.test(msg);
      setBuildError(isConn ? `Could not reach ${provLabel} to build the script: ${msg}` : msg);
    } finally {
      setBuilding(false);
    }
  }

  // ── Send a prompt to the live target endpoint ──────────────────────────────

  async function sendPrompt() {
    const prompt = input.trim();
    if (!prompt || sending) return;
    if (!parsedSpec) { setBuildError('Build or fix the interaction script before sending.'); return; }

    const spec = parsedSpec;
    setMessages(prev => [...prev, {
      id: `p-${Date.now()}`, role: 'prompt', text: prompt, ts: new Date().toISOString(),
    }]);
    setInput('');
    setSending(true);

    const result = await sendToTarget(spec, prompt, 120_000);

    const exchange: RawExchange = {
      request: { method: spec.method, url: spec.url, headers: spec.headers, body: result.requestBody },
    };
    if (result.error) {
      exchange.error = result.error;
    } else {
      exchange.response = {
        status:     result.status,
        statusText: result.statusText,
        headers:    result.headers,
        body:       result.body,
      };
    }

    if (result.error) {
      const isConn = /fetch|network|Failed to fetch|NetworkError|aborted|timeout/i.test(result.error);
      setMessages(prev => [...prev, {
        id:   `e-${Date.now()}`,
        role: 'error',
        text: isConn
          ? `Request failed: ${result.error}\n\nThe target may not allow cross-origin browser requests (CORS). Run the app behind a CORS proxy, or test an endpoint that permits browser origins.`
          : `Request failed: ${result.error}`,
        raw:  exchange,
        ts:   new Date().toISOString(),
      }]);
    } else {
      setMessages(prev => [...prev, {
        id:   `r-${Date.now()}`,
        role: result.ok ? 'response' : 'error',
        text: result.ok ? result.replyText : `HTTP ${result.status} ${result.statusText}\n${result.replyText}`,
        raw:  exchange,
        ts:   new Date().toISOString(),
      }]);
    }
    setSending(false);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* ── Page header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-cyber-text flex items-center gap-2">
            <Terminal size={22} className="text-cyber-blue" /> Direct Model Interaction
          </h1>
          <p className="text-sm text-cyber-dim mt-1">
            Turn a sample HTTP request/response into a live console for probing the model endpoint.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <Cpu size={13} className="text-cyber-purple" />
          <span className="text-cyber-dim">Script builder:</span>
          <span className="text-cyber-purple font-medium">{provLabel}</span>
          {configured && <span className="text-cyber-dim font-mono">({providerModel(cfg)})</span>}
          <button onClick={() => store.setView('promptlab')} className="btn-ghost text-xs gap-1">
            <Settings size={12} /> Configure
          </button>
        </div>
      </div>

      {/* ── Provider not configured warning ── */}
      {!configured && (
        <div className="card border-l-2 border-l-cyber-amber">
          <div className="flex items-start gap-2 text-xs text-cyber-amber">
            <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
            <div>
              The script builder needs an AI provider. Add an Anthropic or OpenAI API key (or an Ollama URL) in{' '}
              <button onClick={() => store.setView('promptlab')} className="underline text-cyber-blue">
                Prompt Lab → AI Evaluator
              </button>. You can still send prompts manually once a script is built.
            </div>
          </div>
        </div>
      )}

      {/* ── Builder card ── */}
      <div className="card">
        <button
          onClick={() => setShowBuilder(s => !s)}
          className="w-full flex items-center justify-between mb-1"
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-cyber-text">
            <Wand2 size={15} className="text-cyber-purple" /> 1. Build Interaction Script
          </span>
          {showBuilder ? <ChevronUp size={15} className="text-cyber-dim" /> : <ChevronDown size={15} className="text-cyber-dim" />}
        </button>

        {showBuilder && (
          <div className="mt-3 space-y-3">
            <p className="text-xs text-cyber-dim">
              Paste a sample request (raw HTTP, a <span className="font-mono">curl</span> command, or a fetch body) and the
              endpoint's response. The AI builder extracts the URL, headers, body template and where to inject prompts.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-cyber-dim block mb-1">Sample HTTP Request</label>
                <textarea
                  className="textarea h-44 text-xs"
                  value={sampleRequest}
                  onChange={e => setSampleRequest(e.target.value)}
                  placeholder={'POST /v1/chat/completions HTTP/1.1\nHost: api.example.com\nAuthorization: Bearer sk-...\nContent-Type: application/json\n\n{"model":"gpt-4o","messages":[{"role":"user","content":"hello"}]}'}
                />
              </div>
              <div>
                <label className="text-xs text-cyber-dim block mb-1">Sample HTTP Response</label>
                <textarea
                  className="textarea h-44 text-xs"
                  value={sampleResponse}
                  onChange={e => setSampleResponse(e.target.value)}
                  placeholder={'{"id":"chatcmpl-..","choices":[{"message":{"role":"assistant","content":"Hi there!"}}]}'}
                />
              </div>
            </div>

            {buildError && (
              <div className="text-xs text-cyber-red bg-cyber-red bg-opacity-10 border border-cyber-red border-opacity-30 rounded-lg px-3 py-2">
                {buildError}
              </div>
            )}

            <button
              onClick={buildConsole}
              disabled={building || !sampleRequest.trim()}
              className="btn-primary text-xs gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {building ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />}
              {building ? 'Building…' : specText ? 'Rebuild Script' : 'Build Console'}
            </button>
          </div>
        )}
      </div>

      {/* ── Generated script card ── */}
      {specText && (
        <div className="card">
          <button
            onClick={() => setShowSpec(s => !s)}
            className="w-full flex items-center justify-between mb-1"
          >
            <span className="flex items-center gap-2 text-sm font-semibold text-cyber-text">
              <Code2 size={15} className="text-cyber-green" /> 2. Generated Interaction Script
              {parsedSpec && <span className="text-xs text-cyber-dim font-normal">— {parsedSpec.name}</span>}
            </span>
            {showSpec ? <ChevronUp size={15} className="text-cyber-dim" /> : <ChevronDown size={15} className="text-cyber-dim" />}
          </button>

          {showSpec && (
            <div className="mt-3 space-y-3">
              {parsedSpec?.notes && (
                <div className="text-xs text-cyber-amber bg-cyber-amber bg-opacity-10 border border-cyber-amber border-opacity-25 rounded-lg px-3 py-2">
                  Note: {parsedSpec.notes}
                </div>
              )}

              {/* Quick summary chips */}
              {parsedSpec && (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="badge bg-cyber-muted text-cyber-blue border-0 font-mono">{parsedSpec.method}</span>
                  <span className="font-mono text-cyber-dim truncate max-w-[60%]">{parsedSpec.url}</span>
                  <span className="text-cyber-dim">→ reply at</span>
                  <span className="font-mono text-cyber-green">{parsedSpec.responsePath || '(raw body)'}</span>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-cyber-dim">Editable Spec (JSON) — tweak headers, keys or the {PROMPT_TOKEN} slot</label>
                  <CopyBtn text={specText} />
                </div>
                <textarea
                  className="textarea h-52 text-xs"
                  value={specText}
                  onChange={e => setSpecText(e.target.value)}
                  spellCheck={false}
                />
                {specParseError && (
                  <div className="text-xs text-cyber-red mt-1">Invalid spec JSON: {specParseError}</div>
                )}
              </div>

              {parsedSpec && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-cyber-dim">Generated fetch() preview</label>
                    <CopyBtn text={fetchSnippet(parsedSpec)} />
                  </div>
                  <pre className="prompt-block text-xs overflow-x-auto text-cyber-text">{fetchSnippet(parsedSpec)}</pre>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Interaction console ── */}
      {parsedSpec && (
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <span className="flex items-center gap-2 text-sm font-semibold text-cyber-text">
              <Terminal size={15} className="text-cyber-blue" /> 3. Interaction Console
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setVerbose(v => !v)}
                className={`btn-ghost text-xs gap-1 ${verbose ? 'text-cyber-blue' : ''}`}
                title="Show exact raw HTTP request and response"
              >
                {verbose ? <Eye size={12} /> : <EyeOff size={12} />} Verbose
              </button>
              {messages.length > 0 && (
                <button onClick={() => setMessages([])} className="btn-ghost text-xs gap-1">
                  <Trash2 size={12} /> Clear
                </button>
              )}
            </div>
          </div>

          {/* Transcript */}
          <div className="bg-cyber-bg rounded-lg border border-cyber-border p-3 h-80 overflow-y-auto space-y-3 font-mono text-xs"
               style={{ background: 'rgba(8,8,15,0.7)' }}>
            {messages.length === 0 && (
              <div className="text-cyber-dim h-full flex items-center justify-center text-center px-4">
                Send a prompt below — it is injected into the script's {PROMPT_TOKEN} slot and posted to{' '}
                <span className="font-mono text-cyber-dim">&nbsp;{parsedSpec.url}</span>.
              </div>
            )}
            {messages.map(m => (
              <div key={m.id} className="space-y-1">
                {m.role === 'prompt' ? (
                  <div className="flex gap-2">
                    <span className="text-cyber-purple flex-shrink-0">❯</span>
                    <span className="text-cyber-text whitespace-pre-wrap break-words">{m.text}</span>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <span className={`flex-shrink-0 ${m.role === 'error' ? 'text-cyber-red' : 'text-cyber-green'}`}>
                      {m.role === 'error' ? '✕' : '⮑'}
                    </span>
                    <span className={`whitespace-pre-wrap break-words ${m.role === 'error' ? 'text-cyber-red' : 'text-cyber-green'}`}>
                      {m.text}
                    </span>
                  </div>
                )}

                {/* Verbose raw HTTP */}
                {verbose && m.raw && (
                  <div className="ml-4 mt-1 space-y-2 border-l border-cyber-border pl-3">
                    <div>
                      <div className="text-cyber-dim uppercase tracking-wider text-[10px] mb-0.5">→ Raw Request</div>
                      <pre className="text-cyber-dim whitespace-pre-wrap break-words text-[11px] leading-relaxed">
{`${m.raw.request.method} ${m.raw.request.url}
${Object.entries(m.raw.request.headers).map(([k, v]) => `${k}: ${v}`).join('\n')}

${m.raw.request.body}`}
                      </pre>
                    </div>
                    {m.raw.response && (
                      <div>
                        <div className="text-cyber-dim uppercase tracking-wider text-[10px] mb-0.5">
                          ← Raw Response — HTTP {m.raw.response.status} {m.raw.response.statusText}
                        </div>
                        <pre className="text-cyber-dim whitespace-pre-wrap break-words text-[11px] leading-relaxed">
{`${Object.entries(m.raw.response.headers).map(([k, v]) => `${k}: ${v}`).join('\n')}

${m.raw.response.body}`}
                        </pre>
                      </div>
                    )}
                    {m.raw.error && (
                      <div className="text-cyber-red text-[11px]">Error: {m.raw.error}</div>
                    )}
                  </div>
                )}
              </div>
            ))}
            <div ref={consoleEndRef} />
          </div>

          {/* Input row */}
          <div className="flex items-end gap-2 mt-3">
            <textarea
              className="textarea flex-1 h-16 text-xs"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); sendPrompt(); }
              }}
              placeholder="Type a prompt to send to the model…  (Ctrl/Cmd+Enter to send)"
              disabled={sending}
            />
            <button
              onClick={sendPrompt}
              disabled={sending || !input.trim() || !!specParseError}
              className="btn-primary text-xs gap-1.5 h-16 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {sending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
              {sending ? 'Sending' : 'Send'}
            </button>
          </div>
          {specParseError && (
            <div className="text-xs text-cyber-red mt-2 flex items-center gap-1">
              <RefreshCw size={11} /> Fix the spec JSON above before sending.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
