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
