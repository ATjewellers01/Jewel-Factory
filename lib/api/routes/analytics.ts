/**
 * Analytics API routes for sales insights across all roles.
 * GET endpoints only (read-only analytics data).
 *
 * Every endpoint accepts optional date-range query params, forwarded straight
 * into lib/db/analytics-queries.ts:
 *   ?days=7|30|90|180|365   (defaults to 30)
 *   ?from=<ISO date>&to=<ISO date>   (wins over `days` when both given)
 */

import type { Context } from 'hono';
import { Hono } from 'hono';
import { branchManagerGuard, storeGuard, manufacturerGuard } from '@/lib/api/guards';
import type { DateRangeOptions } from '@/lib/db/analytics';
import {
  getStoreManagerProductSales,
  getRetailerProductSales,
  getRetailerBranchSales,
  getManufacturerRetailerSales,
  getManufacturerCategoryWeightBreakdown,
  getManufacturerTopProducts,
} from '@/lib/db/analytics-queries';

export const analyticsRouter = new Hono();

function parseRangeFromQuery(c: Context): DateRangeOptions {
  const from = c.req.query('from');
  const to = c.req.query('to');
  if (from && to) {
    const fromDate = new Date(from);
    const toDate = new Date(to);
    if (!Number.isNaN(fromDate.getTime()) && !Number.isNaN(toDate.getTime())) {
      return { from: fromDate, to: toDate };
    }
  }
  const days = parseInt(c.req.query('days') || '', 10);
  if (!Number.isNaN(days) && days > 0) return { days };
  return {};
}

// ────────────────────────────────────────────────────────────────────────────
// STORE MANAGER
// ────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/analytics/store-manager/products
 * All products with sales data for THIS branch, in the selected range.
 */
analyticsRouter.get(
  '/store-manager/products',
  branchManagerGuard,
  async (c) => {
    try {
      const branchId = c.get('branchId') as string;
      const data = await getStoreManagerProductSales(branchId, parseRangeFromQuery(c));
      return c.json({ data });
    } catch (error) {
      console.error('[analytics] store-manager/products error:', error);
      return c.json({ error: 'Failed to fetch analytics' }, 500);
    }
  }
);

/**
 * GET /api/analytics/store-manager/restock
 * Best-sellers for restock (sorted by stars, descending)
 */
analyticsRouter.get(
  '/store-manager/restock',
  branchManagerGuard,
  async (c) => {
    try {
      const branchId = c.get('branchId') as string;
      const products = await getStoreManagerProductSales(branchId, parseRangeFromQuery(c));
      const sorted = products.sort((a, b) => b.stars - a.stars);
      return c.json({ data: sorted });
    } catch (error) {
      console.error('[analytics] store-manager/restock error:', error);
      return c.json({ error: 'Failed to fetch restock data' }, 500);
    }
  }
);

// ────────────────────────────────────────────────────────────────────────────
// RETAILER (HEAD OFFICE)
// ────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/analytics/store/products
 * All products with sales data across ALL branches, in the selected range.
 */
analyticsRouter.get(
  '/store/products',
  storeGuard,
  async (c) => {
    try {
      const storeId = c.get('storeId') as string;
      const data = await getRetailerProductSales(storeId, parseRangeFromQuery(c));
      return c.json({ data });
    } catch (error) {
      console.error('[analytics] store/products error:', error);
      return c.json({ error: 'Failed to fetch analytics' }, 500);
    }
  }
);

/**
 * GET /api/analytics/store/branches
 * Branch-wise breakdown — full per-product list per branch (frontend filters
 * by category/sub-category/weight/units and derives topProducts/byCategory/
 * byWeight from it), plus pre-computed defaults for a no-filter first paint.
 */
analyticsRouter.get(
  '/store/branches',
  storeGuard,
  async (c) => {
    try {
      const storeId = c.get('storeId') as string;
      const data = await getRetailerBranchSales(storeId, parseRangeFromQuery(c));
      return c.json({ data });
    } catch (error) {
      console.error('[analytics] store/branches error:', error);
      return c.json({ error: 'Failed to fetch branch data' }, 500);
    }
  }
);

// ────────────────────────────────────────────────────────────────────────────
// MANUFACTURER
// ────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/analytics/manufacturer/retailers
 * Flat per-retailer + per-product rows (category/sub-category/weight/units)
 * for the selected range — frontend filters and groups by retailer.
 */
analyticsRouter.get(
  '/manufacturer/retailers',
  manufacturerGuard,
  async (c) => {
    try {
      const data = await getManufacturerRetailerSales(parseRangeFromQuery(c));
      return c.json({ data });
    } catch (error) {
      console.error('[analytics] manufacturer/retailers error:', error);
      return c.json({ error: 'Failed to fetch retailer data' }, 500);
    }
  }
);

/**
 * GET /api/analytics/manufacturer/category-weight
 * Flat category/sub-category/weight/units rows (all retailers) for the
 * selected range — frontend filters and nests (category -> sub-category ->
 * weight range) itself so every filter combination is possible client-side.
 */
analyticsRouter.get(
  '/manufacturer/category-weight',
  manufacturerGuard,
  async (c) => {
    try {
      const data = await getManufacturerCategoryWeightBreakdown(parseRangeFromQuery(c));
      return c.json({ data });
    } catch (error) {
      console.error('[analytics] manufacturer/category-weight error:', error);
      return c.json({ error: 'Failed to fetch category data' }, 500);
    }
  }
);

/**
 * GET /api/analytics/manufacturer/top-products
 * Top N best-selling products (all retailers) in the selected range.
 */
analyticsRouter.get(
  '/manufacturer/top-products',
  manufacturerGuard,
  async (c) => {
    try {
      const limit = parseInt(c.req.query('limit') || '10', 10);
      const data = await getManufacturerTopProducts(Math.min(limit, 100), parseRangeFromQuery(c));
      return c.json({ data });
    } catch (error) {
      console.error('[analytics] manufacturer/top-products error:', error);
      return c.json({ error: 'Failed to fetch top products' }, 500);
    }
  }
);

/**
 * GET /api/analytics/manufacturer/overview
 * Lightweight system-wide summary for the selected range (total units +
 * top 5 products). Full category/weight breakdown lives in /category-weight.
 */
analyticsRouter.get(
  '/manufacturer/overview',
  manufacturerGuard,
  async (c) => {
    try {
      const range = parseRangeFromQuery(c);
      const [topProducts, categoryStats] = await Promise.all([
        getManufacturerTopProducts(5, range),
        getManufacturerCategoryWeightBreakdown(range),
      ]);

      const totalUnits = categoryStats.reduce((sum, row) => sum + (Number(row.total_units) || 0), 0);

      return c.json({
        data: {
          totalUnits,
          topProducts: topProducts.map((p) => ({
            id: p.id as string,
            name: (p.name as string | null) ?? (p.design_number as string | null) ?? 'Unknown',
            designNumber: p.design_number as string | null,
            category: p.category as string | null,
            units: Number(p.total_units) || 0,
          })),
        },
      });
    } catch (error) {
      console.error('[analytics] manufacturer/overview error:', error);
      return c.json({ error: 'Failed to fetch overview' }, 500);
    }
  }
);
