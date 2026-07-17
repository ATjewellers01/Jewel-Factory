import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { getCookie, deleteCookie, setCookie } from 'hono/cookie';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { getServerEnv } from '@/lib/env';
import { verifyPassword } from '@/lib/password';
import {
  BRANCH_MANAGER_COOKIE,
  RESTOCK_COOKIE,
  issueBranchManagerCookie,
  verifyRestockCookie,
  issueRestockCookie,
  cookieOptions,
} from '@/lib/auth';
import { listActiveProducts, getActiveProductByDesignOrId } from '@/lib/db/manufacturer-catalog';
import { placeKioskOrder, placeB2bOrder } from '@/lib/db/orders';
import { placeCustomRequest } from '@/lib/db/custom-design';
import { formatStoreAddress } from '@/lib/db/stores';
import { signUpload, storeFolder } from '@/lib/cloudinary';
import { embedImageBase64, searchByVector } from '@/lib/search';
import { sendData, sendError } from '../envelope';
import { branchManagerGuard, type AppEnv } from '../guards';

// Store Manager (branch manager) portal API. Login is public; everything else is
// gated by branchManagerGuard (sets branchId + storeId = retailerId).
export const branchManagerRoutes = new Hono<AppEnv>();

/** Branch-manager secret with fallback (mirrors the guard). */
function bmSecret(env: { BRANCH_MANAGER_SECRET?: string; MANAGER_SECRET: string }) {
  return env.BRANCH_MANAGER_SECRET ?? env.MANAGER_SECRET;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

const LoginBody = z.object({ email: z.string().email(), password: z.string().min(1) });

// POST /api/branch-manager/login
branchManagerRoutes.post('/login', zValidator('json', LoginBody), async (c) => {
  const env = getServerEnv();
  const { email, password } = c.req.valid('json');

  const bm = await prisma.branchManager.findFirst({
    where: { email: email.toLowerCase().trim(), isActive: true },
    include: { branch: { select: { id: true, isActive: true, retailerId: true, retailer: { select: { isActive: true, registrationStatus: true } } } } },
  });
  if (!bm) return sendError(c, 'unauthorized', 'Invalid email or password', 401);

  const ok = await verifyPassword(password, bm.passwordHash);
  if (!ok) return sendError(c, 'unauthorized', 'Invalid email or password', 401);

  if (!bm.branch.isActive) return sendError(c, 'forbidden', 'This store is not active.', 403);
  if (!bm.branch.retailer.isActive || bm.branch.retailer.registrationStatus !== 'APPROVED') {
    return sendError(c, 'forbidden', 'The retailer is not active yet.', 403);
  }

  const token = await issueBranchManagerCookie(bm.id, bm.branch.id, bm.branch.retailerId, {
    secret: bmSecret(env),
    ttlSeconds: env.COOKIE_TTL_SECONDS,
  });
  setCookie(c, BRANCH_MANAGER_COOKIE, token, cookieOptions(env.COOKIE_TTL_SECONDS, env.NODE_ENV === 'production'));

  return sendData(c, { id: bm.id, name: bm.name, email: bm.email, branchId: bm.branch.id });
});

// POST /api/branch-manager/logout
branchManagerRoutes.post('/logout', (c) => {
  deleteCookie(c, BRANCH_MANAGER_COOKIE, { path: '/' });
  deleteCookie(c, RESTOCK_COOKIE, { path: '/' });
  return sendData(c, { ok: true });
});

// GET /api/branch-manager/me — the logged-in manager + their branch + retailer branding
branchManagerRoutes.get('/me', branchManagerGuard, async (c) => {
  const bm = await prisma.branchManager.findUnique({
    where: { id: c.get('branchManagerId') },
    select: {
      id: true, name: true, email: true,
      branch: {
        select: {
          id: true, name: true, restockPinHash: true,
          retailer: { select: { id: true, name: true, logoUrl: true, tagline: true, city: true } },
        },
      },
    },
  });
  if (!bm) return sendError(c, 'not_found', 'Store manager not found', 404);
  return sendData(c, {
    id: bm.id, name: bm.name, email: bm.email,
    branch: { id: bm.branch.id, name: bm.branch.name, hasRestockPin: !!bm.branch.restockPinHash },
    retailer: bm.branch.retailer,
  });
});

// ── Catalog (manufacturer's active products) ──────────────────────────────────

branchManagerRoutes.get('/catalog', branchManagerGuard, async (c) => {
  const category = c.req.query('category') || undefined;
  const search = c.req.query('search') || undefined;
  const hasTryon = c.req.query('hasTryon');
  return sendData(c, await listActiveProducts({ category, search, hasTryon: hasTryon === undefined ? undefined : hasTryon === 'true' }));
});

branchManagerRoutes.get('/catalog/:id', branchManagerGuard, async (c) => {
  const product = await getActiveProductByDesignOrId(c.req.param('id'));
  if (!product) return sendError(c, 'not_found', 'Product not found', 404);
  return sendData(c, product);
});

// ── Try-on products (active, hasTryon) ────────────────────────────────────────
branchManagerRoutes.get('/tryon-products', branchManagerGuard, async (c) => {
  const products = await prisma.manufacturerProduct.findMany({
    where: { status: 'ACTIVE', hasTryon: true },
    orderBy: { createdAt: 'desc' },
    include: {
      images: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }], take: 1 },
      tryonAssets: { where: { isActive: true } },
    },
  });
  return sendData(c, products.map((p) => ({
    id: p.id, designNumber: p.designNumber, name: p.name,
    primaryImageUrl: p.images[0]?.secureUrl ?? null, asset: p.tryonAssets[0] ?? null,
  })));
});

