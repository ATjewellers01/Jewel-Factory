/**
 * Analytics API routes for sales insights across all roles.
 * GET endpoints only (read-only analytics data).
 */

import { Hono } from 'hono';
import { branchManagerGuard, storeGuard, manufacturerGuard } from '@/lib/api/guards';
import {
  getStoreManagerProductSales,
  getRetailerProductSales,
  getRetailerBranchSales,
  getManufacturerRetailerSales,
  getManufacturerCategoryWeightBreakdown,
  getManufacturerTopProducts,
} from '@/lib/db/analytics-queries';

export const analyticsRouter = new Hono();

// ────────────────────────────────────────────────────────────────────────────
// STORE MANAGER
// ────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/analytics/store-manager/products
 * All products with sales data for THIS branch (last 30 days)
 */
analyticsRouter.get(
  '/store-manager/products',
  branchManagerGuard,
  async (c) => {
    try {
      const branchId = c.get('branchId') as string;
      const data = await getStoreManagerProductSales(branchId);
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
      const products = await getStoreManagerProductSales(branchId);
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
 * All products with sales data across ALL branches (last 30 days)
 */
analyticsRouter.get(
  '/store/products',
  storeGuard,
  async (c) => {
    try {
      const storeId = c.get('storeId') as string;
      const data = await getRetailerProductSales(storeId);
      return c.json({ data });
    } catch (error) {
      console.error('[analytics] store/products error:', error);
      return c.json({ error: 'Failed to fetch analytics' }, 500);
    }
  }
);

/**
 * GET /api/analytics/store/branches
 * Branch-wise breakdown (top products per branch, by category, by weight)
 */
analyticsRouter.get(
  '/store/branches',
  storeGuard,
  async (c) => {
    try {
      const storeId = c.get('storeId') as string;
      const data = await getRetailerBranchSales(storeId);
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
 * Retailer-wise breakdown (products per retailer)
 */
analyticsRouter.get(
  '/manufacturer/retailers',
  manufacturerGuard,
  async (c) => {
    try {
      const data = await getManufacturerRetailerSales();
      return c.json({ data });
    } catch (error) {
      console.error('[analytics] manufacturer/retailers error:', error);
      return c.json({ error: 'Failed to fetch retailer data' }, 500);
    }
  }
);

/**
 * GET /api/analytics/manufacturer/category-weight
 * Category + SubCategory + Weight breakdown (all retailers)
 */
analyticsRouter.get(
  '/manufacturer/category-weight',
  manufacturerGuard,
  async (c) => {
    try {
      const data = await getManufacturerCategoryWeightBreakdown();

      // Transform into nested structure
      const byCategory: Record<
        string,
        {
          subCategories: Record<
            string,
            { weights: Record<string, number>; total: number }
          >;
          total: number;
        }
      > = {};

      data.forEach((row) => {
        const cat = row.category || 'Other';
        const subCat = row.sub_category || 'General';
        const weight = row.weight_grams;
        const units = Number(row.total_units) || 0;

        if (!byCategory[cat]) {
          byCategory[cat] = { subCategories: {}, total: 0 };
        }

        if (!byCategory[cat].subCategories[subCat]) {
          byCategory[cat].subCategories[subCat] = { weights: {}, total: 0 };
        }

        const weightRange = getWeightRangeForDisplay(weight);
        byCategory[cat].subCategories[subCat].weights[weightRange] =
          (byCategory[cat].subCategories[subCat].weights[weightRange] || 0) + units;
        byCategory[cat].subCategories[subCat].total += units;
        byCategory[cat].total += units;
      });

      return c.json({ data: byCategory });
    } catch (error) {
      console.error('[analytics] manufacturer/category-weight error:', error);
      return c.json({ error: 'Failed to fetch category data' }, 500);
    }
  }
);

/**
 * GET /api/analytics/manufacturer/top-products
 * Top 10 best-selling products (all retailers, all time)
 */
analyticsRouter.get(
  '/manufacturer/top-products',
  manufacturerGuard,
  async (c) => {
    try {
      const limit = parseInt(c.query('limit') || '10', 10);
      const data = await getManufacturerTopProducts(Math.min(limit, 100));
      return c.json({ data });
    } catch (error) {
      console.error('[analytics] manufacturer/top-products error:', error);
      return c.json({ error: 'Failed to fetch top products' }, 500);
    }
  }
);

/**
 * GET /api/analytics/manufacturer/overview
 * System-wide overview (aggregates, trends)
 */
analyticsRouter.get(
  '/manufacturer/overview',
  manufacturerGuard,
  async (c) => {
    try {
      const topProducts = await getManufacturerTopProducts(10);

      // Calculate category distribution
      const categoryStats = await getManufacturerCategoryWeightBreakdown();
      const byCategory: Record<string, number> = {};
      const byWeight: Record<string, number> = {};

      categoryStats.forEach((row) => {
        const cat = row.category || 'Other';
        const units = Number(row.total_units) || 0;
        byCategory[cat] = (byCategory[cat] || 0) + units;

        const range = getWeightRangeForDisplay(row.weight_grams);
        byWeight[range] = (byWeight[range] || 0) + units;
      });

      const totalUnits = Object.values(byCategory).reduce((a, b) => a + b, 0);

      return c.json({
        data: {
          totalUnits,
          topProducts: topProducts.map((p) => ({
            id: p.id,
            name: p.name,
            designNumber: p.design_number,
            category: p.category,
            units: Number(p.total_units),
          })),
          categoryDistribution: byCategory,
          weightDistribution: byWeight,
        },
      });
    } catch (error) {
      console.error('[analytics] manufacturer/overview error:', error);
      return c.json({ error: 'Failed to fetch overview' }, 500);
    }
  }
);

// ────────────────────────────────────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────────────────────────────────────

function getWeightRangeForDisplay(weight: any): string {
  if (!weight) return 'Unknown';
  const w = typeof weight === 'string' ? parseFloat(weight) : weight;
  if (w < 5) return '0-5g';
  if (w < 10) return '5-10g';
  if (w < 15) return '10-15g';
  if (w < 20) return '15-20g';
  return '20g+';
}
