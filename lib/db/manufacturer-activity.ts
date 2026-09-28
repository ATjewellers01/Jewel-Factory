import { prisma } from '@/lib/prisma';

// Manufacturer "Customer Activity" page — read side. Two independent groups:
//  A) Login/logout audit (from login_events, see lib/db/login-events.ts)
//  B) Order-based business metrics (activated retailers, monthly orders per
//     retailer, inactive retailers) — derived from existing order tables,
//     no new schema needed for this half.

// ── B) Order-based metrics ─────────────────────────────────────────────────

export type RetailerOrderActivityRow = {
  storeId: string;
  storeName: string;
  isActive: boolean;
  lastOrderAt: Date | null;
  ordersThisMonth: number;
  ordersTotal: number;
};

/**
 * One row per retailer belonging to this manufacturer: total orders, orders
 * placed in the current calendar month, and the most recent order date
 * across kiosk + b2b + custom-design orders. "Order" here means any placed
 * order regardless of its approval/production status — this is an activity
 * signal, not a sales/completed-orders figure (see analytics-queries.ts for
 * the sales-specific COMPLETED/forwarded-only rules).
 */
export async function getRetailerOrderActivity(manufacturerId: string): Promise<RetailerOrderActivityRow[]> {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const rows = await prisma.$queryRaw<
    { store_id: string; store_name: string; is_active: boolean; last_order_at: Date | null; orders_this_month: bigint; orders_total: bigint }[]
  >`
    WITH combined AS (
      SELECT store_id, created_at FROM kiosk_orders WHERE manufacturer_id = ${manufacturerId}
      UNION ALL
      SELECT store_id, created_at FROM b2b_orders WHERE manufacturer_id = ${manufacturerId}
      UNION ALL
      SELECT store_id, created_at FROM custom_design_orders WHERE manufacturer_id = ${manufacturerId}
    )
    SELECT
      s.id AS store_id,
      s.name AS store_name,
      s.is_active,
      MAX(c.created_at) AS last_order_at,
      COUNT(*) FILTER (WHERE c.created_at >= ${monthStart}::timestamp) AS orders_this_month,
      COUNT(*) AS orders_total
    FROM stores s
    LEFT JOIN combined c ON c.store_id = s.id
    WHERE s.manufacturer_id = ${manufacturerId}
    GROUP BY s.id, s.name, s.is_active
    ORDER BY last_order_at DESC NULLS LAST
  `;

  return rows.map((r) => ({
    storeId: r.store_id,
    storeName: r.store_name,
    isActive: r.is_active,
    lastOrderAt: r.last_order_at,
    ordersThisMonth: Number(r.orders_this_month) || 0,
    ordersTotal: Number(r.orders_total) || 0,
  }));
}

export type ManufacturerActivitySummary = {
  activatedRetailers: number;
  monthlyOrderingRetailers: number;
  inactiveRetailers: number;
};

/** Top-line counts for the Customer Activity dashboard cards. */
export function summarizeRetailerActivity(rows: RetailerOrderActivityRow[]): ManufacturerActivitySummary {
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  return {
    activatedRetailers: rows.filter((r) => r.isActive).length,
    monthlyOrderingRetailers: rows.filter((r) => r.ordersThisMonth > 0).length,
    inactiveRetailers: rows.filter((r) => !r.lastOrderAt || now - r.lastOrderAt.getTime() > THIRTY_DAYS_MS).length,
  };
}

// ── A) Login/logout audit ──────────────────────────────────────────────────

export type LoginActivityRow = {
  id: string;
  userType: 'RETAILER' | 'BRANCH_MANAGER';
  event: 'LOGIN' | 'LOGOUT';
  storeId: string;
  storeName: string | null;
  branchManagerId: string | null;
  branchManagerName: string | null;
  branchId: string | null;
  branchName: string | null;
  createdAt: Date;
};

export type LoginActivityFilters = {
  userType?: 'RETAILER' | 'BRANCH_MANAGER';
  storeId?: string;
  from?: Date;
  to?: Date;
  limit?: number;
};

