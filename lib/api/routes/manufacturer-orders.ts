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
  setCustomOrderO2dSync, resolveSourceOrderNumber,
} from '@/lib/db/custom-design';
import { getStoreById } from '@/lib/db/store-read';
import { syncO2dStatusesForManufacturer } from '@/lib/db/o2d-sync';
import {
  listO2dCompanies, listO2dKarigars, listO2dMeltings, listO2dDeliveryLocations, listO2dOrderStages, listO2dCategories,
  createO2dOrder, isO2dIntegrationConfigured,
  type O2dDesignSourceItem, type CreateO2dOrderInput,
} from '@/lib/integrations/o2d';
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

// ── O2D order-creation integration ─────────────────────────────────────────────
// Lets the "Assign items" flow also create a real order in O2D
// (o2d.zold.in), server-to-server, with no manufacturer login into O2D. See
// lib/integrations/o2d.ts. Disabled (404-free "not configured" errors)
// until O2D_INTEGRATION_BASE_URL/SECRET are set.

manufacturerOrderRoutes.get('/o2d/status', (c) => {
  return sendData(c, { enabled: isO2dIntegrationConfigured() });
});

manufacturerOrderRoutes.get('/o2d/companies', async (c) => {
  if (!isO2dIntegrationConfigured()) return sendError(c, 'upstream_failed', 'O2D integration is not configured.', 503);
  try {
    return sendData(c, await listO2dCompanies());
  } catch (e) {
    return sendError(c, 'upstream_failed', e instanceof Error ? e.message : 'Failed to load O2D companies', 502);
  }
});

manufacturerOrderRoutes.get('/o2d/karigars', async (c) => {
  if (!isO2dIntegrationConfigured()) return sendError(c, 'upstream_failed', 'O2D integration is not configured.', 503);
  try {
    return sendData(c, await listO2dKarigars());
  } catch (e) {
    return sendError(c, 'upstream_failed', e instanceof Error ? e.message : 'Failed to load O2D karigars', 502);
  }
});

manufacturerOrderRoutes.get('/o2d/meltings', async (c) => {
  if (!isO2dIntegrationConfigured()) return sendError(c, 'upstream_failed', 'O2D integration is not configured.', 503);
  try {
    return sendData(c, await listO2dMeltings());
  } catch (e) {
    return sendError(c, 'upstream_failed', e instanceof Error ? e.message : 'Failed to load O2D meltings', 502);
  }
});

manufacturerOrderRoutes.get('/o2d/delivery-locations', async (c) => {
  if (!isO2dIntegrationConfigured()) return sendError(c, 'upstream_failed', 'O2D integration is not configured.', 503);
  try {
    return sendData(c, await listO2dDeliveryLocations());
  } catch (e) {
    return sendError(c, 'upstream_failed', e instanceof Error ? e.message : 'Failed to load O2D delivery locations', 502);
  }
});

manufacturerOrderRoutes.get('/o2d/order-stages', async (c) => {
  if (!isO2dIntegrationConfigured()) return sendError(c, 'upstream_failed', 'O2D integration is not configured.', 503);
  try {
    return sendData(c, await listO2dOrderStages());
  } catch (e) {
    return sendError(c, 'upstream_failed', e instanceof Error ? e.message : 'Failed to load O2D order stages', 502);
  }
});

manufacturerOrderRoutes.get('/o2d/categories', async (c) => {
  if (!isO2dIntegrationConfigured()) return sendError(c, 'upstream_failed', 'O2D integration is not configured.', 503);
  try {
    return sendData(c, await listO2dCategories());
  } catch (e) {
    return sendError(c, 'upstream_failed', e instanceof Error ? e.message : 'Failed to load O2D categories', 502);
  }
});

// Check-on-view sync (see lib/db/o2d-sync.ts) -- the frontend fires this on
// page load for /manufacturer/orders and /manufacturer/custom-designs so
// item status reflects O2D's real production stage. Deliberately tolerant:
// returns a soft {checked:0,...} result instead of a 500 on any unexpected
// failure (including O2D being unconfigured/unreachable), since a page must
// never fail to load just because this best-effort sync didn't work.
manufacturerOrderRoutes.post('/o2d/sync-statuses', async (c) => {
  if (!isO2dIntegrationConfigured()) return sendData(c, { checked: 0, updated: 0, failed: 0 });
  try {
    return sendData(c, await syncO2dStatusesForManufacturer(c.get('manufacturerId')));
  } catch {
    return sendData(c, { checked: 0, updated: 0, failed: 0 });
  }
});

type CustomOrderItemRow = NonNullable<Awaited<ReturnType<typeof getCustomOrderItemsForManufacturer>>>[number];

function toO2dDesignSourceItem(item: CustomOrderItemRow): O2dDesignSourceItem {
  const product = item.manufacturerProduct;
  const snapshot = item as unknown as {
    productNameSnapshot?: string | null;
    productImageSnapshot?: string | null;
    productDesignSnapshot?: string | null;
    categorySnapshot?: string | null;
  };
  return {
    designNumber: product?.designNumber ?? snapshot.productDesignSnapshot ?? snapshot.productNameSnapshot ?? 'Unknown',
    imageUrl: product?.images?.[0]?.secureUrl ?? snapshot.productImageSnapshot ?? null,
    category: product?.category ?? snapshot.categorySnapshot ?? null,
    subCategory: product?.subCategory ?? null,
    purity: product?.purity ?? item.purity ?? null,
    weightGrams: product?.weightGrams != null ? Number(product.weightGrams) : null,
    description: product?.description ?? null,
    pieces: null,
  };
}

