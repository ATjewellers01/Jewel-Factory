import { jsonValidator } from '../validation';
import { Hono } from 'hono';
import { z } from 'zod';

import {
  getB2bOrdersByManufacturer, getB2bOrderForManufacturer, advanceB2bOrderStatus, advanceB2bOrderItemStatus,
  getKioskOrdersByManufacturer, getKioskOrderForManufacturer, advanceKioskOrderStatus, advanceKioskOrderItemStatus,
} from '@/lib/db/orders';
import {
  listCustomOrdersByManufacturer, advanceCustomOrderStatus, setCustomOrderKarigarCode,
  updateCustomOrderKarigarForm, getCustomOrderForManufacturer, getCustomOrderItemsForManufacturer,
  listRetailerCustomRequestsByManufacturer, getRetailerCustomRequestForManufacturer,
} from '@/lib/db/custom-design';
import { getStoreById } from '@/lib/db/store-read';
import { sendData, sendError } from '../envelope';
import { manufacturerGuard, type AppEnv } from '../guards';
import type { OrderStatus, CustomOrderStatus } from '@prisma/client';

export const manufacturerOrderRoutes = new Hono<AppEnv>();
manufacturerOrderRoutes.use('*', manufacturerGuard);

const StatusBody = z.object({
  status: z.enum(['IN_PROCESS', 'GHAT_RECEIVED', 'READY_FOR_DELIVERY', 'DISPATCHED', 'COMPLETED', 'CANCELLED']),
  trackingNumber: z.string().optional(),
});

// ── B2B orders (store name shown) ─────────────────────────────────────────────
manufacturerOrderRoutes.get('/orders', async (c) => {
  return sendData(c, await getB2bOrdersByManufacturer(c.get('manufacturerId')));
});
manufacturerOrderRoutes.get('/orders/:id', async (c) => {
  const o = await getB2bOrderForManufacturer(c.get('manufacturerId'), c.req.param('id'));
  if (!o) return sendError(c, 'not_found', 'Order not found', 404);
  return sendData(c, o);
});
manufacturerOrderRoutes.patch('/orders/:id', jsonValidator(StatusBody), async (c) => {
  const { status, trackingNumber } = c.req.valid('json');
  const ok = await advanceB2bOrderStatus(c.get('manufacturerId'), c.req.param('id'), status as OrderStatus, trackingNumber);
  if (!ok) return sendError(c, 'not_found', 'Order not found', 404);
  return sendData(c, { ok: true });
});

// Full status set, incl. PENDING/CANCELLED — the manufacturer can pick any
// value directly (a free dropdown, not a forced forward-only progression),
// so an item can be sent straight to Cancelled if it was rejected/never made.
const ItemStatusBody = z.object({
  status: z.enum(['PENDING', 'IN_PROCESS', 'GHAT_RECEIVED', 'READY_FOR_DELIVERY', 'DISPATCHED', 'COMPLETED', 'CANCELLED']),
});

manufacturerOrderRoutes.patch('/orders/:id/items/:itemId', jsonValidator(ItemStatusBody), async (c) => {
  const { status } = c.req.valid('json');
  const ok = await advanceB2bOrderItemStatus(c.get('manufacturerId'), c.req.param('id'), c.req.param('itemId'), status as OrderStatus);
  if (!ok) return sendError(c, 'not_found', 'Order item not found', 404);
  return sendData(c, { ok: true });
});

// ── Kiosk orders (customer PII stripped; store BUSINESS NAME shown, city/branch
// still hidden; ship to STORE address) ──

