import { getServerEnv } from '@/lib/env';

/**
 * WhatsApp Cloud API (Meta) — business-initiated template messages.
 *
 * Mirrors lib/email.ts: every send is best-effort and NEVER throws, so an
 * approval or order is never blocked or failed by WhatsApp being down,
 * unconfigured, or a template not yet approved. Outcomes are logged as
 * `[whatsapp] sent …` / `[whatsapp] send FAILED: …` so container logs show
 * the real reason.
 *
 * Nothing here hardcodes a phone number: the sender is whatever
 * WHATSAPP_PHONE_NUMBER_ID points at, and outside production every message
 * is redirected to WHATSAPP_TEST_RECIPIENT (see resolveRecipient).
 */

const REQUEST_TIMEOUT_MS = 20_000;

type WhatsAppConfig = { token: string; phoneNumberId: string; apiVersion: string; language: string };

function getConfig(): WhatsAppConfig | null {
  const env = getServerEnv();
  if (!env.WHATSAPP_ACCESS_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID) return null;
  return {
    token: env.WHATSAPP_ACCESS_TOKEN,
    phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID,
    apiVersion: env.WHATSAPP_API_VERSION,
    language: env.WHATSAPP_TEMPLATE_LANGUAGE,
  };
}

export function isWhatsAppConfigured(): boolean {
  return getConfig() !== null;
}

/**
 * Normalizes a stored mobile number to WhatsApp's digits-only international
 * form. A bare 10-digit number is treated as Indian (every registration
 * collects a 10-digit Indian mobile). Returns null when it can't be a number.
 */
export function toWhatsAppNumber(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (/^[6-9]\d{9}$/.test(digits)) return `91${digits}`;
  if (/^0[6-9]\d{9}$/.test(digits)) return `91${digits.slice(1)}`;
  if (/^\d{11,15}$/.test(digits)) return digits;
  return null;
}

/** Last 4 digits only — full numbers never go into logs. */
function mask(number: string): string {
  return `***${number.slice(-4)}`;
}

function resolveRecipient(raw: string | null | undefined): string | null {
  // Whenever a test recipient is configured, EVERY message is forced to it and
  // the real recipient is ignored. This machine's .env is a copy of production
  // (NODE_ENV=production, real retailer numbers in the DB), so the redirect
  // must not depend on NODE_ENV — a test number set here is an explicit
  // "send everything to me" switch. Production leaves WHATSAPP_TEST_RECIPIENT
  // unset, so real recipients get their messages.
  const test = toWhatsAppNumber(getServerEnv().WHATSAPP_TEST_RECIPIENT);
  if (test) return test;
  return toWhatsAppNumber(raw);
}

/** Template text parameters can't contain newlines/tabs or long runs of spaces. */
function cleanParam(value: string | number | null | undefined): string {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text || '-';
}

async function graphRequest(cfg: WhatsAppConfig, path: string, init: RequestInit): Promise<unknown> {
  const res = await fetch(`https://graph.facebook.com/${cfg.apiVersion}/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${cfg.token}`, ...init.headers },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const json = (await res.json().catch(() => ({}))) as { error?: { message?: string; code?: number } };
  if (!res.ok || json.error) {
    throw new Error(`${res.status} ${json.error?.message ?? 'request failed'}${json.error?.code ? ` (code ${json.error.code})` : ''}`);
  }
  return json;
}

/** Uploads a PDF to WhatsApp's own media store; the returned id is valid ~30 days. */
async function uploadDocument(cfg: WhatsAppConfig, pdf: Uint8Array, filename: string): Promise<string> {
  const form = new FormData();
  form.append('messaging_product', 'whatsapp');
  form.append('type', 'application/pdf');
  form.append('file', new Blob([pdf as BlobPart], { type: 'application/pdf' }), filename);
  const json = (await graphRequest(cfg, `${cfg.phoneNumberId}/media`, { method: 'POST', body: form })) as { id?: string };
  if (!json.id) throw new Error('media upload returned no id');
  return json.id;
}

async function sendTemplate(opts: {
  label: string;
  to: string | null | undefined;
  template: string;
  bodyParams: Array<string | number | null | undefined>;
  document?: { pdf: Uint8Array; filename: string };
}): Promise<boolean> {
  try {
    const cfg = getConfig();
    if (!cfg) return false;
    const to = resolveRecipient(opts.to);
    if (!to) {
      if (getServerEnv().NODE_ENV === 'production') console.warn(`[whatsapp] ${opts.label}: no valid mobile number, not sent`);
      return false;
    }

    const components: unknown[] = [];
    if (opts.document) {
      const mediaId = await uploadDocument(cfg, opts.document.pdf, opts.document.filename);
      components.push({
        type: 'header',
        parameters: [{ type: 'document', document: { id: mediaId, filename: opts.document.filename } }],
      });
    }
    components.push({
      type: 'body',
      parameters: opts.bodyParams.map((p) => ({ type: 'text', text: cleanParam(p) })),
    });

    await graphRequest(cfg, `${cfg.phoneNumberId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: { name: opts.template, language: { code: cfg.language }, components },
      }),
    });
    console.info(`[whatsapp] sent ${opts.label} to ${mask(to)}`);
    return true;
  } catch (e) {
    console.warn(`[whatsapp] send FAILED (${opts.label}): ${e instanceof Error ? e.message : String(e)}`);
    return false;
  }
}

/** jf_order_approved_2 — {{1}} name, {{2}} order no., {{3}} expected delivery. */
export function sendOrderApprovedWhatsApp(opts: {
  to: string | null | undefined;
  name: string;
  orderNumber: string;
  expectedDelivery: string;
}): Promise<boolean> {
  return sendTemplate({
    label: `order-approved ${opts.orderNumber}`,
    to: opts.to,
    template: getServerEnv().WHATSAPP_TEMPLATE_ORDER_APPROVED,
    bodyParams: [opts.name, opts.orderNumber, opts.expectedDelivery],
  });
}

/**
 * jf_order_placed — {{1}} name, {{2}} order no., {{3}} designs,
 * {{4}} total qty, {{5}} expected delivery. The order PDF rides in a document
 * header ONLY when a Document-header template is in use (WHATSAPP_ORDER_PDF);
 * otherwise it's a text-only confirmation, since the approved template has no
 * header and attaching a document to it would be rejected by Meta.
 */
export function sendOrderPlacedWhatsApp(opts: {
  to: string | null | undefined;
  name: string;
  orderNumber: string;
  designs: number;
  totalQuantity: number;
  expectedDelivery: string;
  pdf?: Uint8Array;
}): Promise<boolean> {
  return sendTemplate({
    label: `order-placed ${opts.orderNumber}`,
    to: opts.to,
    template: getServerEnv().WHATSAPP_TEMPLATE_ORDER_PLACED,
    bodyParams: [opts.name, opts.orderNumber, opts.designs, opts.totalQuantity, opts.expectedDelivery],
    document: opts.pdf ? { pdf: opts.pdf, filename: `${opts.orderNumber}.pdf` } : undefined,
  });
}
