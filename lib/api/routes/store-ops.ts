import { jsonValidator } from '../validation';
import { Hono } from 'hono';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/password';
import { getStoreDashboard } from '@/lib/db/store-dashboard';
import { getIntelligenceSummary, getRecommendations } from '@/lib/db/intelligence';
import {
  getKioskOrdersByStore, getKioskOrderForStore, approveKioskOrder, rejectKioskOrder,
  getB2bOrdersByStore, getB2bOrderForStore, approveB2bOrder, rejectB2bOrder,
  updateKioskRequirementNote, updateB2bRequirementNote,
} from '@/lib/db/orders';
import {
  listCustomRequests, placeRetailerCustomRequest, listRetailerCustomRequestsByStore,
} from '@/lib/db/custom-design';
import { listOrderMessages, addOrderMessage } from '@/lib/db/messages';
import { signUpload, storeFolder } from '@/lib/storage';
import { sendData, sendError } from '../envelope';
import { managerGuard, approverIdOrNull, type AppEnv } from '../guards';

// Operational store routes — accessible to OWNER or MANAGER (managerGuard).
export const storeOpsRoutes = new Hono<AppEnv>();
storeOpsRoutes.use('*', managerGuard);

// Approve routes accept an OPTIONAL { deliveryDate } body — existing clients
// that send no body at all (or an empty one) must keep working unchanged, so
// this parses best-effort rather than using jsonValidator (which would 400 on
// a missing/empty body). undefined means "not provided" (leave the column
// untouched); null/invalid collapses to null (explicitly cleared).
async function optionalDeliveryDate(c: { req: { json: () => Promise<unknown> } }): Promise<Date | null | undefined> {
  let body: unknown;
  try { body = await c.req.json(); } catch { return undefined; }
  if (!body || typeof body !== 'object' || !('deliveryDate' in body)) return undefined;
  const raw = (body as { deliveryDate: unknown }).deliveryDate;
  if (raw === null || raw === '') return null;
  if (typeof raw !== 'string') return undefined;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

// ── Dashboard + Intelligence ──────────────────────────────────────────────────
storeOpsRoutes.get('/dashboard', async (c) => {
  return sendData(c, await getStoreDashboard(c.get('storeId')));
});
storeOpsRoutes.get('/intelligence/summary', async (c) => {
  return sendData(c, await getIntelligenceSummary(c.get('storeId')));
});
storeOpsRoutes.get('/intelligence/recommendations', async (c) => {
  return sendData(c, await getRecommendations(c.get('storeId')));
});

// ── Kiosk device PIN (OWNER or MANAGER can set/reset) ─────────────────────────
storeOpsRoutes.get('/kiosk-pin', async (c) => {
  const store = await prisma.store.findUnique({
    where: { id: c.get('storeId') },
    select: { kioskPinHash: true },
  });
  return sendData(c, { isSet: !!store?.kioskPinHash });
});

const KioskPinBody = z.object({ pin: z.string().min(4).max(20) });
storeOpsRoutes.put('/kiosk-pin', jsonValidator(KioskPinBody), async (c) => {
  const hash = await hashPassword(c.req.valid('json').pin);
  await prisma.store.update({ where: { id: c.get('storeId') }, data: { kioskPinHash: hash } });
  return sendData(c, { ok: true, isSet: true });
});

storeOpsRoutes.delete('/kiosk-pin', async (c) => {
  await prisma.store.update({ where: { id: c.get('storeId') }, data: { kioskPinHash: null } });
  return sendData(c, { ok: true, isSet: false });
});

// ── Kiosk orders ──────────────────────────────────────────────────────────────
storeOpsRoutes.get('/kiosk-orders', async (c) => {
  return sendData(c, await getKioskOrdersByStore(c.get('storeId')));
});
storeOpsRoutes.get('/kiosk-orders/pending', async (c) => {
  return sendData(c, await getKioskOrdersByStore(c.get('storeId'), true));
});
storeOpsRoutes.get('/kiosk-orders/:id', async (c) => {
  const o = await getKioskOrderForStore(c.get('storeId'), c.req.param('id'));
  if (!o) return sendError(c, 'not_found', 'Order not found', 404);
  return sendData(c, o);
});
storeOpsRoutes.post('/kiosk-orders/:id/approve', async (c) => {
  const deliveryDate = await optionalDeliveryDate(c);
  const ok = await approveKioskOrder(c.get('storeId'), c.req.param('id'), approverIdOrNull(c), deliveryDate);
  if (!ok) return sendError(c, 'not_found', 'Order not found', 404);
  return sendData(c, { ok: true });
});
storeOpsRoutes.post('/kiosk-orders/:id/reject', async (c) => {
  const ok = await rejectKioskOrder(c.get('storeId'), c.req.param('id'));
  if (!ok) return sendError(c, 'not_found', 'Order not found', 404);
  return sendData(c, { ok: true });
});
const NoteBody = z.object({ requirementNote: z.string().max(2000).nullish() });
storeOpsRoutes.patch('/kiosk-orders/:id/note', jsonValidator(NoteBody), async (c) => {
  const ok = await updateKioskRequirementNote(c.get('storeId'), c.req.param('id'), c.req.valid('json').requirementNote ?? null);
  if (!ok) return sendError(c, 'not_found', 'Order not found', 404);
  return sendData(c, { ok: true });
});

// ── B2B orders ────────────────────────────────────────────────────────────────
storeOpsRoutes.get('/b2b-orders', async (c) => {
  return sendData(c, await getB2bOrdersByStore(c.get('storeId')));
});
storeOpsRoutes.get('/b2b-orders/pending', async (c) => {
  return sendData(c, await getB2bOrdersByStore(c.get('storeId'), true));
});
storeOpsRoutes.get('/b2b-orders/:id', async (c) => {
  const o = await getB2bOrderForStore(c.get('storeId'), c.req.param('id'));
  if (!o) return sendError(c, 'not_found', 'Order not found', 404);
  return sendData(c, o);
});
storeOpsRoutes.post('/b2b-orders/:id/approve', async (c) => {
  const deliveryDate = await optionalDeliveryDate(c);
  const ok = await approveB2bOrder(c.get('storeId'), c.req.param('id'), approverIdOrNull(c), deliveryDate);
  if (!ok) return sendError(c, 'not_found', 'Order not found', 404);
  return sendData(c, { ok: true });
});
storeOpsRoutes.post('/b2b-orders/:id/reject', async (c) => {
  const ok = await rejectB2bOrder(c.get('storeId'), c.req.param('id'));
  if (!ok) return sendError(c, 'not_found', 'Order not found', 404);
  return sendData(c, { ok: true });
});
storeOpsRoutes.patch('/b2b-orders/:id/note', jsonValidator(NoteBody), async (c) => {
  const ok = await updateB2bRequirementNote(c.get('storeId'), c.req.param('id'), c.req.valid('json').requirementNote ?? null);
  if (!ok) return sendError(c, 'not_found', 'Order not found', 404);
  return sendData(c, { ok: true });
});

// ── Custom designs ────────────────────────────────────────────────────────────

const emptyToUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v);
const optionalText = (max: number) => z.preprocess(emptyToUndefined, z.string().max(max).optional());