async function sanitizeKiosk(order: Record<string, unknown>, cache: Map<string, string>) {
  /* eslint-disable @typescript-eslint/no-unused-vars */
  const {
    customerName, customerPhone, customerEmail, deliveryAddress, // drop customer PII + address
    storeCitySnapshot, branchNameSnapshot, // drop retailer city/branch identity — storeNameSnapshot (business name) is shown, see 2026-08-05
    items,
    ...safe
  } = order as Record<string, unknown> & { items?: Array<Record<string, unknown>> };
  /* eslint-enable @typescript-eslint/no-unused-vars */

  const storeId = order.storeId as string | undefined;
  let shipTo = '';
  if (storeId) {
    if (cache.has(storeId)) shipTo = cache.get(storeId)!;
    else {
      const store = await getStoreById(storeId);
      shipTo = store
        ? [store.addressStreet, store.addressLandmark, store.addressCity, store.addressState, store.addressPincode]
            .filter(Boolean).join(', ')
        : '';
      cache.set(storeId, shipTo);
    }
  }
  const base = { ...safe, shipToStoreAddress: shipTo };
  return items ? { ...base, items } : base;
}

manufacturerOrderRoutes.get('/kiosk-orders', async (c) => {
  const orders = await getKioskOrdersByManufacturer(c.get('manufacturerId'));
  const cache = new Map<string, string>();
  const sanitized = await Promise.all(orders.map((o) => sanitizeKiosk(o as unknown as Record<string, unknown>, cache)));
  return sendData(c, sanitized);
});
manufacturerOrderRoutes.get('/kiosk-orders/:id', async (c) => {
  const o = await getKioskOrderForManufacturer(c.get('manufacturerId'), c.req.param('id'));
  if (!o) return sendError(c, 'not_found', 'Order not found', 404);
  return sendData(c, await sanitizeKiosk(o as unknown as Record<string, unknown>, new Map()));
});
manufacturerOrderRoutes.patch('/kiosk-orders/:id', jsonValidator(StatusBody), async (c) => {
  const { status, trackingNumber } = c.req.valid('json');
  const ok = await advanceKioskOrderStatus(c.get('manufacturerId'), c.req.param('id'), status as OrderStatus, trackingNumber);
  if (!ok) return sendError(c, 'not_found', 'Order not found', 404);
  return sendData(c, { ok: true });
});

manufacturerOrderRoutes.patch('/kiosk-orders/:id/items/:itemId', jsonValidator(ItemStatusBody), async (c) => {
  const { status } = c.req.valid('json');
  const ok = await advanceKioskOrderItemStatus(c.get('manufacturerId'), c.req.param('id'), c.req.param('itemId'), status as OrderStatus);
  if (!ok) return sendError(c, 'not_found', 'Order item not found', 404);
  return sendData(c, { ok: true });
});

// ── Custom design orders (sanitized) ──────────────────────────────────────────
const CustomStatusBody = z.object({
  status: z.enum(['IN_PROCESS', 'GHAT_RECEIVED', 'READY_FOR_DELIVERY', 'DISPATCHED', 'COMPLETED', 'CANCELLED']),
  trackingNumber: z.string().optional(),
});

manufacturerOrderRoutes.get('/custom-designs', async (c) => {
  return sendData(c, await listCustomOrdersByManufacturer(c.get('manufacturerId')));
});
manufacturerOrderRoutes.get('/custom-designs/:id', async (c) => {
  const o = await getCustomOrderForManufacturer(c.get('manufacturerId'), c.req.param('id'));
  if (!o) return sendError(c, 'not_found', 'Order not found', 404);
  return sendData(c, o);
});
manufacturerOrderRoutes.get('/custom-designs/:id/items', async (c) => {
  const items = await getCustomOrderItemsForManufacturer(c.get('manufacturerId'), c.req.param('id'));
  if (items === null) return sendError(c, 'not_found', 'Order not found', 404);
  return sendData(c, items);
});
manufacturerOrderRoutes.patch('/custom-designs/:id', jsonValidator(CustomStatusBody), async (c) => {
  const { status, trackingNumber } = c.req.valid('json');
  const ok = await advanceCustomOrderStatus(c.get('manufacturerId'), c.req.param('id'), status as CustomOrderStatus, trackingNumber);
  if (!ok) return sendError(c, 'not_found', 'Order not found', 404);
  return sendData(c, { ok: true });
});

