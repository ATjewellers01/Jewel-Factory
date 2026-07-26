import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { deleteCookie, setCookie } from 'hono/cookie';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { getServerEnv } from '@/lib/env';
import { hashPassword, verifyPassword } from '@/lib/password';
import { STORE_COOKIE, issueStoreCookie, cookieOptions } from '@/lib/auth';
import { slugify, uniqueStoreSlug } from '@/lib/slug';
import { createResetToken, verifyResetToken, consumeResetToken } from '@/lib/reset-token';
import { buildAppUrl, passwordResetEmail, sendEmail } from '@/lib/email';
import { sendData, sendError } from '../envelope';
import { storeGuard, type AppEnv } from '../guards';

export const storeAuthRoutes = new Hono<AppEnv>();

// Treat empty strings from optional form fields as "not provided".
const emptyToUndef = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v);

// ── Login ─────────────────────────────────────────────────────────────────────

const LoginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// POST /api/store/login
storeAuthRoutes.post('/login', zValidator('json', LoginBody), async (c) => {
  const env = getServerEnv();
  const { email, password } = c.req.valid('json');

  const store = await prisma.store.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!store || !store.isActive) {
    return sendError(c, 'unauthorized', 'Invalid email or password', 401);
  }
  if (store.registrationStatus !== 'APPROVED') {
    return sendError(c, 'forbidden', 'Your store registration is awaiting manufacturer approval.', 403);
  }
  const ok = await verifyPassword(password, store.passwordHash);
  if (!ok) return sendError(c, 'unauthorized', 'Invalid email or password', 401);

  const token = await issueStoreCookie(store.id, {
    secret: env.STORE_SECRET,
    ttlSeconds: env.COOKIE_TTL_SECONDS,
  });
  setCookie(c, STORE_COOKIE, token, cookieOptions(env.COOKIE_TTL_SECONDS, env.NODE_ENV === 'production'));

  return sendData(c, { id: store.id, name: store.name, slug: store.slug, email: store.email });
});

// POST /api/store/logout
storeAuthRoutes.post('/logout', (c) => {
  deleteCookie(c, STORE_COOKIE, { path: '/' });
  return sendData(c, { ok: true });
});

// GET /api/store/me
storeAuthRoutes.get('/me', storeGuard, async (c) => {
  const store = await prisma.store.findUnique({
    where: { id: c.get('storeId') },
    select: {
      id: true, name: true, slug: true, email: true, city: true, phone: true,
      logoUrl: true, tagline: true, websiteUrl: true,
      addressStreet: true, addressCity: true, addressState: true,
      addressPincode: true, addressLandmark: true,
      ownerName: true, ownerPhone: true, manufacturerId: true,
    },
  });
  if (!store) return sendError(c, 'not_found', 'Store not found', 404);
  return sendData(c, store);
});

// ── Self-registration (public, pending manufacturer approval) ─────────────────

const RegisterBody = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  ownerName: z.string().min(2),
  ownerPhone: z.string().min(7),
  logoUrl: z.preprocess(emptyToUndef, z.string().url().optional()),
  addressStreet: z.string().min(3),
  addressCity: z.string().min(2),
  addressState: z.string().min(2),
  addressPincode: z.string().min(4),
  addressLandmark: z.preprocess(emptyToUndef, z.string().optional()),
  managerName: z.string().min(2),
  managerEmail: z.string().email(),
  managerPassword: z.string().min(6),
  managerPhone: z.preprocess(emptyToUndef, z.string().optional()),
});

// POST /api/store/register
storeAuthRoutes.post('/register', zValidator('json', RegisterBody), async (c) => {
  const body = c.req.valid('json');
  const email = body.email.toLowerCase().trim();

  const existing = await prisma.store.findUnique({ where: { email } });
  if (existing) return sendError(c, 'conflict', 'Email already registered', 409);

  const slug = await uniqueStoreSlug(slugify(body.name));
  const [storeHash, managerHash] = await Promise.all([
    hashPassword(body.password),
    hashPassword(body.managerPassword),
  ]);

  try {
    const store = await prisma.store.create({
      data: {
        name: body.name,
        slug,
        email,
        passwordHash: storeHash,
        registrationStatus: 'PENDING',
        registrationSubmittedAt: new Date(),
        isActive: false,
        ownerName: body.ownerName,
        ownerPhone: body.ownerPhone,
        logoUrl: body.logoUrl as string | undefined,
        addressStreet: body.addressStreet,
        addressCity: body.addressCity,
        addressState: body.addressState,
        addressPincode: body.addressPincode,
        addressLandmark: body.addressLandmark as string | undefined,
        managers: {
          create: {
            name: body.managerName,
            email: body.managerEmail.toLowerCase().trim(),
            passwordHash: managerHash,
            phone: body.managerPhone as string | undefined,
          },
        },
      },
      select: { id: true, name: true, slug: true, registrationStatus: true },
    });
    return sendData(
      c,
      { ...store, message: 'Registration submitted. You will receive access after manufacturer approval.' },
      201,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('Unique constraint') || msg.includes('unique')) {
      return sendError(c, 'conflict', 'Email already registered', 409);
    }
    return sendError(c, 'internal_error', msg, 500);
  }
});

// ── Forgot / Reset password (store owner) ─────────────────────────────────────

const ForgotBody = z.object({ email: z.string().email() });

// POST /api/store/forgot-password — always 200 (anti-enumeration)
storeAuthRoutes.post('/forgot-password', zValidator('json', ForgotBody), async (c) => {
  const env = getServerEnv();
  const email = c.req.valid('json').email.toLowerCase().trim();
  const store = await prisma.store.findUnique({
    where: { email },
    select: { id: true, name: true, logoUrl: true },
  });
  if (store) {
    const token = await createResetToken(email, 'STORE_OWNER', store.id);
    const url = buildAppUrl(env.NEXT_PUBLIC_APP_URL, `/store/reset-password?token=${encodeURIComponent(token)}`);
    const { subject, html } = passwordResetEmail({
      resetUrl: url,
      appUrl: env.NEXT_PUBLIC_APP_URL,
      retailerLogoUrl: store.logoUrl,
      retailerName: store.name,
    });
    void sendEmail({ to: email, subject, html }); // fire-and-forget
  }
  return sendData(c, { ok: true });
});

const ResetBody = z.object({
  token: z.string().min(1),
  password: z.string().min(6),
});

// POST /api/store/reset-password
storeAuthRoutes.post('/reset-password', zValidator('json', ResetBody), async (c) => {
  const { token, password } = c.req.valid('json');
  const row = await verifyResetToken(token, 'STORE_OWNER');
  if (!row || !row.storeId) {
    return sendError(c, 'bad_request', 'Invalid or expired reset link.', 400);
  }
  const hash = await hashPassword(password);
  await prisma.store.update({ where: { id: row.storeId }, data: { passwordHash: hash } });
  await consumeResetToken(row.id);
  return sendData(c, { ok: true });
});
