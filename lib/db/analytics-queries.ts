/**
 * Analytics queries for aggregating sales data across roles.
 * Uses raw SQL for complex date-range aggregations.
 *
 * All queries combine kiosk + B2B order items via a `UNION ALL` CTE first,
 * then join to manufacturer_products/aggregate once. Joining kiosk_order_items
 * AND b2b_order_items to the same manufacturer_products row via two separate
 * LEFT JOINs multiplies rows (cross-join effect) and corrupts SUMs — UNION ALL
 * avoids that entirely.
 *
 * Every function accepts an optional DateRangeOptions so callers (API routes)
 * can pass `?days=` or `?from=&to=` through from the query string — defaults
 * to "last 30 days vs previous 30 days" when omitted.
 */

import { prisma } from '@/lib/prisma';
import {
  ProductSalesData,
  BranchSalesData,
  DateRangeOptions,
  calculateStars,
  calculateTrend,
  getWeightRange,
  parseDecimal,
  getDateRanges,
} from '@/lib/db/analytics';

// Row shape for product-aggregation raw SQL queries (category/weight breakdowns,
// retailer/branch product lists, top-products). Fields are optional since each
// query only SELECTs a subset of these columns.
interface ProductAggRow {
  id?: string;
  product_id?: string;
  product_name?: string;
  name?: string;
  design_number?: string | null;
  category?: string | null;
  sub_category?: string | null;
  weight_grams?: string | number | null;
  secure_url?: string | null;
  total_units?: number | string;
  retailer_id?: string;
  retailer_name?: string;
}

interface ProductSalesRow {
  manufacturer_product_id: string;
  product_name: string;
  design_number: string | null;
  category: string | null;
  sub_category: string | null;
  weight_grams: string | number | null;
  secure_url: string | null;
  units_last_30d: number | string;
  units_previous_30d: number | string;
  units_all_time: number | string;
}

