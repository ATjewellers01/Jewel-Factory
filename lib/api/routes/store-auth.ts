import { jsonValidator } from '../validation';
import { Hono } from 'hono';
import { deleteCookie, setCookie } from 'hono/cookie';
import crypto from 'node:crypto';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { getServerEnv } from '@/lib/env';
import { hashPassword, verifyPassword } from '@/lib/password';
import { STORE_COOKIE, issueStoreCookie, cookieOptions } from '@/lib/auth';
import { slugify, uniqueStoreSlug } from '@/lib/slug';
import { createResetToken, verifyResetToken, consumeResetToken } from '@/lib/reset-token';
import { buildAppUrl, passwordResetEmail, sendEmail } from '@/lib/email';
import { registrationLogoFolder, signUpload } from '@/lib/storage';
import { sendData, sendError } from '../envelope';
import { storeGuard, type AppEnv } from '../guards';

export const storeAuthRoutes = new Hono<AppEnv>();

// ── Registration logo upload (public) ─────────────────────────────────────────
// Self-registration happens before a Store row exists, so this can't be behind
// storeGuard. Like the public kiosk reference-photo route, the server chooses the
// key and only signs folder+bucket, so a caller can't pick an arbitrary path or
// overwrite an existing object (keys are random UUIDs).
storeAuthRoutes.post('/register/logo-sign', async (c) => {
  try {
    const signed = await signUpload({ folder: registrationLogoFolder(), bucket: 'logo' });
    return sendData(c, signed);
  } catch (err) {
    return sendError(c, 'upstream_failed', err instanceof Error ? err.message : 'Object storage not configured', 503);
  }
});

// Treat empty strings from optional form fields as "not provided".
const emptyToUndef = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v);

// ── Login ─────────────────────────────────────────────────────────────────────

// The `email` field is the USERNAME — it holds either an email address or, for
// retailers who registered without one, their 10-digit mobile number. The field
// name is kept so the login payload stays unchanged for every existing client.
const LoginBody = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
});

