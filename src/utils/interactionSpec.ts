// Shared "interaction spec" logic used by Direct Model Interaction and the
// Temperature Probe. A spec is built once in Direct Interaction (the AI turns a
// sample request/response into this shape) and replayed to the live endpoint.

export interface InteractionSpec {
  name: string;
  method: string;
  url: string;
  headers: Record<string, string>;
  bodyTemplate: string;   // contains the literal token {{PROMPT}}
  responsePath: string;   // dot path to assistant text; '' = whole body
  notes?: string;
}

export const PROMPT_TOKEN = '{{PROMPT}}';
export const DIRECT_INTERACTION_KEY = 'ai-direct-interaction-v1';

export function getByPath(obj: unknown, path: string): unknown {
  if (!path) return obj;
  return path.split('.').reduce<unknown>(
    (acc, key) => (acc == null ? acc : (acc as Record<string, unknown>)[key]),
    obj,
  );
}

// Substitute the prompt into the body template. For JSON bodies the prompt is
// escaped for a JSON string context; otherwise it is inserted raw.
export function buildBody(template: string, prompt: string): string {
  const looksJson = /^\s*[{[]/.test(template);
  const value = looksJson ? JSON.stringify(prompt).slice(1, -1) : prompt;
  return template.split(PROMPT_TOKEN).join(value);
}

export function validateSpec(obj: unknown): InteractionSpec {
  const o = obj as Partial<InteractionSpec>;
  if (!o || typeof o !== 'object') throw new Error('Spec is not an object.');
  if (!o.url || !o.method) throw new Error('Spec is missing "url" or "method".');
  if (typeof o.bodyTemplate !== 'string') throw new Error('Spec is missing "bodyTemplate".');
  return {
    name:         o.name || 'Target Endpoint',
    method:       String(o.method).toUpperCase(),
    url:          o.url,
    headers:      (o.headers && typeof o.headers === 'object') ? o.headers as Record<string, string> : {},
    bodyTemplate: o.bodyTemplate,
    responsePath: typeof o.responsePath === 'string' ? o.responsePath : '',
    notes:        o.notes || '',
  };
}

export function fetchSnippet(spec: InteractionSpec): string {
  const headerLines = Object.entries(spec.headers)
    .map(([k, v]) => `    ${JSON.stringify(k)}: ${JSON.stringify(v)},`)
    .join('\n');
  const body = buildBody(spec.bodyTemplate, 'YOUR PROMPT HERE');
  return `await fetch(${JSON.stringify(spec.url)}, {
  method: ${JSON.stringify(spec.method)},
  headers: {
${headerLines}
  },
  body: ${JSON.stringify(body)},
});
// reply = response.${spec.responsePath || '(raw body)'}`;
}

// Read the spec the user built in Direct Interaction (if any).
export function loadInteractionSpec(): InteractionSpec | null {
  try {
    const raw = localStorage.getItem(DIRECT_INTERACTION_KEY);
    if (!raw) return null;
    const { specText } = JSON.parse(raw);
    if (!specText || !String(specText).trim()) return null;
    return validateSpec(JSON.parse(specText));
  } catch {
    return null;
  }
}

export interface TargetResult {
  ok: boolean;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  requestBody: string;
  body: string;
  replyText: string;
  responseTimeMs: number;
  conversationId?: string;
  error?: string;
}

// Replay the spec against the live endpoint with one prompt. Never throws —
// transport failures come back as a result with ok=false and an error string.
export async function sendToTarget(
  spec: InteractionSpec,
  prompt: string,
  timeoutMs = 60_000,
): Promise<TargetResult> {
  const requestBody = buildBody(spec.bodyTemplate, prompt);
  const start = performance.now();

  try {
    const res = await fetch(spec.url, {
      method:  spec.method,
      headers: spec.headers,
      body:    ['GET', 'HEAD'].includes(spec.method) ? undefined : requestBody,
      signal:  AbortSignal.timeout(timeoutMs),
    });

    const body = await res.text();
    const responseTimeMs = performance.now() - start;

    let replyText = body;
    let conversationId: string | undefined;
    try {
      const json = JSON.parse(body) as Record<string, unknown>;
      const extracted = getByPath(json, spec.responsePath);
      if (extracted != null) {
        replyText = typeof extracted === 'string' ? extracted : JSON.stringify(extracted);
      } else if (spec.responsePath) {
        replyText = `(could not resolve responsePath "${spec.responsePath}")\n\n${body}`;
      }
      const cid = json.conversation_id ?? json.conversationId ?? json.id;
      if (cid != null) conversationId = String(cid);
    } catch {
      // not JSON — keep raw text
    }

    return {
      ok: res.ok,
      status: res.status,
      statusText: res.statusText,
      headers: Object.fromEntries(res.headers.entries()),
      requestBody,
      body,
      replyText,
      responseTimeMs,
      conversationId,
    };
  } catch (e) {
    return {
      ok: false,
      status: 0,
      statusText: '',
      headers: {},
      requestBody,
      body: '',
      replyText: '',
      responseTimeMs: performance.now() - start,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

// Is an HTTP outcome a rate-limit signal? Mirrors the reference probe script.
export function isRateLimited(status: number, errorText: string): boolean {
  const e = (errorText || '').toLowerCase();
  return status === 429 || e.includes('rate limit') || e.includes('too many requests');
}
