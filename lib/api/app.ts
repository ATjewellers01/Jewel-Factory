import { Hono } from 'hono';
import { cors } from 'hono/cors';

import { getServerEnv } from '@/lib/env';
import { sendData } from './envelope';
import type { AppEnv } from './guards';
import { manufacturerAuthRoutes } from './routes/manufacturer-auth';
import { manufacturerCatalogRoutes } from './routes/manufacturer-catalog';
import { manufacturerStoreRoutes } from './routes/manufacturer-stores';
import { manufacturerOrderRoutes } from './routes/manufacturer-orders';
import { manufacturerAiRoutes } from './routes/manufacturer-ai';
import { storeAuthRoutes } from './routes/store-auth';
import { storePortalRoutes } from './routes/store-portal';
import { storeCatalogRoutes } from './routes/store-catalog';
import { storeOpsRoutes } from './routes/store-ops';
import { managerAuthRoutes } from './routes/manager-auth';
import { branchManagerRoutes } from './routes/branch-manager';
import { kioskRoutes } from './routes/kiosk';

export const app = new Hono<AppEnv>().basePath('/api');

// CORS — credentialed, allow-listed. Prod rejects unknown origins.
app.use('*', async (c, next) => {
  const env = getServerEnv();
  const allowed = env.ALLOWED_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean);
  return cors({
    origin: (origin) => {
      if (!origin) return origin; // same-origin / server-to-server
      if (env.NODE_ENV !== 'production') return origin;
      return allowed.includes(origin) ? origin : null;
    },
    credentials: true,
  })(c, next);
});

// Health check
app.get('/health', (c) => sendData(c, { ok: true, service: 'jewel-factory' }));

// Manufacturer: auth (public) + catalog + store mgmt + orders
app.route('/manufacturer', manufacturerAuthRoutes);
app.route('/manufacturer', manufacturerCatalogRoutes);
app.route('/manufacturer', manufacturerStoreRoutes);
app.route('/manufacturer', manufacturerOrderRoutes);
app.route('/manufacturer', manufacturerAiRoutes);

// Store: auth (public) + portal (owner-only) + catalog/B2B (owner) + ops (owner|manager)
app.route('/store', storeAuthRoutes);
app.route('/store', storePortalRoutes);
app.route('/store', storeCatalogRoutes);
app.route('/store', storeOpsRoutes);

// Manager auth + operations
app.route('/manager', managerAuthRoutes);

// Store Manager (branch) — login + branch-scoped kiosk/restock (per-route guarded)
app.route('/branch-manager', branchManagerRoutes);

// Kiosk (public — customer, no login)
app.route('/kiosk', kioskRoutes);

export type AppType = typeof app;
