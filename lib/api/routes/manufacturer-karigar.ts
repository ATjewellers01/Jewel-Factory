import { jsonValidator } from '../validation';
import { Hono } from 'hono';
import { z } from 'zod';

import {
  listKarigars, addKarigar, removeKarigar,
  listKarigarCodesForB2bOrder, listKarigarCodesForKioskOrder,
  assignKarigarToB2bItems, assignKarigarToKioskItems,
} from '@/lib/db/karigar';
import { sendData, sendError } from '../envelope';
import { manufacturerGuard, type AppEnv } from '../guards';

/**
 * Karigar master-list + assignment — Phase 1 of the Karigar-assignment
 * feature (schema + bare item-select/assign, no form/PDF yet — those are
 * Phase 2/3). Manufacturer-only; Retailer Admin/Store Manager have no
 * visibility into or role in Karigar assignment, only the resulting
 * per-item status they already see today.
 */
export const manufacturerKarigarRoutes = new Hono<AppEnv>();
manufacturerKarigarRoutes.use('*', manufacturerGuard);

// ── Karigar master-list ─────────────────────────────────────────────────────────
manufacturerKarigarRoutes.get('/karigars', async (c) => {
  return sendData(c, await listKarigars(c.get('manufacturerId')));
});

const AddKarigarBody = z.object({ code: z.string().min(1).max(80) });
manufacturerKarigarRoutes.post('/karigars', jsonValidator(AddKarigarBody), async (c) => {
  const { code } = c.req.valid('json');
  return sendData(c, await addKarigar(c.get('manufacturerId'), code), 201);
});

manufacturerKarigarRoutes.delete('/karigars/:id', async (c) => {
  const ok = await removeKarigar(c.get('manufacturerId'), c.req.param('id'));
  if (!ok) return sendError(c, 'not_found', 'Karigar not found', 404);
  return sendData(c, { ok: true });
});

// ── Karigar codes present on one specific order's items ────────────────────────
// Backs the "Filter by Karigar Code" dropdown, scoped to that order only.
manufacturerKarigarRoutes.get('/orders/:id/karigar-codes', async (c) => {
  return sendData(c, await listKarigarCodesForB2bOrder(c.req.param('id')));
});
manufacturerKarigarRoutes.get('/kiosk-orders/:id/karigar-codes', async (c) => {
  return sendData(c, await listKarigarCodesForKioskOrder(c.req.param('id')));
});

// ── Assign a Karigar to a subset of an order's items ────────────────────────────
// Creates a new CustomDesignOrder (JFC-####) and advances the assigned
// items' status to IN_PROCESS immediately. karigarDeliveryDate (client date
// minus 3 days) is computed in lib/db/karigar.ts from the source order's own
// deliveryDate, so it can't drift out of sync with the field it derives from.
const AssignBody = z.object({
  itemIds: z.array(z.string().uuid()).min(1),
  karigarId: z.string().uuid().nullable().optional(),
  karigarCode: z.string().max(80).nullable().optional(),
});

manufacturerKarigarRoutes.post('/orders/:id/assign-karigar', jsonValidator(AssignBody), async (c) => {
  const { itemIds, karigarId, karigarCode } = c.req.valid('json');
  const order = await assignKarigarToB2bItems({
    manufacturerId: c.get('manufacturerId'),
    b2bOrderId: c.req.param('id'),
    itemIds,
    karigarId: karigarId ?? null,
    karigarCode: karigarCode ?? null,
  });
  if (!order) return sendError(c, 'not_found', 'Order or items not found', 404);
  return sendData(c, order, 201);
});

manufacturerKarigarRoutes.post('/kiosk-orders/:id/assign-karigar', jsonValidator(AssignBody), async (c) => {
  const { itemIds, karigarId, karigarCode } = c.req.valid('json');
  const order = await assignKarigarToKioskItems({
    manufacturerId: c.get('manufacturerId'),
    kioskOrderId: c.req.param('id'),
    itemIds,
    karigarId: karigarId ?? null,
    karigarCode: karigarCode ?? null,
  });
  if (!order) return sendError(c, 'not_found', 'Order or items not found', 404);
  return sendData(c, order, 201);
});
