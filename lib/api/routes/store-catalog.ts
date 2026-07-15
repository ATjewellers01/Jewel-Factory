import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { listActiveProducts, getActiveProductByDesignOrId } from '@/lib/db/manufacturer-catalog';
import { placeB2bOrder } from '@/lib/db/orders';
import { formatStoreAddress } from '@/lib/db/stores';
import { sendData, sendError } from '../envelope';
import { storeGuard, type AppEnv } from '../guards';

// Store-owner-only: browse manufacturer catalog + place B2B (restock) orders.
export const storeCatalogRoutes = new Hono<AppEnv>();
// NOTE: guard applied PER-ROUTE (not .use('*')) so it can't leak to other
// sub-apps mounted on the same /store base (that bug 401'd managers on /dashboard).

// Browse the manufacturer catalog (global active products).
storeCatalogRoutes.get('/catalog', storeGuard, async (c) => {
  const category = c.req.query('category') || undefined;
  const search = c.req.query('search') || undefined;
  const hasTryon = c.req.query('hasTryon');
  return sendData(
    c,
    await listActiveProducts({
      category,
      search,
      hasTryon: hasTryon === undefined ? undefined : hasTryon === 'true',
    }),
  );
});

storeCatalogRoutes.get('/catalog/:id', storeGuard, async (c) => {
  const product = await getActiveProductByDesignOrId(c.req.param('id'));
  if (!product) return sendError(c, 'not_found', 'Product not found', 404);
  return sendData(c, product);
});

// Place a B2B order (goes to manager approval first).
const OrderBody = z.object({
  notes: z.string().optional(),
  items: z
    .array(z.object({ manufacturerProductId: z.string().uuid(), quantity: z.number().int().positive() }))
    .min(1),
});

storeCatalogRoutes.post('/orders', storeGuard, zValidator('json', OrderBody), async (c) => {
  const storeId = c.get('storeId');
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: {
      manufacturerId: true,
      addressStreet: true, addressLandmark: true, addressCity: true, addressState: true, addressPincode: true,
    },
  });
  if (!store) return sendError(c, 'not_found', 'Store not found', 404);
  if (!store.manufacturerId) return sendError(c, 'bad_request', 'Store is not linked to a manufacturer yet.', 400);

  const body = c.req.valid('json');

  // Resolve product names server-side (never trust client), validate active.
  const products = await prisma.manufacturerProduct.findMany({
    where: { id: { in: body.items.map((i) => i.manufacturerProductId) }, status: 'ACTIVE' },
    select: { id: true, name: true },
  });
  const byId = new Map(products.map((p) => [p.id, p]));
  for (const item of body.items) {
    if (!byId.has(item.manufacturerProductId)) {
      return sendError(c, 'not_found', 'One or more products are unavailable.', 404);
    }
  }

  const order = await placeB2bOrder({
    storeId,
    manufacturerId: store.manufacturerId,
    deliveryAddress: formatStoreAddress(store),
    notes: body.notes,
    items: body.items.map((i) => ({
      manufacturerProductId: i.manufacturerProductId,
      quantity: i.quantity,
      productNameSnapshot: byId.get(i.manufacturerProductId)!.name,
    })),
  });
  return sendData(c, order, 201);
});