function mapSalesRow(r: ProductSalesRow): ProductSalesData {
  const unitsLast30d = Number(r.units_last_30d) || 0;
  const unitsPrevious30d = Number(r.units_previous_30d) || 0;
  const { direction, percent } = calculateTrend(unitsLast30d, unitsPrevious30d);

  return {
    manufacturerProductId: r.manufacturer_product_id,
    productName: r.product_name || 'Unknown',
    designNumber: r.design_number || 'N/A',
    category: r.category ?? null,
    subCategory: r.sub_category ?? null,
    weight: parseDecimal(r.weight_grams),
    imageUrl: r.secure_url ?? null,
    unitsLast30d,
    unitsPrevious30d,
    unitsAllTime: Number(r.units_all_time) || 0,
    trendPercent: percent,
    stars: calculateStars(unitsLast30d),
    trendDirection: direction,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// STORE MANAGER: Best-sellers in THIS branch
// ────────────────────────────────────────────────────────────────────────────

export async function getStoreManagerProductSales(
  branchId: string,
  range: DateRangeOptions = {}
): Promise<ProductSalesData[]> {
  const { windowStart, windowEnd, previousStart, previousEnd, historyStart } =
    getDateRanges(range);

  const results = await prisma.$queryRaw<ProductSalesRow[]>`
    WITH combined AS (
      SELECT koi.manufacturer_product_id AS product_id, koi.quantity AS quantity, ko.created_at AS created_at
      FROM kiosk_order_items koi
      JOIN kiosk_orders ko ON koi.order_id = ko.id
      WHERE ko.branch_id = ${branchId}
        AND ko.forwarded_to_manufacturer = true
        AND koi.manufacturer_product_id IS NOT NULL
        AND ko.created_at >= ${historyStart}::timestamp
        AND ko.created_at <= ${windowEnd}::timestamp

      UNION ALL

      SELECT boi.manufacturer_product_id AS product_id, boi.quantity AS quantity, bo.created_at AS created_at
      FROM b2b_order_items boi
      JOIN b2b_orders bo ON boi.order_id = bo.id
      WHERE bo.branch_id = ${branchId}
        AND bo.status = 'DELIVERED'
        AND bo.created_at >= ${historyStart}::timestamp
        AND bo.created_at <= ${windowEnd}::timestamp
    )
    SELECT
      mp.id AS manufacturer_product_id,
      mp.name AS product_name,
      mp.design_number,
      mp.category,
      mp.sub_category,
      mp.weight_grams,
      mpi.secure_url,
      COALESCE(SUM(CASE WHEN c.created_at >= ${windowStart}::timestamp THEN c.quantity ELSE 0 END), 0) AS units_last_30d,
      COALESCE(SUM(CASE WHEN c.created_at >= ${previousStart}::timestamp AND c.created_at < ${previousEnd}::timestamp THEN c.quantity ELSE 0 END), 0) AS units_previous_30d,
      COALESCE(SUM(c.quantity), 0) AS units_all_time
    FROM combined c
    JOIN manufacturer_products mp ON mp.id = c.product_id
    LEFT JOIN manufacturer_product_images mpi ON mp.id = mpi.product_id AND mpi.is_primary = true
    GROUP BY mp.id, mp.name, mp.design_number, mp.category, mp.sub_category, mp.weight_grams, mpi.secure_url
    ORDER BY units_last_30d DESC
  `;

  return results.map(mapSalesRow);
}

// ────────────────────────────────────────────────────────────────────────────
// RETAILER: All products ordered across ALL branches
// ────────────────────────────────────────────────────────────────────────────

export async function getRetailerProductSales(
  storeId: string,
  range: DateRangeOptions = {}
): Promise<ProductSalesData[]> {
  const { windowStart, windowEnd, previousStart, previousEnd, historyStart } =
    getDateRanges(range);

  const results = await prisma.$queryRaw<ProductSalesRow[]>`
    WITH combined AS (
      SELECT koi.manufacturer_product_id AS product_id, koi.quantity AS quantity, ko.created_at AS created_at
      FROM kiosk_order_items koi
      JOIN kiosk_orders ko ON koi.order_id = ko.id
      WHERE ko.store_id = ${storeId}
        AND ko.forwarded_to_manufacturer = true
        AND koi.manufacturer_product_id IS NOT NULL
        AND ko.created_at >= ${historyStart}::timestamp
        AND ko.created_at <= ${windowEnd}::timestamp

      UNION ALL

      SELECT boi.manufacturer_product_id AS product_id, boi.quantity AS quantity, bo.created_at AS created_at
      FROM b2b_order_items boi
      JOIN b2b_orders bo ON boi.order_id = bo.id
      WHERE bo.store_id = ${storeId}
        AND bo.status = 'DELIVERED'
        AND bo.created_at >= ${historyStart}::timestamp
        AND bo.created_at <= ${windowEnd}::timestamp
    )
    SELECT
      mp.id AS manufacturer_product_id,
      mp.name AS product_name,
      mp.design_number,
      mp.category,
      mp.sub_category,
      mp.weight_grams,
      mpi.secure_url,
      COALESCE(SUM(CASE WHEN c.created_at >= ${windowStart}::timestamp THEN c.quantity ELSE 0 END), 0) AS units_last_30d,
      COALESCE(SUM(CASE WHEN c.created_at >= ${previousStart}::timestamp AND c.created_at < ${previousEnd}::timestamp THEN c.quantity ELSE 0 END), 0) AS units_previous_30d,
      COALESCE(SUM(c.quantity), 0) AS units_all_time
    FROM combined c
    JOIN manufacturer_products mp ON mp.id = c.product_id
    LEFT JOIN manufacturer_product_images mpi ON mp.id = mpi.product_id AND mpi.is_primary = true
    GROUP BY mp.id, mp.name, mp.design_number, mp.category, mp.sub_category, mp.weight_grams, mpi.secure_url
    ORDER BY units_last_30d DESC
  `;

  return results.map(mapSalesRow);
}

// ────────────────────────────────────────────────────────────────────────────
// RETAILER: Branch-wise breakdown (Store A, Store B, etc.)
// Returns the FULL per-product list per branch (not pre-truncated/grouped)
// so the frontend can filter (category/sub-category/weight/units) and derive
// topProducts + byCategory + byWeight from one consistent, filtered dataset.
// ────────────────────────────────────────────────────────────────────────────

export async function getRetailerBranchSales(
  storeId: string,
  range: DateRangeOptions = {}
): Promise<BranchSalesData[]> {
  const { windowStart, windowEnd } = getDateRanges(range);

  const branches = await prisma.branch.findMany({
    where: { retailerId: storeId },
    select: { id: true, name: true },
  });

  const branchSales: BranchSalesData[] = [];

  for (const branch of branches) {
    const products = await prisma.$queryRaw<ProductAggRow[]>`
      WITH combined AS (
        SELECT koi.manufacturer_product_id AS product_id, koi.quantity AS quantity
        FROM kiosk_order_items koi
        JOIN kiosk_orders ko ON koi.order_id = ko.id
        WHERE ko.branch_id = ${branch.id}
          AND ko.forwarded_to_manufacturer = true
          AND koi.manufacturer_product_id IS NOT NULL
          AND ko.created_at >= ${windowStart}::timestamp
          AND ko.created_at <= ${windowEnd}::timestamp

        UNION ALL

        SELECT boi.manufacturer_product_id AS product_id, boi.quantity AS quantity
        FROM b2b_order_items boi
        JOIN b2b_orders bo ON boi.order_id = bo.id
        WHERE bo.branch_id = ${branch.id}
          AND bo.status = 'DELIVERED'
          AND bo.created_at >= ${windowStart}::timestamp
          AND bo.created_at <= ${windowEnd}::timestamp
      )
      SELECT
        mp.id,
        mp.name AS product_name,
        mp.design_number,
        mp.category,
        mp.sub_category,
        mp.weight_grams,
        mpi.secure_url,
        SUM(c.quantity) AS total_units
      FROM combined c
      JOIN manufacturer_products mp ON mp.id = c.product_id
      LEFT JOIN manufacturer_product_images mpi ON mp.id = mpi.product_id AND mpi.is_primary = true
      GROUP BY mp.id, mp.name, mp.design_number, mp.category, mp.sub_category, mp.weight_grams, mpi.secure_url
      ORDER BY total_units DESC
    `;

    const byCategory: Record<string, number> = {};
    const byWeight: Record<string, number> = {};
    products.forEach((p) => {
      const units = Number(p.total_units) || 0;
      if (p.category) byCategory[p.category] = (byCategory[p.category] || 0) + units;
      const range2 = getWeightRange(p.weight_grams ?? null);
      byWeight[range2] = (byWeight[range2] || 0) + units;
    });

    const totalUnits = Object.values(byCategory).reduce((a, b) => a + b, 0);

    branchSales.push({
      branchId: branch.id,
      branchName: branch.name,
      totalUnitsLast30d: totalUnits,
      // Full list — frontend slices/filters as needed.
      products: products.map((p) => ({
        manufacturerProductId: p.id ?? '',
        productName: p.product_name || 'Unknown',
        designNumber: p.design_number ?? null,
        imageUrl: p.secure_url ?? null,
        category: p.category ?? null,
        subCategory: p.sub_category ?? null,
        weight: parseDecimal(p.weight_grams ?? null),
        units: Number(p.total_units) || 0,
        stars: calculateStars(Number(p.total_units) || 0),
      })),
      topProducts: products.slice(0, 5).map((p) => ({
        manufacturerProductId: p.id ?? '',
        productName: p.product_name || 'Unknown',
        designNumber: p.design_number ?? null,
        imageUrl: p.secure_url ?? null,
        category: p.category ?? null,
        subCategory: p.sub_category ?? null,
        units: Number(p.total_units) || 0,
        stars: calculateStars(Number(p.total_units) || 0),
      })),
      byCategory,
      byWeight,
    });
  }

  return branchSales;
}

// ────────────────────────────────────────────────────────────────────────────
// MANUFACTURER: Retailer-wise breakdown
// ────────────────────────────────────────────────────────────────────────────

export async function getManufacturerRetailerSales(
  range: DateRangeOptions = {}
): Promise<ProductAggRow[]> {
  const { windowStart, windowEnd } = getDateRanges(range);

  const results = await prisma.$queryRaw<ProductAggRow[]>`
    WITH combined AS (
      SELECT koi.manufacturer_product_id AS product_id, koi.quantity AS quantity, ko.store_id AS store_id
      FROM kiosk_order_items koi
      JOIN kiosk_orders ko ON koi.order_id = ko.id
      WHERE ko.forwarded_to_manufacturer = true
        AND koi.manufacturer_product_id IS NOT NULL
        AND ko.created_at >= ${windowStart}::timestamp
        AND ko.created_at <= ${windowEnd}::timestamp

      UNION ALL

      SELECT boi.manufacturer_product_id AS product_id, boi.quantity AS quantity, bo.store_id AS store_id
      FROM b2b_order_items boi
      JOIN b2b_orders bo ON boi.order_id = bo.id
      WHERE bo.status = 'DELIVERED'
        AND bo.created_at >= ${windowStart}::timestamp
        AND bo.created_at <= ${windowEnd}::timestamp
    )
    SELECT
      s.id AS retailer_id,
      s.name AS retailer_name,
      mp.id AS product_id,
      mp.name,
      mp.category,
      mp.sub_category,
      mp.weight_grams,
      SUM(c.quantity) AS total_units
    FROM combined c
    JOIN stores s ON s.id = c.store_id
    JOIN manufacturer_products mp ON mp.id = c.product_id
    GROUP BY s.id, s.name, mp.id, mp.name, mp.category, mp.sub_category, mp.weight_grams
    ORDER BY s.name, total_units DESC
  `;

  return results.map((r) => ({ ...r, total_units: Number(r.total_units) || 0 }));
}

// ────────────────────────────────────────────────────────────────────────────
// MANUFACTURER: Category + Weight breakdown (all retailers) — flat rows,
// frontend filters + nests (category -> sub-category -> weight range).
// ────────────────────────────────────────────────────────────────────────────

export async function getManufacturerCategoryWeightBreakdown(
  range: DateRangeOptions = {}
): Promise<ProductAggRow[]> {
  const { windowStart, windowEnd } = getDateRanges(range);

  const results = await prisma.$queryRaw<ProductAggRow[]>`
    WITH combined AS (
      SELECT koi.manufacturer_product_id AS product_id, koi.quantity AS quantity
      FROM kiosk_order_items koi
      JOIN kiosk_orders ko ON koi.order_id = ko.id
      WHERE ko.forwarded_to_manufacturer = true
        AND koi.manufacturer_product_id IS NOT NULL
        AND ko.created_at >= ${windowStart}::timestamp
        AND ko.created_at <= ${windowEnd}::timestamp

      UNION ALL

      SELECT boi.manufacturer_product_id AS product_id, boi.quantity AS quantity
      FROM b2b_order_items boi
      JOIN b2b_orders bo ON boi.order_id = bo.id
      WHERE bo.status = 'DELIVERED'
        AND bo.created_at >= ${windowStart}::timestamp
        AND bo.created_at <= ${windowEnd}::timestamp
    )
    SELECT
      mp.id,
      mp.name,
      mp.category,
      mp.sub_category,
      mp.weight_grams,
      SUM(c.quantity) AS total_units
    FROM combined c
    JOIN manufacturer_products mp ON mp.id = c.product_id
    GROUP BY mp.id, mp.name, mp.category, mp.sub_category, mp.weight_grams
    ORDER BY mp.category, mp.sub_category, mp.weight_grams
  `;

  return results.map((r) => ({ ...r, total_units: Number(r.total_units) || 0 }));
}

// ────────────────────────────────────────────────────────────────────────────
// MANUFACTURER: Top products (all retailers)
// ────────────────────────────────────────────────────────────────────────────

export async function getManufacturerTopProducts(
  limit = 10,
  range: DateRangeOptions = {}
): Promise<ProductAggRow[]> {
  const { windowStart, windowEnd } = getDateRanges(range);

  const results = await prisma.$queryRaw<ProductAggRow[]>`
    WITH combined AS (
      SELECT koi.manufacturer_product_id AS product_id, koi.quantity AS quantity
      FROM kiosk_order_items koi
      JOIN kiosk_orders ko ON koi.order_id = ko.id
      WHERE ko.forwarded_to_manufacturer = true
        AND koi.manufacturer_product_id IS NOT NULL
        AND ko.created_at >= ${windowStart}::timestamp
        AND ko.created_at <= ${windowEnd}::timestamp

      UNION ALL

      SELECT boi.manufacturer_product_id AS product_id, boi.quantity AS quantity
      FROM b2b_order_items boi
      JOIN b2b_orders bo ON boi.order_id = bo.id
      WHERE bo.status = 'DELIVERED'
        AND bo.created_at >= ${windowStart}::timestamp
        AND bo.created_at <= ${windowEnd}::timestamp
    )
    SELECT
      mp.id,
      mp.name,
      mp.design_number,
      mp.category,
      mp.sub_category,
      mp.weight_grams,
      mpi.secure_url,
      SUM(c.quantity) AS total_units
    FROM combined c
    JOIN manufacturer_products mp ON mp.id = c.product_id
    LEFT JOIN manufacturer_product_images mpi ON mp.id = mpi.product_id AND mpi.is_primary = true
    GROUP BY mp.id, mp.name, mp.design_number, mp.category, mp.sub_category, mp.weight_grams, mpi.secure_url
    ORDER BY total_units DESC
    LIMIT ${limit}
  `;

  return results.map((r) => ({ ...r, total_units: Number(r.total_units) || 0 }));
}
