import { jsonValidator } from '../validation';
import { Hono } from 'hono';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { listActiveProducts, getActiveProductByDesignOrId } from '@/lib/db/manufacturer-catalog';
import { placeB2bOrder } from '@/lib/db/orders';
import { formatStoreAddress } from '@/lib/db/stores';
import { listFavorites, addFavorite, removeFavorite } from '@/lib/db/favorites';
import { listCart, addToCart, setCartQuantity, setCartItemPurity, clearCart, getCartNote, setCartNote } from '@/lib/db/cart';
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

// ── Favorites (Retailer's own — branchId is always null here) ─────────────────
storeCatalogRoutes.get('/favorites', storeGuard, async (c) => {
  return sendData(c, await listFavorites(c.get('storeId'), null));
});

storeCatalogRoutes.post('/favorites/:productId', storeGuard, async (c) => {
  await addFavorite(c.get('storeId'), null, c.req.param('productId'));
  return sendData(c, { ok: true }, 201);
});

storeCatalogRoutes.delete('/favorites/:productId', storeGuard, async (c) => {
  await removeFavorite(c.get('storeId'), null, c.req.param('productId'));
  return sendData(c, { ok: true });
});

// ── Cart (Retailer's own B2B/restock cart — branchId is always null here) ─────
storeCatalogRoutes.get('/cart', storeGuard, async (c) => {
  const [items, note] = await Promise.all([
    listCart(c.get('storeId'), null, 'B2B'),
    getCartNote(c.get('storeId'), null, 'B2B'),
  ]);
  return sendData(c, { items, note });
});

const CartAddBody = z.object({ quantity: z.number().int().positive().optional() });

storeCatalogRoutes.post('/cart/:productId', storeGuard, jsonValidator(CartAddBody), async (c) => {
  const { quantity } = c.req.valid('json');
  await addToCart(c.get('storeId'), null, 'B2B', c.req.param('productId'), quantity ?? 1);
  return sendData(c, { ok: true }, 201);
});

const CartQtyBody = z.object({ quantity: z.number().int().min(0) });

storeCatalogRoutes.patch('/cart/:productId', storeGuard, jsonValidator(CartQtyBody), async (c) => {
  const { quantity } = c.req.valid('json');
  await setCartQuantity(c.get('storeId'), null, 'B2B', c.req.param('productId'), quantity);
  return sendData(c, { ok: true });
});

const CartPurityBody = z.object({ purity: z.string().max(40) });

storeCatalogRoutes.patch('/cart/:productId/purity', storeGuard, jsonValidator(CartPurityBody), async (c) => {
  const { purity } = c.req.valid('json');
  await setCartItemPurity(c.get('storeId'), null, 'B2B', c.req.param('productId'), purity);
  return sendData(c, { ok: true });
});

storeCatalogRoutes.delete('/cart/:productId', storeGuard, async (c) => {
  await setCartQuantity(c.get('storeId'), null, 'B2B', c.req.param('productId'), 0);
  return sendData(c, { ok: true });
});

storeCatalogRoutes.delete('/cart', storeGuard, async (c) => {
  await clearCart(c.get('storeId'), null, 'B2B');
  return sendData(c, { ok: true });
});

const CartNoteBody = z.object({ note: z.string().max(2000) });

storeCatalogRoutes.put('/cart/note', storeGuard, jsonValidator(CartNoteBody), async (c) => {
  const { note } = c.req.valid('json');
  await setCartNote(c.get('storeId'), null, 'B2B', note);
  return sendData(c, { ok: true });
});

// Place a B2B order directly as the Retailer (Head Office) — no approval
// step needed since there's no one above the Retailer in this flow; it's
// pre-approved and goes straight to the manufacturer. (Store-Manager-placed
// orders, via /api/branch-manager, still need the Retailer's approval.)
const OrderBody = z.object({
  notes: z.string().optional(),
  items: z
    .array(z.object({ manufacturerProductId: z.string().uuid(), quantity: z.number().int().positive(), purity: z.string().max(40).optional() }))
    .min(1),
});

storeCatalogRoutes.post('/orders', storeGuard, jsonValidator(OrderBody), async (c) => {
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

  // Resolve product details server-side (never trust client), validate active,
  // and snapshot name + design number + primary image for the order views.
  const products = await prisma.manufacturerProduct.findMany({
    where: { id: { in: body.items.map((i) => i.manufacturerProductId) }, status: 'ACTIVE' },
    select: {
      id: true, name: true, designNumber: true, purity: true,
      images: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }], take: 1, select: { secureUrl: true } },
    },
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
    pendingManagerApproval: false,
    items: body.items.map((i) => {
      const p = byId.get(i.manufacturerProductId)!;
      return {
        manufacturerProductId: i.manufacturerProductId,
        quantity: i.quantity,
        productNameSnapshot: p.name ?? p.designNumber,
        productDesignSnapshot: p.designNumber,
        productImageSnapshot: p.images[0]?.secureUrl,
        purity: i.purity || p.purity,
      };
    }),
  });
  return sendData(c, order, 201);
});