// ── Visual search (image → similar manufacturer products) ─────────────────────
branchManagerRoutes.post('/search/image', branchManagerGuard, zValidator('json', z.object({ image: z.string().min(1) })), async (c) => {
  let ids: string[];
  try {
    const vector = await embedImageBase64(c.req.valid('json').image);
    const hits = await searchByVector(vector, 24);
    ids = hits.map((h) => h.id);
  } catch (err) {
    return sendError(c, 'upstream_failed', err instanceof Error ? err.message : 'Visual search is warming up. Please try again.', 503);
  }
  if (ids.length === 0) return sendData(c, []);
  const products = await prisma.manufacturerProduct.findMany({
    where: { id: { in: ids }, status: 'ACTIVE' },
    include: { images: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }], take: 1 } },
  });
  const byId = new Map(products.map((p) => [p.id, p]));
  return sendData(c, ids.map((id) => byId.get(id)).filter(Boolean));
});

// ── Kiosk customer order (NO customer PII — only products + requirement note) ──

const KioskOrderBody = z.object({
  requirementNote: z.string().max(2000).optional(),
  items: z.array(z.object({ manufacturerProductId: z.string().uuid(), quantity: z.number().int().positive() })).min(1),
});

branchManagerRoutes.post('/kiosk-orders', branchManagerGuard, zValidator('json', KioskOrderBody), async (c) => {
  const retailerId = c.get('storeId');
  const branchId = c.get('branchId');
  const [retailer, branch] = await Promise.all([
    prisma.store.findUnique({ where: { id: retailerId }, select: { manufacturerId: true, name: true, city: true, phone: true, email: true } }),
    prisma.branch.findUnique({ where: { id: branchId }, select: { name: true } }),
  ]);
  if (!retailer?.manufacturerId) return sendError(c, 'bad_request', 'Retailer not linked to a manufacturer.', 400);

  const body = c.req.valid('json');
  const products = await prisma.manufacturerProduct.findMany({
    where: { id: { in: body.items.map((i) => i.manufacturerProductId) }, status: 'ACTIVE' },
    select: { id: true, name: true, category: true, images: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }], take: 1, select: { secureUrl: true } } },
  });
  const byId = new Map(products.map((p) => [p.id, p]));
  for (const it of body.items) if (!byId.has(it.manufacturerProductId)) return sendError(c, 'not_found', 'One or more products are unavailable.', 404);

  const order = await placeKioskOrder({
    storeId: retailerId,
    manufacturerId: retailer.manufacturerId,
    branchId,
    branchNameSnapshot: branch?.name ?? null,
    storeNameSnapshot: retailer.name,
    storeCitySnapshot: retailer.city ?? undefined,
    storePhoneSnapshot: retailer.phone ?? undefined,
    storeEmailSnapshot: retailer.email ?? undefined,
    pickupStore: true, // store-managed order; delivery handled between HO and branch
    requirementNote: body.requirementNote,
    items: body.items.map((i) => {
      const p = byId.get(i.manufacturerProductId)!;
      return { manufacturerProductId: i.manufacturerProductId, productNameSnapshot: p.name, productImageSnapshot: p.images[0]?.secureUrl, categorySnapshot: p.category ?? undefined, quantity: i.quantity };
    }),
  });
  return sendData(c, order, 201);
});

