import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';

import {
  updateStoreBranding,
  updateStoreProfile,
  listManagers,
  createManager,
  updateManager,
  resetManagerPassword,
  deleteManager,
} from '@/lib/db/stores';
import {
  listBranches, createBranch, updateBranch, deleteBranch,
  setBranchRestockPin, clearBranchRestockPin,
  listBranchManagers, createBranchManager, updateBranchManager,
  resetBranchManagerPassword, deleteBranchManager,
} from '@/lib/db/branches';
import { signUpload, storeFolder } from '@/lib/cloudinary';
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

storePortalRoutes.patch('/branding', storeGuard, zValidator('json', BrandingBody), async (c) => {
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
    const signed = signUpload({ folder: storeFolder(c.get('storeId'), 'logo'), bucket: 'logo' });
    return sendData(c, signed);
  } catch (err) {
    return sendError(c, 'upstream_failed', err instanceof Error ? err.message : 'Cloudinary not configured', 503);
  }
});

// NOTE: Kiosk PIN routes moved to store-ops (managerGuard) so OWNER OR MANAGER
// can set/reset the kiosk device PIN.

// ── Profile (name, phone, fixed address) ──────────────────────────────────────

const ProfileBody = z.object({
  name: z.string().min(2).optional(),
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

storePortalRoutes.patch('/profile', storeGuard, zValidator('json', ProfileBody), async (c) => {
  const result = await updateStoreProfile(c.get('storeId'), c.req.valid('json') as Record<string, string>);
  return sendData(c, result);
});

// ── Managers (owner only) ─────────────────────────────────────────────────────

storePortalRoutes.get('/managers', storeGuard, async (c) => {
  return sendData(c, await listManagers(c.get('storeId')));
});

const CreateManagerBody = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  phone: z.preprocess(emptyToUndef, z.string().optional()),
});

storePortalRoutes.post('/managers', storeGuard, zValidator('json', CreateManagerBody), async (c) => {
  const b = c.req.valid('json');
  try {
    const mgr = await createManager(c.get('storeId'), {
      name: b.name, email: b.email, password: b.password, phone: b.phone as string | undefined,
    });
    return sendData(c, mgr, 201);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('Unique constraint') || msg.includes('unique')) {
      return sendError(c, 'conflict', 'A manager with this email already exists for your store.', 409);
    }
    return sendError(c, 'internal_error', msg, 500);
  }
});

const UpdateManagerBody = z.object({
  name: z.string().min(2).optional(),
  phone: z.preprocess(emptyToUndef, z.string().optional()),
  isActive: z.boolean().optional(),
});

storePortalRoutes.patch('/managers/:id', storeGuard, zValidator('json', UpdateManagerBody), async (c) => {
  const result = await updateManager(c.get('storeId'), c.req.param('id'), c.req.valid('json') as Record<string, unknown>);
  if (!result) return sendError(c, 'not_found', 'Manager not found', 404);
  return sendData(c, result);
});

const MgrPasswordBody = z.object({ password: z.string().min(6) });

storePortalRoutes.put('/managers/:id/password', storeGuard, zValidator('json', MgrPasswordBody), async (c) => {
  const ok = await resetManagerPassword(c.get('storeId'), c.req.param('id'), c.req.valid('json').password);
  if (!ok) return sendError(c, 'not_found', 'Manager not found', 404);
  return sendData(c, { ok: true });
});

storePortalRoutes.delete('/managers/:id', storeGuard, async (c) => {
  const ok = await deleteManager(c.get('storeId'), c.req.param('id'));
  if (!ok) return sendError(c, 'not_found', 'Manager not found', 404);
  return sendData(c, { ok: true });
});

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

storePortalRoutes.post('/branches', storeGuard, zValidator('json', BranchBody), async (c) => {
  const b = c.req.valid('json');
  const branch = await createBranch(c.get('storeId'), b as Parameters<typeof createBranch>[1]);
  return sendData(c, branch, 201);
});

storePortalRoutes.patch('/branches/:id', storeGuard, zValidator('json', BranchBody.partial()), async (c) => {
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
storePortalRoutes.put('/branches/:id/restock-pin', storeGuard, zValidator('json', BranchPinBody), async (c) => {
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

const BMCreateBody = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  phone: z.preprocess(emptyToUndef, z.string().optional()),
});

storePortalRoutes.post('/branches/:id/managers', storeGuard, zValidator('json', BMCreateBody), async (c) => {
  const b = c.req.valid('json');
  const res = await createBranchManager(c.get('storeId'), c.req.param('id'), { name: b.name, email: b.email, password: b.password, phone: b.phone as string | undefined });
  if (res === null) return sendError(c, 'not_found', 'Branch not found', 404);
  if ('error' in res) return sendError(c, 'conflict', 'A store manager with this email already exists for this store.', 409);
  return sendData(c, res.manager, 201);
});

const BMUpdateBody = z.object({
  name: z.string().min(2).optional(),
  phone: z.preprocess(emptyToUndef, z.string().optional()),
  isActive: z.boolean().optional(),
});

storePortalRoutes.patch('/branches/:id/managers/:mid', storeGuard, zValidator('json', BMUpdateBody), async (c) => {
  const res = await updateBranchManager(c.get('storeId'), c.req.param('id'), c.req.param('mid'), c.req.valid('json') as Record<string, unknown>);
  if (!res) return sendError(c, 'not_found', 'Store manager not found', 404);
  return sendData(c, res);
});

storePortalRoutes.put('/branches/:id/managers/:mid/password', storeGuard, zValidator('json', z.object({ password: z.string().min(6) })), async (c) => {
  const ok = await resetBranchManagerPassword(c.get('storeId'), c.req.param('id'), c.req.param('mid'), c.req.valid('json').password);
  if (!ok) return sendError(c, 'not_found', 'Store manager not found', 404);
  return sendData(c, { ok: true });
});

storePortalRoutes.delete('/branches/:id/managers/:mid', storeGuard, async (c) => {
  const ok = await deleteBranchManager(c.get('storeId'), c.req.param('id'), c.req.param('mid'));
  if (!ok) return sendError(c, 'not_found', 'Store manager not found', 404);
  return sendData(c, { ok: true });
});