// POST /api/store/login
storeAuthRoutes.post('/login', jsonValidator(LoginBody), async (c) => {
  const env = getServerEnv();
  const { email, password } = c.req.valid('json');
  const username = email.toLowerCase().trim();

  // Email-less retailers sign in with their mobile number. `owner_phone` has no
  // unique constraint (historical rows may share one), so registration rejects a
  // duplicate mobile for email-less signups and this picks the oldest match.
  const store = username.includes('@')
    ? await prisma.store.findUnique({ where: { email: username } })
    : await prisma.store.findFirst({
        where: { ownerPhone: username },
        orderBy: { createdAt: 'asc' },
      });
  if (!store) {
    return sendError(c, 'unauthorized', 'Invalid email or password', 401);
  }
  if (store.registrationStatus !== 'APPROVED') {
    return sendError(c, 'forbidden', 'Your store registration is awaiting manufacturer approval.', 403);
  }
  // A deactivated account previously fell into the generic "Invalid email or
  // password" branch above, which made a perfectly good password (including a
  // freshly reset one) look wrong. Say what is actually happening instead.
  if (!store.isActive) {
    return sendError(c, 'forbidden', 'This account has been deactivated. Please contact the manufacturer.', 403);
  }
  const ok = await verifyPassword(password, store.passwordHash);
  if (!ok) return sendError(c, 'unauthorized', 'Invalid email or password', 401);

  const token = await issueStoreCookie(store.id, {
    secret: env.STORE_SECRET,
    ttlSeconds: env.COOKIE_TTL_SECONDS,
  });
  setCookie(c, STORE_COOKIE, token, cookieOptions(env.COOKIE_TTL_SECONDS, env.NODE_ENV === 'production'));

  // Mobile client: the app stores this token in SecureStore and sends it as
  // `Authorization: Bearer <token>`. The browser keeps using the cookie above.
  // `token` is the SAME HMAC credential the cookie holds — not a new credential.
  return sendData(c, { id: store.id, name: store.name, slug: store.slug, email: store.email, token });
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

// name: letters + spaces. mobile: 10-digit Indian number. business name: letters,
// numbers, spaces and common punctuation. Mirrors the frontend's validators —
// re-checked server-side since the client can't be trusted.
const NAME_RE = /^[A-Za-z ]{2,}$/;
const MOBILE_RE = /^[6-9]\d{9}$/;
const BUSINESS_NAME_RE = /^[A-Za-z0-9 &.,'-]{2,}$/;

const RegisterBody = z.object({
  name: z.string().min(2).regex(BUSINESS_NAME_RE, 'Business name has invalid characters'),
  // Optional — retailers without an email sign in with their mobile number and
  // can add an email later from /store/profile.
  email: z.preprocess(emptyToUndef, z.string().email().optional()),
  personName: z.string().min(2).regex(NAME_RE, 'Person name must be letters only'),
  mobileNumber: z.string().regex(MOBILE_RE, 'Enter a valid 10-digit mobile number'),
  logoUrl: z.preprocess(emptyToUndef, z.string().url().optional()),
  addressPincode: z.string().regex(/^\d{6}$/, 'Enter a valid 6-digit PIN code'),
  // Street + landmark are optional here and can be filled in later from the
  // purchase manager's profile page.
  addressStreet: z.preprocess(emptyToUndef, z.string().optional()),
  addressCity: z.string().min(2),
  addressState: z.string().min(2),
  addressLandmark: z.preprocess(emptyToUndef, z.string().optional()),
});

// POST /api/store/register
storeAuthRoutes.post('/register', jsonValidator(RegisterBody), async (c) => {
  const body = c.req.valid('json');
  const email = typeof body.email === 'string' ? body.email.toLowerCase().trim() : null;

  if (email) {
    const existing = await prisma.store.findUnique({ where: { email } });
    if (existing) return sendError(c, 'conflict', 'Email already registered', 409);
  } else {
    // No email means the mobile number IS the username, so it has to be free.
    const existing = await prisma.store.findFirst({
      where: { ownerPhone: body.mobileNumber },
      select: { id: true },
    });
    if (existing) return sendError(c, 'conflict', 'Mobile number already registered', 409);
  }

  const slug = await uniqueStoreSlug(slugify(body.name));
  // No password is set at registration — the retailer signs in with email +
  // mobile number once approved (see approveRegistration in lib/db/stores.ts,
  // which hashes the mobile number as the password on approval).
  const placeholderHash = await hashPassword(crypto.randomUUID());

  try {
    const store = await prisma.store.create({
      data: {
        name: body.name,
        slug,
        email,
        passwordHash: placeholderHash,
        registrationStatus: 'PENDING',
        registrationSubmittedAt: new Date(),
        isActive: false,
        ownerName: body.personName,
        ownerPhone: body.mobileNumber,
        phone: body.mobileNumber,
        logoUrl: body.logoUrl as string | undefined,
        addressStreet: body.addressStreet as string | undefined,
        addressCity: body.addressCity,
        addressState: body.addressState,
        addressPincode: body.addressPincode,
        addressLandmark: body.addressLandmark as string | undefined,
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

// The user enters their MOBILE NUMBER (their username) — the server looks up
// the store's own registered email internally and sends the reset link
// there, so the user never has to know/type/see their email address. A
// retailer who registered with a mobile number only (no email on file) has
// nowhere to send a reset link — their password IS their mobile number, so
// they're told that instead of being sent nothing silently.
const ForgotBody = z.object({
  mobileNumber: z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number'),
});

// POST /api/store/forgot-password — always 200 (anti-enumeration) except for
// the two states (deactivated / mobile-only login) that the account holder
// already knows about and must act on directly rather than via a dead-end link.
storeAuthRoutes.post('/forgot-password', jsonValidator(ForgotBody), async (c) => {
  const env = getServerEnv();
  const { mobileNumber } = c.req.valid('json');
  const store = await prisma.store.findFirst({
    where: { ownerPhone: mobileNumber },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, logoUrl: true, isActive: true, email: true },
  });

  // A deactivated account can reset its password successfully and still be
  // unable to sign in, which reads as "the reset is broken". Say so up front
  // instead of sending a link that cannot help. This intentionally breaks the
  // anti-enumeration silence, but only for a state the account holder already
  // knows about and must contact us to resolve anyway.
  if (store && !store.isActive) {
    return sendError(
      c,
      'forbidden',
      'This account is deactivated, so a password reset will not restore access. Please contact us to reactivate it first.',
      403,
    );
  }

  // No email on file: the mobile number itself is the password, so a reset
  // link has nowhere to go and nothing to reset — tell the user directly.
  if (store && store.isActive && !store.email) {
    return sendError(
      c,
      'bad_request',
      'This account signs in with your mobile number as both the username and password — there is no separate password to reset.',
      400,
    );
  }

  if (store && store.email) {
    const token = await createResetToken(store.email, 'STORE_OWNER', store.id);
    const url = buildAppUrl(env.NEXT_PUBLIC_APP_URL, `/store/reset-password?token=${encodeURIComponent(token)}`);
    const { subject, html } = passwordResetEmail({
      resetUrl: url,
      appUrl: env.NEXT_PUBLIC_APP_URL,
      retailerLogoUrl: store.logoUrl,
      retailerName: store.name,
    });
    void sendEmail({ to: store.email, subject, html }); // fire-and-forget
  }
  return sendData(c, { ok: true });
});

const ResetBody = z.object({
  token: z.string().min(1),
  password: z.string().min(6),
});

// POST /api/store/reset-password
storeAuthRoutes.post('/reset-password', jsonValidator(ResetBody), async (c) => {
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