// ── Custom design request (from the kiosk, on behalf of a customer) ───────────

const CustomBody = z.object({
  category: z.string().min(1),
  subCategory: z.string().optional(),
  weightGrams: z.number().positive().optional(),
  purity: z.string().optional(),
  designNotes: z.string().max(2000).optional(),
  referenceImageUrl: z.string().url().optional(),
});

// Signed Cloudinary upload for the customer's reference photo (branch-scoped).
branchManagerRoutes.post('/custom-designs/upload-sign', branchManagerGuard, async (c) => {
  try {
    const signed = signUpload({ folder: storeFolder(c.get('storeId'), 'custom'), bucket: 'custom' });
    return sendData(c, signed);
  } catch (err) {
    return sendError(c, 'upstream_failed', err instanceof Error ? err.message : 'Cloudinary not configured', 503);
  }
});

branchManagerRoutes.post('/custom-designs', branchManagerGuard, zValidator('json', CustomBody), async (c) => {
  const retailerId = c.get('storeId');
  const branchId = c.get('branchId');
  const body = c.req.valid('json');
  const category = body.subCategory?.trim() ? `${body.category} — ${body.subCategory.trim()}` : body.category;
  const req = await placeCustomRequest({
    storeId: retailerId,
    branchId,
    category,
    weightGrams: body.weightGrams,
    purity: body.purity,
    designNotes: body.designNotes,
    referenceImageUrl: body.referenceImageUrl,
  });
  return sendData(c, req, 201);
});

// ── Restock PIN gate (protects the restock page from customers) ───────────────

// GET /api/branch-manager/restock/lock-status — does the branch require a PIN, unlocked?
branchManagerRoutes.get('/restock/lock-status', branchManagerGuard, async (c) => {
  const env = getServerEnv();
  const branch = await prisma.branch.findUnique({ where: { id: c.get('branchId') }, select: { id: true, restockPinHash: true } });
  if (!branch) return sendError(c, 'not_found', 'Branch not found', 404);
  if (!branch.restockPinHash) return sendData(c, { requiresPin: false, unlocked: true });
  const unlocked = await verifyRestockCookie(getCookie(c, RESTOCK_COOKIE), branch.id, { secret: env.STORE_SECRET, ttlSeconds: env.COOKIE_TTL_SECONDS });
  return sendData(c, { requiresPin: true, unlocked });
});

