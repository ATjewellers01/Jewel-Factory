import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';

import { getCookie, setCookie } from 'hono/cookie';

import { prisma } from '@/lib/prisma';
import { getServerEnv } from '@/lib/env';
import { verifyPassword } from '@/lib/password';
import { KIOSK_COOKIE, issueKioskCookie, verifyKioskCookie, cookieOptions } from '@/lib/auth';
import { signUpload, storeFolder } from '@/lib/cloudinary';
import { listActiveProducts, getActiveProductByDesignOrId } from '@/lib/db/manufacturer-catalog';
import { placeKioskOrder, getKioskOrderPublic } from '@/lib/db/orders';
import { placeCustomRequest } from '@/lib/db/custom-design';
import { embedImageBase64, searchByVector } from '@/lib/search';
import { sendData, sendError } from '../envelope';
import type { AppEnv } from '../guards';

// PUBLIC kiosk routes. Tenancy comes from the storeSlug (URL-path model):
// the client sends X-Store-Slug (from window URL) OR passes storeSlug in the body.
export const kioskRoutes = new Hono<AppEnv>();

async function resolveStore(slug: string | undefined) {
  if (!slug) return null;
  return prisma.store.findFirst({
    where: { slug, isActive: true, registrationStatus: 'APPROVED' },
    select: {
      id: true, name: true, slug: true, city: true, phone: true, email: true,
      logoUrl: true, tagline: true, manufacturerId: true,
    },
  });
}

function slugFrom(c: { req: { header: (k: string) => string | undefined; query: (k: string) => string | undefined } }) {
  return c.req.header('x-store-slug') || c.req.query('store') || undefined;
}

// ── Store branding (kiosk header) ─────────────────────────────────────────────
kioskRoutes.get('/store/:slug', async (c) => {
  const store = await resolveStore(c.req.param('slug'));
  if (!store) return sendError(c, 'not_found', 'Store not found', 404);
  return sendData(c, {
    id: store.id, name: store.name, slug: store.slug, city: store.city,
    logoUrl: store.logoUrl, tagline: store.tagline,
  });
});

// ── Kiosk lock status: does this store require a PIN, and is this device unlocked?
kioskRoutes.get('/lock-status/:slug', async (c) => {
  const env = getServerEnv();
  const store = await prisma.store.findFirst({
    where: { slug: c.req.param('slug'), isActive: true, registrationStatus: 'APPROVED' },
    select: { id: true, kioskPinHash: true },
  });
  if (!store) return sendError(c, 'not_found', 'Store not found', 404);

  // No PIN set → kiosk is open to anyone with the URL.
  if (!store.kioskPinHash) return sendData(c, { requiresPin: false, unlocked: true });

  const unlocked = await verifyKioskCookie(getCookie(c, KIOSK_COOKIE), store.id, {
    secret: env.STORE_SECRET,
    ttlSeconds: env.COOKIE_TTL_SECONDS,
  });
  return sendData(c, { requiresPin: true, unlocked });
});

// ── Kiosk unlock: verify the store PIN, set the device cookie (8h) ─────────────
const UnlockBody = z.object({ slug: z.string().min(1), pin: z.string().min(1) });

kioskRoutes.post('/unlock', zValidator('json', UnlockBody), async (c) => {
  const env = getServerEnv();
  const { slug, pin } = c.req.valid('json');
  const store = await prisma.store.findFirst({
    where: { slug, isActive: true, registrationStatus: 'APPROVED' },
    select: { id: true, kioskPinHash: true },
  });
  if (!store) return sendError(c, 'not_found', 'Store not found', 404);
  if (!store.kioskPinHash) return sendData(c, { ok: true }); // no PIN configured

  const ok = await verifyPassword(pin, store.kioskPinHash);
  if (!ok) return sendError(c, 'unauthorized', 'Incorrect PIN', 401);

  const token = await issueKioskCookie(store.id, { secret: env.STORE_SECRET, ttlSeconds: env.COOKIE_TTL_SECONDS });
  setCookie(c, KIOSK_COOKIE, token, cookieOptions(env.COOKIE_TTL_SECONDS, env.NODE_ENV === 'production'));
  return sendData(c, { ok: true });
});

// ── Catalog (manufacturer's active products) ──────────────────────────────────
kioskRoutes.get('/catalog', async (c) => {
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

kioskRoutes.get('/catalog/:idOrDesign', async (c) => {
  const product = await getActiveProductByDesignOrId(c.req.param('idOrDesign'));
  if (!product) return sendError(c, 'not_found', 'Product not found', 404);
  return sendData(c, product);
});

// ── Try-on products (active, hasTryon) ────────────────────────────────────────
kioskRoutes.get('/tryon-products', async (c) => {
  const products = await prisma.manufacturerProduct.findMany({
    where: { status: 'ACTIVE', hasTryon: true },
    orderBy: { createdAt: 'desc' },
    include: {
      images: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }], take: 1 },
      tryonAssets: { where: { isActive: true } },
    },
  });
  return sendData(
    c,
    products.map((p) => ({
      id: p.id,
      designNumber: p.designNumber,
      name: p.name,
      primaryImageUrl: p.images[0]?.secureUrl ?? null,
      asset: p.tryonAssets[0] ?? null,
    })),
  );
});

// ── Place kiosk order ─────────────────────────────────────────────────────────
const OrderBody = z.object({
  storeSlug: z.string().min(1),
  customerName: z.string().min(1).max(120),
  customerPhone: z.string().min(7).max(20),
  customerEmail: z.string().email().optional().or(z.literal('')),
  pickupStore: z.boolean().default(false),
  deliveryAddress: z.string().max(400).optional(),
  notes: z.string().max(500).optional(),
  items: z.array(z.object({ productId: z.string().uuid(), quantity: z.number().int().positive() })).min(1),
});