const SendToO2dBody = z.object({
  companyId: z.string().min(1),
  o2dKarigarId: z.string().min(1),
  deliveryLocation: z.string().min(1),
  melting: z.string().min(1),
  orderStage: z.string().min(1),
  orderType: z.enum(['NORMAL', 'URGENT', 'STOCK']),
  // Picked explicitly from O2D's own category master list / a Yes-No select
  // in the "Send to O2D" section -- replaces the old pass-through of this
  // project's own free-text category/meena fields, which weren't guaranteed
  // to match a value O2D actually recognizes.
  category: z.string().min(1),
  meena: z.enum(['Yes', 'No']),
});

manufacturerOrderRoutes.post('/custom-designs/:id/send-to-o2d', jsonValidator(SendToO2dBody), async (c) => {
  if (!isO2dIntegrationConfigured()) return sendError(c, 'upstream_failed', 'O2D integration is not configured.', 503);
  const manufacturerId = c.get('manufacturerId');
  const id = c.req.param('id');
  const { companyId, o2dKarigarId, deliveryLocation, melting, orderStage, orderType, category, meena } = c.req.valid('json');

  const order = await getCustomOrderForManufacturer(manufacturerId, id);
  if (!order) return sendError(c, 'not_found', 'Order not found', 404);

  // Mirrors O2D's own Add New Order form's required fields -- server-side
  // backstop behind AssignKarigarModal's client-side check, so a request
  // that skips the UI (or hits a stale client) can't create a nonsense
  // (zero-weight, no dates) order in O2D either. category/meena are now
  // zod-enforced above via the body, not checked against `order` here.
  const missing: string[] = [];
  if (!order.quantity?.trim()) missing.push('Quantity');
  if (order.weightGramsMin == null || Number(order.weightGramsMin) <= 0) missing.push('From Weight');
  if (order.weightGramsMax == null || Number(order.weightGramsMax) <= 0) missing.push('To Weight');
  if (order.totalWeightGrams == null || Number(order.totalWeightGrams) <= 0) missing.push('Total Weight');
  if (!order.deliveryDate) missing.push('Client Delivery Date');
  if (!order.karigarDeliveryDate) missing.push('Karigar Delivery Date');
  if (missing.length > 0) {
    return sendError(c, 'bad_request', `Required before sending to O2D: ${missing.join(', ')}.`, 400);
  }
  // Narrows for TS below -- unreachable given the missing[] check above.
  if (!order.deliveryDate || !order.karigarDeliveryDate) {
    return sendError(c, 'bad_request', 'Delivery dates are required.', 400);
  }

  const items = await getCustomOrderItemsForManufacturer(manufacturerId, id);
  const designSourceItems = (items ?? []).map(toO2dDesignSourceItem);
  const images = [...new Set(designSourceItems.map((i) => i.imageUrl).filter((u): u is string => !!u))];
  const sourceOrderRef = await resolveSourceOrderNumber(order);

  const payload: CreateO2dOrderInput = {
    companyId,
    karigarId: o2dKarigarId,
    // category/meena come from the "Send to O2D" section's own pickers
    // (validated above), not this project's own category/meena fields on
    // `order` -- see the SendToO2dBody comment.
    category,
    quantityText: order.quantity ?? undefined,
    fromWeight: order.weightGramsMin != null ? Number(order.weightGramsMin) : 0,
    toWeight: order.weightGramsMax != null ? Number(order.weightGramsMax) : 0,
    totalWeight: order.totalWeightGrams != null ? Number(order.totalWeightGrams) : undefined,
    sampleWeight: order.sampleWeightGrams != null ? Number(order.sampleWeightGrams) : undefined,
    meena,
    length: order.length ?? undefined,
    size: order.size ?? undefined,
    broadness: order.broadness ?? undefined,
    screw: order.screw ?? undefined,
    karigarNotes: order.karigarNotes ?? undefined,
    narration1: order.narration1 ?? undefined,
    narration2: order.narration2 ?? undefined,
    qc: order.qc ?? undefined,
    // melting/orderStage/orderType are picked explicitly in the "Send to
    // O2D" section from O2D's own master lists / enum (not this project's
    // own free-text orderType/orderStage fields, which keep serving their
    // existing internal/PDF purposes untouched) -- see AssignKarigarModal.tsx.
    orderType,
    melting,
    orderStage,
    expectedDeliveryDate: order.deliveryDate.toISOString(),
    karigarDeliveryDate: order.karigarDeliveryDate.toISOString(),
    // O2D's own Add Order form sets dueDate to the same picked date as
    // expectedDeliveryDate -- without this, O2D's own "Delivery Date"
    // table column stays blank for every order created via this integration.
    dueDate: order.deliveryDate.toISOString(),
    deliveryLocation,
    // O2D's existing "Order No. Reference" field (its own description
    // column, relabeled in O2D's Edit dialog) -- the JFA-#### of the
    // Catalog/Kiosk order these items came from, so it's visible in O2D
    // without any new O2D-side field.
    description: sourceOrderRef ?? undefined,
    images,
    designSourceItems,
  };

  try {
    const result = await createO2dOrder(payload);
    await setCustomOrderO2dSync(manufacturerId, id, { o2dOrderId: result.id, o2dOrderNo: result.orderNo });
    return sendData(c, { o2dOrderId: result.id, o2dOrderNo: result.orderNo });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to create O2D order';
    // Don't swallow this — a "sent" order that wasn't actually sent has
    // burned this codebase before (see submitAssignment's 2026-08-11 fix).
    await setCustomOrderO2dSync(manufacturerId, id, { error: message });
    return sendError(c, 'upstream_failed', message, 502);
  }
});