// POST /api/branch-manager/restock/unlock — verify branch PIN → set unlock cookie
const RestockUnlock = z.object({ pin: z.string().min(1) });
branchManagerRoutes.post('/restock/unlock', branchManagerGuard, zValidator('json', RestockUnlock), async (c) => {
  const env = getServerEnv();
  const branch = await prisma.branch.findUnique({ where: { id: c.get('branchId') }, select: { id: true, restockPinHash: true } });
  if (!branch) return sendError(c, 'not_found', 'Branch not found', 404);
  if (!branch.restockPinHash) return sendData(c, { ok: true });
  const ok = await verifyPassword(c.req.valid('json').pin, branch.restockPinHash);
  if (!ok) return sendError(c, 'unauthorized', 'Incorrect PIN', 401);
  const token = await issueRestockCookie(branch.id, { secret: env.STORE_SECRET, ttlSeconds: env.COOKIE_TTL_SECONDS });
  setCookie(c, RESTOCK_COOKIE, token, cookieOptions(env.COOKIE_TTL_SECONDS, env.NODE_ENV === 'production'));
  return sendData(c, { ok: true });
});

// ── Set/clear the branch restock PIN (store manager can manage it too) ────────

const SetPin = z.object({ pin: z.string().min(4).max(12) });
branchManagerRoutes.put('/restock/pin', branchManagerGuard, zValidator('json', SetPin), async (c) => {
  const { hashPassword } = await import('@/lib/password');
  const hash = await hashPassword(c.req.valid('json').pin);
  await prisma.branch.update({ where: { id: c.get('branchId') }, data: { restockPinHash: hash } });
  return sendData(c, { ok: true });
});

branchManagerRoutes.delete('/restock/pin', branchManagerGuard, async (c) => {
  await prisma.branch.update({ where: { id: c.get('branchId') }, data: { restockPinHash: null } });
  return sendData(c, { ok: true });
});

// ── Place a restock (B2B) order for THIS branch (goes to HO approval) ─────────

const RestockBody = z.object({
  notes: z.string().optional(),
  requirementNote: z.string().max(2000).optional(),
  items: z.array(z.object({ manufacturerProductId: z.string().uuid(), quantity: z.number().int().positive() })).min(1),
});

branchManagerRoutes.post('/restock-orders', branchManagerGuard, zValidator('json', RestockBody), async (c) => {
  const retailerId = c.get('storeId');
  const branchId = c.get('branchId');
  const [retailer, branch] = await Promise.all([
    prisma.store.findUnique({ where: { id: retailerId }, select: { manufacturerId: true, addressStreet: true, addressLandmark: true, addressCity: true, addressState: true, addressPincode: true } }),
    prisma.branch.findUnique({ where: { id: branchId }, select: { name: true } }),
  ]);
  if (!retailer?.manufacturerId) return sendError(c, 'bad_request', 'Retailer not linked to a manufacturer.', 400);

  const body = c.req.valid('json');
  const products = await prisma.manufacturerProduct.findMany({
    where: { id: { in: body.items.map((i) => i.manufacturerProductId) }, status: 'ACTIVE' },
    select: { id: true, name: true, designNumber: true, images: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }], take: 1, select: { secureUrl: true } } },
  });
  const byId = new Map(products.map((p) => [p.id, p]));
  for (const it of body.items) if (!byId.has(it.manufacturerProductId)) return sendError(c, 'not_found', 'One or more products are unavailable.', 404);

  const order = await placeB2bOrder({
    storeId: retailerId,
    manufacturerId: retailer.manufacturerId,
    branchId,
    branchNameSnapshot: branch?.name ?? null,
    deliveryAddress: formatStoreAddress(retailer), // ships to retailer HO address
    notes: body.notes,
    requirementNote: body.requirementNote,
    items: body.items.map((i) => {
      const p = byId.get(i.manufacturerProductId)!;
      return { manufacturerProductId: i.manufacturerProductId, quantity: i.quantity, productNameSnapshot: p.name, productDesignSnapshot: p.designNumber, productImageSnapshot: p.images[0]?.secureUrl };
    }),
  });
  return sendData(c, order, 201);
});