export async function listLoginActivity(manufacturerId: string, filters: LoginActivityFilters = {}): Promise<LoginActivityRow[]> {
  const events = await prisma.loginEvent.findMany({
    where: {
      manufacturerId,
      ...(filters.userType ? { userType: filters.userType } : {}),
      ...(filters.storeId ? { storeId: filters.storeId } : {}),
      ...(filters.from || filters.to
        ? { createdAt: { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lte: filters.to } : {}) } }
        : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: filters.limit ?? 500,
  });

  const storeIds = [...new Set(events.map((e) => e.storeId))];
  const branchManagerIds = [...new Set(events.map((e) => e.branchManagerId).filter((v): v is string => !!v))];
  const branchIds = [...new Set(events.map((e) => e.branchId).filter((v): v is string => !!v))];

  const [stores, branchManagers, branches] = await Promise.all([
    storeIds.length ? prisma.store.findMany({ where: { id: { in: storeIds } }, select: { id: true, name: true } }) : [],
    branchManagerIds.length ? prisma.branchManager.findMany({ where: { id: { in: branchManagerIds } }, select: { id: true, name: true } }) : [],
    branchIds.length ? prisma.branch.findMany({ where: { id: { in: branchIds } }, select: { id: true, name: true } }) : [],
  ]);
  const storeById = new Map(stores.map((s) => [s.id, s.name]));
  const bmById = new Map(branchManagers.map((b) => [b.id, b.name]));
  const branchById = new Map(branches.map((b) => [b.id, b.name]));

  return events.map((e) => ({
    id: e.id,
    userType: e.userType,
    event: e.event,
    storeId: e.storeId,
    storeName: storeById.get(e.storeId) ?? null,
    branchManagerId: e.branchManagerId,
    branchManagerName: e.branchManagerId ? bmById.get(e.branchManagerId) ?? null : null,
    branchId: e.branchId,
    branchName: e.branchId ? branchById.get(e.branchId) ?? null : null,
    createdAt: e.createdAt,
  }));
}

export type UserSessionStatus = {
  key: string; // storeId or branchManagerId
  userType: 'RETAILER' | 'BRANCH_MANAGER';
  storeId: string;
  storeName: string | null;
  branchManagerId: string | null;
  branchManagerName: string | null;
  lastLoginAt: Date | null;
  lastLogoutAt: Date | null;
  isActive: boolean;
};

/**
 * "Active now" = most recent event for that user is a LOGIN with no
 * matching LOGOUT after it, within the last COOKIE_TTL-ish window. We use a
 * simple 24h cutoff (a session cookie realistically doesn't outlive this in
 * practice) rather than reading COOKIE_TTL_SECONDS, since this is a display
 * heuristic, not the actual auth check.
 */
export async function listUserSessionStatus(manufacturerId: string): Promise<UserSessionStatus[]> {
  const ACTIVE_WINDOW_MS = 24 * 60 * 60 * 1000;
  const now = Date.now();

  const recent = await prisma.loginEvent.findMany({
    where: { manufacturerId },
    orderBy: { createdAt: 'desc' },
    take: 2000,
  });

  const latestByKey = new Map<string, (typeof recent)[number]>();
  for (const e of recent) {
    const key = e.userType === 'RETAILER' ? `RETAILER:${e.storeId}` : `BRANCH_MANAGER:${e.branchManagerId}`;
    if (!latestByKey.has(key)) latestByKey.set(key, e);
  }

  const storeIds = [...new Set([...latestByKey.values()].map((e) => e.storeId))];
  const branchManagerIds = [...new Set([...latestByKey.values()].map((e) => e.branchManagerId).filter((v): v is string => !!v))];
  const [stores, branchManagers] = await Promise.all([
    storeIds.length ? prisma.store.findMany({ where: { id: { in: storeIds } }, select: { id: true, name: true } }) : [],
    branchManagerIds.length ? prisma.branchManager.findMany({ where: { id: { in: branchManagerIds } }, select: { id: true, name: true } }) : [],
  ]);
  const storeById = new Map(stores.map((s) => [s.id, s.name]));
  const bmById = new Map(branchManagers.map((b) => [b.id, b.name]));

  return [...latestByKey.entries()].map(([key, e]) => {
    const isLogin = e.event === 'LOGIN';
    const withinWindow = now - e.createdAt.getTime() <= ACTIVE_WINDOW_MS;
    return {
      key,
      userType: e.userType,
      storeId: e.storeId,
      storeName: storeById.get(e.storeId) ?? null,
      branchManagerId: e.branchManagerId,
      branchManagerName: e.branchManagerId ? bmById.get(e.branchManagerId) ?? null : null,
      lastLoginAt: isLogin ? e.createdAt : null,
      lastLogoutAt: !isLogin ? e.createdAt : null,
      isActive: isLogin && withinWindow,
    };
  });
}
