import { zValidator } from '@hono/zod-validator';
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
  listCustomRequests, getCustomRequestForStore, forwardCustomRequest, rejectCustomRequest,
} from '@/lib/db/custom-design';
import { listOrderMessages, addOrderMessage } from '@/lib/db/messages';
import { sendData, sendError } from '../envelope';
import { managerGuard, approverIdOrNull, type AppEnv } from '../guards';

// Operational store routes — accessible to OWNER or MANAGER (managerGuard).
export const storeOpsRoutes = new Hono<AppEnv>();
storeOpsRoutes.use('*', managerGuard);

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
storeOpsRoutes.put('/kiosk-pin', zValidator('json', KioskPinBody), async (c) => {
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
  const ok = await approveKioskOrder(c.get('storeId'), c.req.param('id'), approverIdOrNull(c));
  if (!ok) return sendError(c, 'not_found', 'Order not found', 404);
  return sendData(c, { ok: true });
});
storeOpsRoutes.post('/kiosk-orders/:id/reject', async (c) => {
  const ok = await rejectKioskOrder(c.get('storeId'), c.req.param('id'));
  if (!ok) return sendError(c, 'not_found', 'Order not found', 404);
  return sendData(c, { ok: true });
});
const NoteBody = z.object({ requirementNote: z.string().max(2000).nullish() });
storeOpsRoutes.patch('/kiosk-orders/:id/note', zValidator('json', NoteBody), async (c) => {
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
  const ok = await approveB2bOrder(c.get('storeId'), c.req.param('id'), approverIdOrNull(c));
  if (!ok) return sendError(c, 'not_found', 'Order not found', 404);
  return sendData(c, { ok: true });
});
storeOpsRoutes.post('/b2b-orders/:id/reject', async (c) => {
  const ok = await rejectB2bOrder(c.get('storeId'), c.req.param('id'));
  if (!ok) return sendError(c, 'not_found', 'Order not found', 404);
  return sendData(c, { ok: true });
});
storeOpsRoutes.patch('/b2b-orders/:id/note', zValidator('json', NoteBody), async (c) => {
  const ok = await updateB2bRequirementNote(c.get('storeId'), c.req.param('id'), c.req.valid('json').requirementNote ?? null);
  if (!ok) return sendError(c, 'not_found', 'Order not found', 404);
  return sendData(c, { ok: true });
});

// ── Custom designs ────────────────────────────────────────────────────────────
storeOpsRoutes.get('/custom-designs', async (c) => {
  return sendData(c, await listCustomRequests(c.get('storeId')));
});
storeOpsRoutes.post('/custom-designs/:id/approve', async (c) => {
  const req = await getCustomRequestForStore(c.get('storeId'), c.req.param('id'));
  if (!req) return sendError(c, 'not_found', 'Request not found', 404);
  const result = await forwardCustomRequest(c.get('storeId'), c.req.param('id'), approverIdOrNull(c));
  if (!result.ok) {
    if (result.reason === 'no_manufacturer') {
      return sendError(c, 'bad_request', 'Store is not linked to a manufacturer yet.', 400);
    }
    return sendError(c, 'not_found', 'Request not found', 404);
  }
  return sendData(c, { ok: true });
});
storeOpsRoutes.post('/custom-designs/:id/reject', async (c) => {
  const ok = await rejectCustomRequest(c.get('storeId'), c.req.param('id'), approverIdOrNull(c));
  if (!ok) return sendError(c, 'not_found', 'Request not found', 404);
  return sendData(c, { ok: true });
});

// ── Per-order chat (HO Manager side) ──────────────────────────────────────────

const OPS_KIND: Record<string, 'KIOSK' | 'B2B' | 'CUSTOM'> = { kiosk: 'KIOSK', b2b: 'B2B', custom: 'CUSTOM' };

storeOpsRoutes.get('/messages/:kind/:id', async (c) => {
  const kind = OPS_KIND[c.req.param('kind')];
  if (!kind) return sendError(c, 'bad_request', 'Invalid order kind', 400);
  return sendData(c, await listOrderMessages(c.get('storeId'), kind, c.req.param('id')));
});

storeOpsRoutes.post('/messages/:kind/:id', zValidator('json', z.object({ body: z.string().min(1).max(2000) })), async (c) => {
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
