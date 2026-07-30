import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';

import {
  getB2bOrdersByManufacturer, getB2bOrderForManufacturer, advanceB2bOrderStatus,
  getKioskOrdersByManufacturer, getKioskOrderForManufacturer, advanceKioskOrderStatus,
} from '@/lib/db/orders';
import { listCustomOrdersByManufacturer, advanceCustomOrderStatus, setCustomOrderKarigarCode } from '@/lib/db/custom-design';
import { getStoreById } from '@/lib/db/store-read';
import { sendData, sendError } from '../envelope';
import { manufacturerGuard, type AppEnv } from '../guards';
import type { OrderStatus, CustomOrderStatus } from '@prisma/client';

export const manufacturerOrderRoutes = new Hono<AppEnv>();
manufacturerOrderRoutes.use('*', manufacturerGuard);

const StatusBody = z.object({
  status: z.enum(['CONFIRMED', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED']),
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
manufacturerOrderRoutes.patch('/orders/:id', zValidator('json', StatusBody), async (c) => {
  const { status, trackingNumber } = c.req.valid('json');
  const ok = await advanceB2bOrderStatus(c.get('manufacturerId'), c.req.param('id'), status as OrderStatus, trackingNumber);
  if (!ok) return sendError(c, 'not_found', 'Order not found', 404);
  return sendData(c, { ok: true });
});

// ── Kiosk orders (customer PII + address stripped; ship to STORE address) ──────

async function sanitizeKiosk(order: Record<string, unknown>, cache: Map<string, string>) {
  /* eslint-disable @typescript-eslint/no-unused-vars */
  const {
    customerName, customerPhone, customerEmail, deliveryAddress, // drop customer PII + address
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
manufacturerOrderRoutes.patch('/kiosk-orders/:id', zValidator('json', StatusBody), async (c) => {
  const { status, trackingNumber } = c.req.valid('json');
  const ok = await advanceKioskOrderStatus(c.get('manufacturerId'), c.req.param('id'), status as OrderStatus, trackingNumber);
  if (!ok) return sendError(c, 'not_found', 'Order not found', 404);
  return sendData(c, { ok: true });
});

// ── Custom design orders (sanitized) ──────────────────────────────────────────
const CustomStatusBody = z.object({
  status: z.enum(['CONFIRMED', 'IN_PRODUCTION', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED']),
  trackingNumber: z.string().optional(),
});

manufacturerOrderRoutes.get('/custom-designs', async (c) => {
  return sendData(c, await listCustomOrdersByManufacturer(c.get('manufacturerId')));
});
manufacturerOrderRoutes.patch('/custom-designs/:id', zValidator('json', CustomStatusBody), async (c) => {
  const { status, trackingNumber } = c.req.valid('json');
  const ok = await advanceCustomOrderStatus(c.get('manufacturerId'), c.req.param('id'), status as CustomOrderStatus, trackingNumber);
  if (!ok) return sendError(c, 'not_found', 'Order not found', 404);
  return sendData(c, { ok: true });
});

const KarigarCodeBody = z.object({ karigarCode: z.string().trim().max(60).nullable() });

manufacturerOrderRoutes.patch('/custom-designs/:id/karigar-code', zValidator('json', KarigarCodeBody), async (c) => {
  const { karigarCode } = c.req.valid('json');
  const ok = await setCustomOrderKarigarCode(c.get('manufacturerId'), c.req.param('id'), karigarCode || null);
  if (!ok) return sendError(c, 'not_found', 'Order not found', 404);
  return sendData(c, { ok: true });
});
