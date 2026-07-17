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
  return url ? url.replace(/\/$/, '') : null;
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
    res = await fetch(`${base}${path}`, { method: 'POST', headers, body: form as unknown as BodyInit });
  } catch (e) {
    return sendError(c, 'upstream_failed', e instanceof Error ? e.message : 'AI service unreachable', 502);
  }
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = (json && (json.detail || json.error?.message)) || `AI request failed (${res.status})`;
    return sendError(c, 'upstream_failed', String(msg), res.status >= 500 ? 502 : 400);
  }
  return sendData(c, json);
}

manufacturerAiRoutes.post('/ai/describe', (c) => forward(c, '/describe'));
manufacturerAiRoutes.post('/ai/catalog', (c) => forward(c, '/catalog'));
manufacturerAiRoutes.post('/ai/transparent', (c) => forward(c, '/transparent'));
