import { jsonValidator } from '../validation';
import { Hono } from 'hono';
import { deleteCookie, setCookie } from 'hono/cookie';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { getServerEnv } from '@/lib/env';
import { verifyPassword } from '@/lib/password';
import {
  MANUFACTURER_COOKIE,
  issueManufacturerCookie,
  cookieOptions,
} from '@/lib/auth';
import { sendData, sendError } from '../envelope';
import { manufacturerGuard, type AppEnv } from '../guards';

export const manufacturerAuthRoutes = new Hono<AppEnv>();

const LoginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// POST /api/manufacturer/login
manufacturerAuthRoutes.post('/login', jsonValidator(LoginBody), async (c) => {
  const env = getServerEnv();
  const { email, password } = c.req.valid('json');

  const mfr = await prisma.manufacturer.findUnique({
    where: { email: email.toLowerCase().trim() },
  });
  if (!mfr || !mfr.isActive) {
    return sendError(c, 'unauthorized', 'Invalid email or password', 401);
  }
  const ok = await verifyPassword(password, mfr.passwordHash);
  if (!ok) return sendError(c, 'unauthorized', 'Invalid email or password', 401);

  const token = await issueManufacturerCookie(mfr.id, {
    secret: env.MANUFACTURER_SECRET,
    ttlSeconds: env.COOKIE_TTL_SECONDS,
  });
  setCookie(c, MANUFACTURER_COOKIE, token, cookieOptions(env.COOKIE_TTL_SECONDS, env.NODE_ENV === 'production'));

  return sendData(c, { id: mfr.id, name: mfr.name, email: mfr.email });
});

// POST /api/manufacturer/logout
manufacturerAuthRoutes.post('/logout', (c) => {
  deleteCookie(c, MANUFACTURER_COOKIE, { path: '/' });
  return sendData(c, { ok: true });
});

// GET /api/manufacturer/me
manufacturerAuthRoutes.get('/me', manufacturerGuard, async (c) => {
  const mfr = await prisma.manufacturer.findUnique({
    where: { id: c.get('manufacturerId') },
    select: { id: true, name: true, email: true },
  });
  if (!mfr) return sendError(c, 'not_found', 'Manufacturer not found', 404);
  return sendData(c, mfr);
});