kioskRoutes.post('/orders', zValidator('json', OrderBody), async (c) => {
  const body = c.req.valid('json');
  const store = await resolveStore(body.storeSlug);
  if (!store) return sendError(c, 'not_found', 'Store not found or not active.', 404);
  if (!store.manufacturerId) return sendError(c, 'bad_request', 'Store is not linked to a manufacturer yet.', 400);
  if (!body.pickupStore && !body.deliveryAddress?.trim()) {
    return sendError(c, 'bad_request', 'Delivery address is required when not picking up in-store.', 400);
  }

  // Resolve items from the MANUFACTURER catalog. product_id stays null on the
  // order item (FK is to store products); details go into snapshots.
  const products = await prisma.manufacturerProduct.findMany({
    where: { id: { in: body.items.map((i) => i.productId) }, status: 'ACTIVE' },
    include: { images: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }], take: 1 } },
  });
  const byId = new Map(products.map((p) => [p.id, p]));

  const items = body.items.map((i) => {
    const p = byId.get(i.productId);
    if (!p) return null;
    return {
      manufacturerProductId: p.id,
      productNameSnapshot: p.name,
      productImageSnapshot: p.images[0]?.secureUrl,
      categorySnapshot: p.category ?? undefined,
      quantity: i.quantity,
    };
  });
  if (items.some((i) => i === null)) {
    return sendError(c, 'not_found', 'One or more products are unavailable.', 404);
  }

  const order = await placeKioskOrder({
    storeId: store.id,
    manufacturerId: store.manufacturerId,
    storeNameSnapshot: store.name,
    storeCitySnapshot: store.city ?? undefined,
    storePhoneSnapshot: store.phone ?? undefined,
    storeEmailSnapshot: store.email ?? undefined,
    customerName: body.customerName,
    customerPhone: body.customerPhone,
    customerEmail: body.customerEmail || undefined,
    deliveryAddress: body.deliveryAddress,
    pickupStore: body.pickupStore,
    notes: body.notes,
    items: items as NonNullable<(typeof items)[number]>[],
  });
  return sendData(c, order, 201);
});

// ── Similar image search (manufacturer catalog) ───────────────────────────────
const SearchBody = z.object({ image: z.string().min(10) }); // base64

kioskRoutes.post('/search/image', zValidator('json', SearchBody), async (c) => {
  let ids: string[];
  try {
    const vector = await embedImageBase64(c.req.valid('json').image);
    const hits = await searchByVector(vector, 24);
    ids = hits.map((h) => h.id);
  } catch (err) {
    // Embedder cold-boot / not configured — graceful message, not a blank screen.
    return sendError(c, 'upstream_failed', err instanceof Error ? err.message : 'Visual search is warming up. Please try again.', 503);
  }
  if (ids.length === 0) return sendData(c, []);
  // Hydrate + preserve Qdrant rank order.
  const products = await prisma.manufacturerProduct.findMany({
    where: { id: { in: ids }, status: 'ACTIVE' },
    include: { images: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }], take: 1 } },
  });
  const byId = new Map(products.map((p) => [p.id, p]));
  const ordered = ids.map((id) => byId.get(id)).filter(Boolean);
  return sendData(c, ordered);
});

// ── Kiosk order receipt (public read) ─────────────────────────────────────────
kioskRoutes.get('/orders/:id', async (c) => {
  const o = await getKioskOrderPublic(c.req.param('id'));
  if (!o) return sendError(c, 'not_found', 'Order not found', 404);
  return sendData(c, o);
});

// ── Custom design reference image upload (public, per-store folder) ────────────
// Signed Cloudinary upload for the customer's reference photo. Scoped to the
// store's custom folder; only signs folder+timestamp so it can't be abused.
kioskRoutes.post('/custom-design/upload-sign', zValidator('json', z.object({ storeSlug: z.string().min(1) })), async (c) => {
  const store = await resolveStore(c.req.valid('json').storeSlug);
  if (!store) return sendError(c, 'not_found', 'Store not found or not active.', 404);
  try {
    const signed = signUpload({ folder: storeFolder(store.id, 'custom'), bucket: 'custom' });
    return sendData(c, signed);
  } catch (err) {
    return sendError(c, 'upstream_failed', err instanceof Error ? err.message : 'Cloudinary not configured', 503);
  }
});

// ── Custom design request ─────────────────────────────────────────────────────
const CustomBody = z.object({
  storeSlug: z.string().min(1),
  customerName: z.string().min(1).max(120),
  customerPhone: z.string().min(7).max(20),
  category: z.string().min(1).max(80),
  weightGrams: z.number().positive().optional(),
  purity: z.string().max(20).optional(),
  notes: z.string().max(1000).optional(),
  referenceImageUrl: z.string().url().optional().or(z.literal('')),
});

kioskRoutes.post('/custom-design', zValidator('json', CustomBody), async (c) => {
  const body = c.req.valid('json');
  const store = await resolveStore(body.storeSlug);
  if (!store) return sendError(c, 'not_found', 'Store not found or not active.', 404);

  const request = await placeCustomRequest({
    storeId: store.id,
    customerName: body.customerName,
    customerPhone: body.customerPhone,
    category: body.category,
    weightGrams: body.weightGrams,
    purity: body.purity,
    designNotes: body.notes,
    referenceImageUrl: body.referenceImageUrl || undefined,
  });
  return sendData(c, request, 201);
});

void slugFrom; // reserved for header-based tenancy if needed later