const KarigarCodeBody = z.object({ karigarCode: z.string().trim().max(60).nullable() });

manufacturerOrderRoutes.patch('/custom-designs/:id/karigar-code', jsonValidator(KarigarCodeBody), async (c) => {
  const { karigarCode } = c.req.valid('json');
  const ok = await setCustomOrderKarigarCode(c.get('manufacturerId'), c.req.param('id'), karigarCode || null);
  if (!ok) return sendError(c, 'not_found', 'Order not found', 404);
  return sendData(c, { ok: true });
});

// ── Karigar-assignment form (Phase 2) — auto-filled + manually-set fields on
// a Customised Order (either origin). "Expected Delivery Date" is deliberately
// NOT here — the client hasn't decided its meaning yet (see CLAUDE.md); only
// orderStage/orderType are free text for the same reason.
const KarigarFormBody = z.object({
  category: z.string().min(1).optional(),
  weightGramsMin: z.number().nullable().optional(),
  weightGramsMax: z.number().nullable().optional(),
  purity: z.string().nullable().optional(),
  quantity: z.string().nullable().optional(),
  deliveryDate: z.string().nullable().optional(), // ISO date string
  karigarDeliveryDate: z.string().nullable().optional(), // ISO date string
  size: z.string().nullable().optional(),
  sampleWeightGrams: z.number().nullable().optional(),
  totalWeightGrams: z.number().nullable().optional(),
  karigarNotes: z.string().nullable().optional(),
  meena: z.string().nullable().optional(),
  length: z.string().nullable().optional(),
  broadness: z.string().nullable().optional(),
  screw: z.string().nullable().optional(),
  narration1: z.string().nullable().optional(),
  narration2: z.string().nullable().optional(),
  qc: z.string().nullable().optional(),
  orderType: z.string().nullable().optional(),
  orderStage: z.string().nullable().optional(),
  urgent: z.boolean().optional(),
  karigarId: z.string().uuid().nullable().optional(),
  karigarCode: z.string().max(80).nullable().optional(),
});

// Retailer Admin's own bespoke requests (2026-08-10 redesign) — PENDING rows
// awaiting Karigar assignment, shown in the merged Catalog Orders list with
// a "Customised Order from {business name}" tag (source === 'retailer-custom'
// client-side). Assignment (which creates the real CustomDesignOrder) is
// POST /api/manufacturer/retailer-custom-requests/:id/assign-karigar, see
// manufacturer-karigar.ts.
manufacturerOrderRoutes.get('/retailer-custom-requests', async (c) => {
  return sendData(c, await listRetailerCustomRequestsByManufacturer(c.get('manufacturerId')));
});
manufacturerOrderRoutes.get('/retailer-custom-requests/:id', async (c) => {
  const r = await getRetailerCustomRequestForManufacturer(c.get('manufacturerId'), c.req.param('id'));
  if (!r) return sendError(c, 'not_found', 'Request not found', 404);
  return sendData(c, r);
});

manufacturerOrderRoutes.patch('/custom-designs/:id/karigar-form', jsonValidator(KarigarFormBody), async (c) => {
  const body = c.req.valid('json');
  const ok = await updateCustomOrderKarigarForm(c.get('manufacturerId'), c.req.param('id'), {
    ...body,
    deliveryDate: body.deliveryDate === undefined ? undefined : (body.deliveryDate ? new Date(body.deliveryDate) : null),
    karigarDeliveryDate: body.karigarDeliveryDate === undefined ? undefined : (body.karigarDeliveryDate ? new Date(body.karigarDeliveryDate) : null),
  });
  if (!ok) return sendError(c, 'not_found', 'Order not found', 404);
  return sendData(c, { ok: true });
});
