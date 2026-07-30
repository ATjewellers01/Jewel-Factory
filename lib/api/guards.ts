import type { Context, MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';

import { getServerEnv } from '@/lib/env';
import {
  MANUFACTURER_COOKIE,
  STORE_COOKIE,
  BRANCH_MANAGER_COOKIE,
  verifyManufacturerCookie,
  verifyStoreCookie,
  verifyBranchManagerCookie,
} from '@/lib/auth';
import { sendError } from './envelope';

/**
 * Read a bearer token from the `Authorization: Bearer <token>` header.
 *
 * The native mobile client authenticates this way (RN `fetch` manages cookies
 * inconsistently across iOS/Android). The browser keeps using the httpOnly
 * cookie — each guard passes the cookie first and falls back to the bearer, so
 * a browser session with a cookie and no `Authorization` header is handled
 * identically to before. The token VALUE is unchanged: it is the same HMAC
 * credential the cookie holds, so verification is byte-for-byte identical.
 *
 * Returns undefined when the header is absent or not a Bearer scheme, so the
 * `??` fallback never masks a cookie with a malformed bearer string.
 */
export function bearerToken(c: Context): string | undefined {
  const header = c.req.header('authorization');
  if (!header) return undefined;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1]! : undefined;
}

/**
 * Resolve a role credential: the cookie (browser) if present, else the bearer
 * token (mobile). Carries the matching TTL — the browser cookie keeps
 * `COOKIE_TTL_SECONDS` (unchanged); the mobile bearer uses the longer
 * `MOBILE_TOKEN_TTL_SECONDS` (decision #2). The TTL is enforced only at verify
 * time (`lib/auth.ts`), so this is where the mobile session length takes effect.
 *
 * Additive: a browser request always carries the httpOnly cookie and never an
 * `Authorization` header, so the `??` short-circuits to the cookie branch and
 * the existing verify path is reached with the same `(token, COOKIE_TTL)`.
 */
function credentialFor(c: Context, cookieName: string, env: { COOKIE_TTL_SECONDS: number; MOBILE_TOKEN_TTL_SECONDS: number }): { token: string | undefined; ttlSeconds: number } {
  const cookie = getCookie(c, cookieName);
  if (cookie) return { token: cookie, ttlSeconds: env.COOKIE_TTL_SECONDS };
  return { token: bearerToken(c), ttlSeconds: env.MOBILE_TOKEN_TTL_SECONDS };
}

/**
 * Context variables set by the guards. Handlers read these — NEVER the request
 * body — to know who the caller is and which tenant they belong to.
 */
export type AppVariables = {
  manufacturerId: string;
  storeId: string; // for a branch manager, this is the RETAILER id (tenant)
  managerId: string; // for owner, this equals storeId (owner acts as itself)
  isOwner: boolean;
  branchId: string; // set by branchManagerGuard
  branchManagerId: string; // set by branchManagerGuard
};

/** Branch-manager secret, falling back to MANAGER_SECRET when unset. */
function branchManagerSecret(env: { BRANCH_MANAGER_SECRET?: string; MANAGER_SECRET: string }): string {
  return env.BRANCH_MANAGER_SECRET ?? env.MANAGER_SECRET;
}

export type AppEnv = { Variables: AppVariables };

// ── manufacturerGuard: all /api/manufacturer/* (except login/logout) ──────────
export const manufacturerGuard: MiddlewareHandler<AppEnv> = async (c, next) => {
  const env = getServerEnv();
  const cred = credentialFor(c, MANUFACTURER_COOKIE, env);
  const result = await verifyManufacturerCookie(cred.token, {
    secret: env.MANUFACTURER_SECRET,
    ttlSeconds: cred.ttlSeconds,
  });
  if (!result.valid) return sendError(c, 'unauthorized', 'Manufacturer login required', 401);
  c.set('manufacturerId', result.manufacturerId);
  await next();
};

// ── storeGuard: owner-only routes (settings, manager management, place B2B) ───
export const storeGuard: MiddlewareHandler<AppEnv> = async (c, next) => {
  const env = getServerEnv();
  const cred = credentialFor(c, STORE_COOKIE, env);
  const result = await verifyStoreCookie(cred.token, {
    secret: env.STORE_SECRET,
    ttlSeconds: cred.ttlSeconds,
  });
  if (!result.valid) return sendError(c, 'unauthorized', 'Store owner login required', 401);
  c.set('storeId', result.storeId);
  c.set('managerId', result.storeId);
  c.set('isOwner', true);
  await next();
};

// ── managerGuard: Retailer/owner only (approvals, dashboards, order ops) ───────
// The HO Manager role was removed — the Retailer (jf_store) does all of this now.
// Kept as a named guard so the many /store-ops routes don't need touching.
export const managerGuard: MiddlewareHandler<AppEnv> = async (c, next) => {
  const env = getServerEnv();
  const cred = credentialFor(c, STORE_COOKIE, env);
  const ownerResult = await verifyStoreCookie(cred.token, {
    secret: env.STORE_SECRET,
    ttlSeconds: cred.ttlSeconds,
  });
  if (!ownerResult.valid) return sendError(c, 'unauthorized', 'Retailer login required', 401);
  c.set('storeId', ownerResult.storeId);
  c.set('managerId', ownerResult.storeId); // owner acts as itself
  c.set('isOwner', true);
  await next();
};

// ── branchManagerGuard: Store Manager (per branch) ────────────────────────────
// Sets branchId + branchManagerId, and storeId = retailerId so existing
// tenant-scoped DB helpers (which take the retailer/store id) work unchanged.
export const branchManagerGuard: MiddlewareHandler<AppEnv> = async (c, next) => {
  const env = getServerEnv();
  const cred = credentialFor(c, BRANCH_MANAGER_COOKIE, env);
  const result = await verifyBranchManagerCookie(cred.token, {
    secret: branchManagerSecret(env),
    ttlSeconds: cred.ttlSeconds,
  });
  if (!result.valid) return sendError(c, 'unauthorized', 'Store manager login required', 401);
  c.set('branchManagerId', result.branchManagerId);
  c.set('branchId', result.branchId);
  c.set('storeId', result.retailerId); // retailer = tenant
  await next();
};

/**
 * Resolve the reviewer/approver id for FK columns that reference store_managers.
 * Owner -> null (owner-approved), manager -> real managerId.
 * (This was the source of a duplicate-order bug in the old app.)
 */
export function approverIdOrNull(c: { get: (k: 'managerId' | 'isOwner') => string | boolean }): string | null {
  return c.get('isOwner') ? null : (c.get('managerId') as string);
}
