import { Hono, type Context } from 'hono';

import { getServerEnv } from '@/lib/env';
import { sendData, sendError } from '../envelope';
import { manufacturerGuard, type AppEnv } from '../guards';

/**
 * Server-side proxy to the AI-Features Python service. The browser never sees the
 * service URL or key — the manufacturer portal calls these, we forward with the
 * x-api-key header. If AI_FEATURES_URL is unset, /status reports disabled and the
 * UI hides the "Generate with AI" button (manual add still works).
 *
 * Endpoints:
 *   GET  /ai/status                    -> { enabled }
 *   POST /ai/describe    (multipart)   -> { designName, description }
 *   POST /ai/catalog     (multipart)   -> { imageBase64 }
 *   POST /ai/transparent (multipart)   -> { imageBase64 }
 */
export const manufacturerAiRoutes = new Hono<AppEnv>();
manufacturerAiRoutes.use('/ai/*', manufacturerGuard);

function aiBase(): string | null {
  const url = getServerEnv().AI_FEATURES_URL;
  if (!url) return null;
  // HF Space hostnames are lowercase; a capital-cased URL 307-redirects and the
  // POST body can be dropped on redirect -> upstream error. Lowercase the host.
  return url.replace(/\/$/, '').replace(/^https?:\/\/[^/]+/i, (m) => m.toLowerCase());
}

manufacturerAiRoutes.get('/ai/status', (c) => {
  return sendData(c, { enabled: !!aiBase() });
});

async function forward(c: Context<AppEnv>, path: string) {
  const base = aiBase();
  if (!base) return sendError(c, 'upstream_failed', 'AI features are not configured.', 503);

  // Re-read the multipart body from the incoming request and forward it as-is.
  const form = await c.req.formData();
  const key = getServerEnv().AI_FEATURES_API_KEY;
  const headers: Record<string, string> = {};
  if (key) headers['x-api-key'] = key;

  let res: Response;
  try {
    res = await fetch(`${base}${path}`, {
      method: 'POST',
      headers,
      body: form as unknown as BodyInit,
      redirect: 'follow',
    });
  } catch (e) {
    const detail = e instanceof Error ? `${e.name}: ${e.message}` : 'AI service unreachable';
    console.error('[ai-proxy] fetch error', path, detail);
    return sendError(c, 'upstream_failed', `AI service unreachable — ${detail}`, 502);
  }
  const text = await res.text();
  let json: unknown = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* non-JSON upstream */ }
  if (!res.ok) {
    const j = json as { detail?: string; error?: { message?: string } } | null;
    const msg = (j && (j.detail || j.error?.message)) || `AI upstream ${res.status}: ${text.slice(0, 200)}`;
    console.error('[ai-proxy] upstream not ok', path, res.status, msg);
    return sendError(c, 'upstream_failed', String(msg), res.status >= 500 ? 502 : 400);
  }
  return sendData(c, json);
}

manufacturerAiRoutes.post('/ai/describe', (c) => forward(c, '/describe'));
manufacturerAiRoutes.post('/ai/catalog', (c) => forward(c, '/catalog'));
manufacturerAiRoutes.post('/ai/transparent', (c) => forward(c, '/transparent'));