// Retailer Admin placing their own customised order directly (no branch) — same
// shape as the branch-manager CustomBody. Mirrors the b2b self-order fix: the
// Retailer Admin is the approver, so their own request is auto-forwarded below
// instead of sitting in their own pending-approvals queue.
const StoreCustomBody = z.object({
  category: z.string().min(1),
  subCategory: optionalText(120),
  weightGramsMin: z.number().positive().optional(),
  weightGramsMax: z.number().positive().optional(),
  purity: optionalText(40),
  designNotes: optionalText(2000),
  referenceImageUrl: z.preprocess(emptyToUndefined, z.string().url().optional()),
  referenceImageUrls: z.array(z.string().url()).max(10).optional(),
  orderRef: optionalText(60),
  deliveryDate: z.preprocess(emptyToUndefined, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a valid date').optional()),
  quantity: optionalText(30),
  meena: optionalText(60),
  length: optionalText(60),
  size: optionalText(60),
  broadness: optionalText(60),
  screw: optionalText(60),
  sampleWeightGrams: z.coerce.number().positive().max(99999).optional(),
});

storeOpsRoutes.post('/custom-designs/upload-sign', async (c) => {
  try {
    const signed = await signUpload({ folder: storeFolder(c.get('storeId'), 'custom'), bucket: 'custom' });
    return sendData(c, signed);
  } catch (err) {
    return sendError(c, 'upstream_failed', err instanceof Error ? err.message : 'Object storage not configured', 503);
  }
});

// Retailer Admin's own bespoke request (2026-08-10 redesign) — this no longer
// creates a CustomDesignOrder immediately. It lands as a PENDING row in the
// manufacturer's Catalog Orders list; a real CustomDesignOrder is only
// created once the manufacturer assigns a Karigar to it (see
// lib/api/routes/manufacturer-karigar.ts).
storeOpsRoutes.post('/custom-designs', jsonValidator(StoreCustomBody), async (c) => {
  const storeId = c.get('storeId');
  const body = c.req.valid('json');
  const result = await placeRetailerCustomRequest(storeId, {
    category: body.category,
    subCategory: body.subCategory as string | undefined,
    weightGramsMin: body.weightGramsMin,
    weightGramsMax: body.weightGramsMax,
    purity: body.purity as string | undefined,
    designNotes: body.designNotes as string | undefined,
    referenceImageUrl: body.referenceImageUrl as string | undefined,
    referenceImageUrls: body.referenceImageUrls,
    orderRef: body.orderRef as string | undefined,
    deliveryDate: body.deliveryDate ? new Date(`${body.deliveryDate as string}T00:00:00Z`) : undefined,
    quantity: body.quantity,
    meena: body.meena as string | undefined,
    length: body.length as string | undefined,
    size: body.size as string | undefined,
    broadness: body.broadness as string | undefined,
    screw: body.screw as string | undefined,
    sampleWeightGrams: body.sampleWeightGrams,
  });
  if (!result.ok) {
    if (result.reason === 'no_manufacturer') {
      return sendError(c, 'bad_request', 'Store is not linked to a manufacturer yet.', 400);
    }
    return sendError(c, 'not_found', 'Store not found', 404);
  }
  return sendData(c, { id: result.id, orderNumber: result.orderNumber }, 201);
});

storeOpsRoutes.get('/custom-designs', async (c) => {
  return sendData(c, await listCustomRequests(c.get('storeId')));
});

// Retailer Admin's own bespoke requests, separate from the branch/kiosk-
// originated ones above (different model, different lifecycle — see
// RetailerCustomRequest). Order History (app/store/b2b-orders/page.tsx)
// merges this in alongside b2b/kiosk/custom.
storeOpsRoutes.get('/retailer-custom-requests', async (c) => {
  return sendData(c, await listRetailerCustomRequestsByStore(c.get('storeId')));
});

// ── Per-order chat (HO Manager side) ──────────────────────────────────────────

const OPS_KIND: Record<string, 'KIOSK' | 'B2B' | 'CUSTOM'> = { kiosk: 'KIOSK', b2b: 'B2B', custom: 'CUSTOM' };

storeOpsRoutes.get('/messages/:kind/:id', async (c) => {
  const kind = OPS_KIND[c.req.param('kind')];
  if (!kind) return sendError(c, 'bad_request', 'Invalid order kind', 400);
  return sendData(c, await listOrderMessages(c.get('storeId'), kind, c.req.param('id')));
});

storeOpsRoutes.post('/messages/:kind/:id', jsonValidator(z.object({ body: z.string().min(1).max(2000) })), async (c) => {
  const kind = OPS_KIND[c.req.param('kind')];
  if (!kind) return sendError(c, 'bad_request', 'Invalid order kind', 400);
  // Sender name: owner = "Head Office", manager = their name.
  let senderName = 'Head Office';
  if (!c.get('isOwner')) {
    const mgr = await prisma.storeManager.findUnique({ where: { id: c.get('managerId') }, select: { name: true } });
    senderName = mgr?.name ?? 'Head Office';
  }
  const msg = await addOrderMessage({
    storeId: c.get('storeId'),
    orderKind: kind,
    orderId: c.req.param('id'),
    sender: 'HO',
    senderName,
    body: c.req.valid('json').body,
  });
  return sendData(c, msg, 201);
});
