import { jsonValidator } from '../validation';
import { Hono } from 'hono';
import { z } from 'zod';

import {
  updateStoreBranding,
  updateStoreProfile,
} from '@/lib/db/stores';
import {
  listBranches, createBranch, updateBranch, deleteBranch,
  setBranchRestockPin, clearBranchRestockPin,
  listBranchManagers, createBranchManager, updateBranchManager,
  resetBranchManagerPassword, deleteBranchManager,
} from '@/lib/db/branches';
import { signUpload, storeFolder } from '@/lib/storage';
import { embedImageBase64, searchSimilarProducts } from '@/lib/search';
import { prisma } from '@/lib/prisma';
import { sendData, sendError } from '../envelope';
import { storeGuard, type AppEnv } from '../guards';

const emptyToUndef = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v);

// All store-portal routes are OWNER-only (storeGuard). Manager operations live in
// store-ops (managerGuard). The guard is applied PER-ROUTE (not .use('*')) so it
// cannot leak to sibling sub-apps mounted on the same /store base.
export const storePortalRoutes = new Hono<AppEnv>();

// ── Branding ──────────────────────────────────────────────────────────────────

const BrandingBody = z.object({
  logoUrl: z.preprocess(emptyToUndef, z.string().url().nullish()),
  tagline: z.preprocess(emptyToUndef, z.string().nullish()),
  websiteUrl: z.preprocess(emptyToUndef, z.string().url().nullish()),
});

storePortalRoutes.patch('/branding', storeGuard, jsonValidator(BrandingBody), async (c) => {
  const b = c.req.valid('json');
  const result = await updateStoreBranding(c.get('storeId'), {
    logoUrl: (b.logoUrl ?? null) as string | null,
    tagline: (b.tagline ?? null) as string | null,
    websiteUrl: (b.websiteUrl ?? null) as string | null,
  });
  return sendData(c, result);
});

// POST /branding/logo/sign — signed Cloudinary upload for store logo
storePortalRoutes.post('/branding/logo/sign', storeGuard, async (c) => {
  try {
    const signed = await signUpload({ folder: storeFolder(c.get('storeId'), 'logo'), bucket: 'logo' });
    return sendData(c, signed);
  } catch (err) {
    return sendError(c, 'upstream_failed', err instanceof Error ? err.message : 'Object storage not configured', 503);
  }
});

// ── Visual search (image → similar manufacturer products) ─────────────────────
storePortalRoutes.post('/search/image', storeGuard, jsonValidator(z.object({ image: z.string().min(1) })), async (c) => {
  let ids: string[];
  try {
    const vector = await embedImageBase64(c.req.valid('json').image);
    const hits = await searchSimilarProducts(vector, 24);
    ids = hits.map((h) => h.id);
  } catch (err) {
    return sendError(c, 'upstream_failed', err instanceof Error ? err.message : 'Visual search is warming up. Please try again.', 503);
  }
  if (ids.length === 0) return sendData(c, []);
  const products = await prisma.manufacturerProduct.findMany({
    where: { id: { in: ids }, status: 'ACTIVE' },
    omit: { karigarCode: true },
    include: { images: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }] } },
  });
  const byId = new Map(products.map((p) => [p.id, p]));
  return sendData(c, ids.map((id) => byId.get(id)).filter(Boolean));
});

// NOTE: Kiosk PIN routes moved to store-ops (managerGuard) so OWNER OR MANAGER
// can set/reset the kiosk device PIN.

// ── Profile (name, phone, fixed address) ──────────────────────────────────────

const ProfileBody = z.object({
  name: z.string().min(2).optional(),
  // Retailers who registered with a mobile number only can add an email here
  // later; it then becomes their sign-in username alongside the mobile number.
  email: z.preprocess(emptyToUndef, z.string().email().optional()),
  city: z.string().optional(),
  phone: z.string().optional(),
  addressStreet: z.string().optional(),
  addressCity: z.string().optional(),
  addressState: z.string().optional(),
  addressPincode: z.string().optional(),
  addressLandmark: z.preprocess(emptyToUndef, z.string().optional()),
  ownerName: z.string().optional(),
  ownerPhone: z.string().optional(),
});

storePortalRoutes.patch('/profile', storeGuard, jsonValidator(ProfileBody), async (c) => {
  const result = await updateStoreProfile(c.get('storeId'), c.req.valid('json') as Record<string, string>);
  if ('error' in result) return sendError(c, 'conflict', 'That email is already registered.', 409);
  return sendData(c, result);
});

// (HO Manager feature removed — the Retailer/owner does approvals directly.
//  The store_managers table + rows remain in the DB but there is no create/
//  manage UI or API, and HO login is disabled.)

// ── Branches (= UI "Stores") — owner only. c.get('storeId') is the retailer id ─

const BranchBody = z.object({
  name: z.string().min(2),
  addressStreet: z.preprocess(emptyToUndef, z.string().nullish()),
  addressCity: z.preprocess(emptyToUndef, z.string().nullish()),
  addressState: z.preprocess(emptyToUndef, z.string().nullish()),
  addressPincode: z.preprocess(emptyToUndef, z.string().nullish()),
  addressLandmark: z.preprocess(emptyToUndef, z.string().nullish()),
  phone: z.preprocess(emptyToUndef, z.string().nullish()),
  isActive: z.boolean().optional(),
});

