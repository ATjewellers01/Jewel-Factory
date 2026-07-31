import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';

import {
  listStoresByManufacturer,
  listPendingRegistrations,
  approveRegistration,
  rejectRegistration,
  updateStoreByManufacturer,
  resetStorePassword,
  setStoreActive,
  deleteStoreByManufacturer,
  listRetailerBadgeLabels,
  addRetailerBadgeLabel,
  removeRetailerBadgeLabel,
} from '@/lib/db/stores';
import { getServerEnv } from '@/lib/env';
import { sendEmail, storeApprovedEmail } from '@/lib/email';
import { sendData, sendError } from '../envelope';
import { manufacturerGuard, type AppEnv } from '../guards';

export const manufacturerStoreRoutes = new Hono<AppEnv>();
manufacturerStoreRoutes.use('*', manufacturerGuard);

// ── Store registrations ───────────────────────────────────────────────────────

manufacturerStoreRoutes.get('/store-registrations', async (c) => {
  return sendData(c, await listPendingRegistrations());
});

manufacturerStoreRoutes.post('/store-registrations/:id/approve', async (c) => {
  const result = await approveRegistration(c.get('manufacturerId'), c.req.param('id'));
  if (!result) return sendError(c, 'not_found', 'Pending registration not found', 404);

  // Notify the store owner that their store is approved (fire-and-forget — never
  // block or fail the approval if email/SMTP is down or unconfigured). Retailers
  // who registered with a mobile number only have no address to send to.
  if (result.email) {
    const env = getServerEnv();
    const ownerEmail = result.email;
    const { subject, html } = storeApprovedEmail({
      storeName: result.name,
      storeSlug: result.slug,
      ownerEmail,
      managerEmails: result.managers.map((m) => m.email),
      appUrl: env.NEXT_PUBLIC_APP_URL,
      retailerLogoUrl: result.logoUrl,
    });
    void sendEmail({ to: ownerEmail, subject, html }).catch((e) =>
      console.warn('[approve] store-approved email failed:', e),
    );
  }

  return sendData(c, result);
});

manufacturerStoreRoutes.post('/store-registrations/:id/reject', async (c) => {
  const result = await rejectRegistration(c.req.param('id'));
  if (!result) return sendError(c, 'not_found', 'Pending registration not found', 404);
  return sendData(c, result);
});

// ── Store CRUD ────────────────────────────────────────────────────────────────

manufacturerStoreRoutes.get('/stores', async (c) => {
  return sendData(c, await listStoresByManufacturer(c.get('manufacturerId')));
});

const EditBody = z.object({
  name: z.string().min(2).optional(),
  // Blank means "leave as is" — email-less retailers keep having no email.
  email: z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? undefined : v), z.string().email().optional()),
  city: z.string().optional(),
  phone: z.string().optional(),
  extraBranchAllowance: z.coerce.number().int().min(0).optional(),
  badgeLabel: z.string().nullable().optional(),
});

manufacturerStoreRoutes.patch('/stores/:id', zValidator('json', EditBody), async (c) => {
  const updated = await updateStoreByManufacturer(c.get('manufacturerId'), c.req.param('id'), c.req.valid('json'));
  if (!updated) return sendError(c, 'not_found', 'Store not found', 404);
  return sendData(c, updated);
});

const PasswordBody = z.object({ password: z.string().min(6) });

manufacturerStoreRoutes.put('/stores/:id/password', zValidator('json', PasswordBody), async (c) => {
  const ok = await resetStorePassword(c.get('manufacturerId'), c.req.param('id'), c.req.valid('json').password);
  if (!ok) return sendError(c, 'not_found', 'Store not found', 404);
  return sendData(c, { ok: true });
});

const ActiveBody = z.object({ isActive: z.boolean() });

manufacturerStoreRoutes.patch('/stores/:id/active', zValidator('json', ActiveBody), async (c) => {
  const result = await setStoreActive(c.get('manufacturerId'), c.req.param('id'), c.req.valid('json').isActive);
  if (!result) return sendError(c, 'not_found', 'Store not found', 404);
  return sendData(c, result);
});

manufacturerStoreRoutes.delete('/stores/:id', async (c) => {
  const ok = await deleteStoreByManufacturer(c.get('manufacturerId'), c.req.param('id'));
  if (!ok) return sendError(c, 'not_found', 'Store not found', 404);
  return sendData(c, { ok: true });
});

// ── Retailer badge labels (manufacturer's own custom dropdown) ────────────────

manufacturerStoreRoutes.get('/retailer-badge-labels', async (c) => {
  return sendData(c, await listRetailerBadgeLabels(c.get('manufacturerId')));
});

const BadgeLabelBody = z.object({ label: z.string().trim().min(1).max(40) });

manufacturerStoreRoutes.post('/retailer-badge-labels', zValidator('json', BadgeLabelBody), async (c) => {
  return sendData(c, await addRetailerBadgeLabel(c.get('manufacturerId'), c.req.valid('json').label), 201);
});

manufacturerStoreRoutes.delete('/retailer-badge-labels/:label', async (c) => {
  return sendData(c, await removeRetailerBadgeLabel(c.get('manufacturerId'), decodeURIComponent(c.req.param('label'))));
});