storePortalRoutes.get('/branches', storeGuard, async (c) => {
  return sendData(c, await listBranches(c.get('storeId')));
});

storePortalRoutes.post('/branches', storeGuard, jsonValidator(BranchBody), async (c) => {
  const b = c.req.valid('json');
  const result = await createBranch(c.get('storeId'), b as Parameters<typeof createBranch>[1]);
  if ('error' in result) {
    return sendError(c, 'conflict', `You've reached your store limit (${result.limit}). Contact the manufacturer to add more.`, 409);
  }
  return sendData(c, result.branch, 201);
});

storePortalRoutes.patch('/branches/:id', storeGuard, jsonValidator(BranchBody.partial()), async (c) => {
  const b = await updateBranch(c.get('storeId'), c.req.param('id'), c.req.valid('json') as Parameters<typeof updateBranch>[2]);
  if (!b) return sendError(c, 'not_found', 'Branch not found', 404);
  return sendData(c, b);
});

storePortalRoutes.delete('/branches/:id', storeGuard, async (c) => {
  const ok = await deleteBranch(c.get('storeId'), c.req.param('id'));
  if (!ok) return sendError(c, 'not_found', 'Branch not found', 404);
  return sendData(c, { ok: true });
});

// Branch restock PIN (owner can set/clear; store manager can too via branch-manager)
const BranchPinBody = z.object({ pin: z.string().min(4).max(12) });
storePortalRoutes.put('/branches/:id/restock-pin', storeGuard, jsonValidator(BranchPinBody), async (c) => {
  const ok = await setBranchRestockPin(c.get('storeId'), c.req.param('id'), c.req.valid('json').pin);
  if (!ok) return sendError(c, 'not_found', 'Branch not found', 404);
  return sendData(c, { ok: true });
});
storePortalRoutes.delete('/branches/:id/restock-pin', storeGuard, async (c) => {
  const ok = await clearBranchRestockPin(c.get('storeId'), c.req.param('id'));
  if (!ok) return sendError(c, 'not_found', 'Branch not found', 404);
  return sendData(c, { ok: true });
});

// ── Branch managers (= UI "Store Managers") — owner only ──────────────────────

storePortalRoutes.get('/branches/:id/managers', storeGuard, async (c) => {
  const list = await listBranchManagers(c.get('storeId'), c.req.param('id'));
  if (list === null) return sendError(c, 'not_found', 'Branch not found', 404);
  return sendData(c, list);
});

// No manual password: the mobile number is always the Retailer User's password
// (mirrors Retailer Admin self-registration). Email is optional — when absent,
// the mobile number is also the login username.
const MOBILE_RE = /^[6-9]\d{9}$/;
const BMCreateBody = z.object({
  phone: z.string().regex(MOBILE_RE, 'Enter a valid 10-digit mobile number'),
  email: z.preprocess(emptyToUndef, z.string().email().optional()),
});

storePortalRoutes.post('/branches/:id/managers', storeGuard, jsonValidator(BMCreateBody), async (c) => {
  const b = c.req.valid('json');
  const res = await createBranchManager(c.get('storeId'), c.req.param('id'), { phone: b.phone, email: b.email ?? null });
  if (res === null) return sendError(c, 'not_found', 'Branch not found', 404);
  if ('error' in res) {
    if (res.error === 'limit_reached') return sendError(c, 'conflict', 'This store already has a Retailer User. Remove the existing one before adding another.', 409);
    return sendError(c, 'conflict', 'A Retailer User with this email or mobile number already exists for this store.', 409);
  }
  return sendData(c, res.manager, 201);
});

const BMUpdateBody = z.object({
  email: z.preprocess(emptyToUndef, z.string().email().optional()),
  phone: z.preprocess(emptyToUndef, z.string().regex(MOBILE_RE, 'Enter a valid 10-digit mobile number').optional()),
  isActive: z.boolean().optional(),
});

storePortalRoutes.patch('/branches/:id/managers/:mid', storeGuard, jsonValidator(BMUpdateBody), async (c) => {
  const res = await updateBranchManager(c.get('storeId'), c.req.param('id'), c.req.param('mid'), c.req.valid('json') as Record<string, unknown>);
  if (!res) return sendError(c, 'not_found', 'Store manager not found', 404);
  return sendData(c, res);
});

storePortalRoutes.put('/branches/:id/managers/:mid/password', storeGuard, jsonValidator(z.object({ password: z.string().min(6) })), async (c) => {
  const ok = await resetBranchManagerPassword(c.get('storeId'), c.req.param('id'), c.req.param('mid'), c.req.valid('json').password);
  if (!ok) return sendError(c, 'not_found', 'Store manager not found', 404);
  return sendData(c, { ok: true });
});

storePortalRoutes.delete('/branches/:id/managers/:mid', storeGuard, async (c) => {
  const ok = await deleteBranchManager(c.get('storeId'), c.req.param('id'), c.req.param('mid'));
  if (!ok) return sendError(c, 'not_found', 'Store manager not found', 404);
  return sendData(c, { ok: true });
});
