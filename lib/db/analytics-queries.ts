/**
 * Analytics queries for aggregating sales data across roles.
 * Uses raw SQL for complex date-range aggregations.
 */

// Query result types for raw SQL queries
interface BaseProductRow {
  weight_grams: string | number | null;
}

interface RetailerProductRow extends BaseProductRow {
  manufacturer_product_id: string;
  product_name_snapshot: string;
  design_number: string | null;
  category: string | null;
  sub_category: string | null;
  secure_url: string | null;
  units_last_30d: number;
  units_previous_30d: number;
  units_all_time: number;
}

interface BranchProductRow {
  product_name: string;
  category: string | null;
  sub_category: string | null;
  total_units: number;
}

interface CategoryRow {
  category: string | null;
  sub_category: string | null;
  total_units: number;
}

interface TopProductRow {
  id: string;
  name: string;
  design_number: string | null;
  category: string | null;
  sub_category: string | null;
  total_units: number;
  secure_url: string | null;
}

import { prisma } from '@/lib/prisma';
import {
  ProductSalesData,
  BranchSalesData,
  calculateStars,
  calculateTrend,
  getWeightRange,
  parseDecimal,
  getDateRanges,
} from '@/lib/db/analytics';

// ────────────────────────────────────────────────────────────────────────────
// STORE MANAGER: Best-sellers in THIS branch (last 30 days)
// ────────────────────────────────────────────────────────────────────────────

export async function getStoreManagerProductSales(
  branchId: string
): Promise<ProductSalesData[]> {
  const { last30dStart, previous30dStart, previous30dEnd, all30dStart } =
    getDateRanges();

  // Raw SQL query to aggregate kiosk + b2b orders by product
  const results = await prisma.$queryRaw<
    Array<{
      manufacturer_product_id: string;
      product_name_snapshot: string;
      design_number: string | null;
      category_snapshot: string | null;
      sub_category_snapshot: string | null;
      weight_grams: string | number | null;
      secure_url: string | null;
      units_last_30d: number;
      units_previous_30d: number;
      units_all_time: number;
    }>
  >`
    SELECT
      COALESCE(koi.manufacturer_product_id, boi.manufacturer_product_id) as manufacturer_product_id,
      COALESCE(koi.product_name_snapshot, boi.product_name_snapshot) as product_name_snapshot,
      mp.design_number,
      COALESCE(koi.category_snapshot, mp.category) as category_snapshot,
      mp.sub_category as sub_category_snapshot,
      mp.weight_grams,
      mpi.secure_url,

      COALESCE(SUM(CASE WHEN ko.created_at >= ${last30dStart}::timestamp THEN COALESCE(koi.quantity, 0) ELSE 0 END),
               SUM(CASE WHEN bo.created_at >= ${last30dStart}::timestamp THEN COALESCE(boi.quantity, 0) ELSE 0 END), 0) as units_last_30d,

      COALESCE(SUM(CASE WHEN ko.created_at >= ${previous30dStart}::timestamp AND ko.created_at < ${previous30dEnd}::timestamp THEN COALESCE(koi.quantity, 0) ELSE 0 END),
               SUM(CASE WHEN bo.created_at >= ${previous30dStart}::timestamp AND bo.created_at < ${previous30dEnd}::timestamp THEN COALESCE(boi.quantity, 0) ELSE 0 END), 0) as units_previous_30d,

      COALESCE(SUM(COALESCE(koi.quantity, 0)), SUM(COALESCE(boi.quantity, 0)), 0) as units_all_time

    FROM kiosk_order_items koi
    FULL OUTER JOIN kiosk_orders ko ON koi.order_id = ko.id
    FULL OUTER JOIN b2b_order_items boi ON 1=0  -- Placeholder for union logic
    FULL OUTER JOIN b2b_orders bo ON boi.order_id = bo.id
    LEFT JOIN manufacturer_products mp ON COALESCE(koi.manufacturer_product_id, boi.manufacturer_product_id) = mp.id
    LEFT JOIN manufacturer_product_images mpi ON mp.id = mpi.product_id AND mpi.is_primary = true

    WHERE (ko.branch_id = ${branchId}::uuid AND ko.forwarded_to_manufacturer = true AND ko.created_at >= ${all30dStart}::timestamp)
      OR (bo.branch_id = ${branchId}::uuid AND bo.status = 'DELIVERED' AND bo.created_at >= ${all30dStart}::timestamp)

    GROUP BY
      COALESCE(koi.manufacturer_product_id, boi.manufacturer_product_id),
      COALESCE(koi.product_name_snapshot, boi.product_name_snapshot),
      mp.design_number,
      COALESCE(koi.category_snapshot, mp.category),
      mp.sub_category,
      mp.weight_grams,
      mpi.secure_url

    ORDER BY units_last_30d DESC
  `;

  return results.map((r) => {
    const unitsLast30d = Number(r.units_last_30d) || 0;
    const unitsPrevious30d = Number(r.units_previous_30d) || 0;
    const { direction, percent } = calculateTrend(unitsLast30d, unitsPrevious30d);

    return {
      manufacturerProductId: r.manufacturer_product_id,
      productName: r.product_name_snapshot || 'Unknown',
      designNumber: r.design_number || 'N/A',
      category: r.category_snapshot,
      subCategory: r.sub_category_snapshot,
      weight: parseDecimal(r.weight_grams),
      imageUrl: r.secure_url,
      unitsLast30d,
      unitsPrevious30d,
      unitsAllTime: Number(r.units_all_time) || 0,
      trendPercent: percent,
      stars: calculateStars(unitsLast30d),
      trendDirection: direction,
    };
  });
}

// ────────────────────────────────────────────────────────────────────────────
// RETAILER: All products ordered across ALL branches (last 30 days)
// ────────────────────────────────────────────────────────────────────────────

export async function getRetailerProductSales(
  storeId: string
): Promise<ProductSalesData[]> {
  const { last30dStart, previous30dStart, previous30dEnd, all30dStart } =
    getDateRanges();

  // Query: Aggregate all kiosk + b2b orders across all branches of this retailer
  const results = await prisma.$queryRaw<Record<string, unknown>[]>`
    SELECT
      mp.id as manufacturer_product_id,
      COALESCE(koi.product_name_snapshot, boi.product_name_snapshot, mp.name) as product_name_snapshot,
      mp.design_number,
      mp.category,
      mp.sub_category,
      mp.weight_grams,
      mpi.secure_url,

      SUM(CASE WHEN (ko.created_at >= ${last30dStart}::timestamp AND ko.forwarded_to_manufacturer = true)
               OR (bo.created_at >= ${last30dStart}::timestamp AND bo.status = 'DELIVERED')
           THEN COALESCE(koi.quantity, boi.quantity, 0) ELSE 0 END) as units_last_30d,

      SUM(CASE WHEN ((ko.created_at >= ${previous30dStart}::timestamp AND ko.created_at < ${previous30dEnd}::timestamp AND ko.forwarded_to_manufacturer = true)
                  OR (bo.created_at >= ${previous30dStart}::timestamp AND bo.created_at < ${previous30dEnd}::timestamp AND bo.status = 'DELIVERED'))
           THEN COALESCE(koi.quantity, boi.quantity, 0) ELSE 0 END) as units_previous_30d,

      SUM(COALESCE(koi.quantity, boi.quantity, 0)) as units_all_time

    FROM manufacturer_products mp
    LEFT JOIN kiosk_order_items koi ON mp.id = koi.manufacturer_product_id
    LEFT JOIN kiosk_orders ko ON koi.order_id = ko.id AND ko.store_id = ${storeId}::uuid
    LEFT JOIN b2b_order_items boi ON mp.id = boi.manufacturer_product_id
    LEFT JOIN b2b_orders bo ON boi.order_id = bo.id AND bo.store_id = ${storeId}::uuid
    LEFT JOIN manufacturer_product_images mpi ON mp.id = mpi.product_id AND mpi.is_primary = true

    WHERE (ko.created_at >= ${all30dStart}::timestamp OR bo.created_at >= ${all30dStart}::timestamp)

    GROUP BY mp.id, mp.name, mp.design_number, mp.category, mp.sub_category, mp.weight_grams, mpi.secure_url, koi.product_name_snapshot, boi.product_name_snapshot
    HAVING SUM(COALESCE(koi.quantity, boi.quantity, 0)) > 0
    ORDER BY units_last_30d DESC
  `;

  return results.map((r) => {
    const unitsLast30d = Number(r.units_last_30d) || 0;
    const unitsPrevious30d = Number(r.units_previous_30d) || 0;
    const { direction, percent } = calculateTrend(unitsLast30d, unitsPrevious30d);

    return {
      manufacturerProductId: r.manufacturer_product_id,
      productName: r.product_name_snapshot || 'Unknown',
      designNumber: r.design_number || 'N/A',
      category: r.category,
      subCategory: r.sub_category,
      weight: parseDecimal(r.weight_grams),
      imageUrl: r.secure_url,
      unitsLast30d,
      unitsPrevious30d,
      unitsAllTime: Number(r.units_all_time) || 0,
      trendPercent: percent,
      stars: calculateStars(unitsLast30d),
      trendDirection: direction,
    };
  });
}

// ────────────────────────────────────────────────────────────────────────────
// RETAILER: Branch-wise breakdown (Store A, Store B, etc.)
// ────────────────────────────────────────────────────────────────────────────

export async function getRetailerBranchSales(
  storeId: string
): Promise<BranchSalesData[]> {
  const { last30dStart } = getDateRanges();

  // Get all branches for this retailer
  const branches = await prisma.branch.findMany({
    where: { storeId },
    select: { id: true, name: true },
  });

  // For each branch, aggregate sales
  const branchSales: BranchSalesData[] = [];

  for (const branch of branches) {
    const products = await prisma.$queryRaw<Record<string, unknown>[]>`
      SELECT
        mp.id,
        COALESCE(koi.product_name_snapshot, boi.product_name_snapshot, mp.name) as product_name,
        mp.category,
        mp.sub_category,
        mp.weight_grams,
        SUM(COALESCE(koi.quantity, boi.quantity, 0)) as total_units
      FROM manufacturer_products mp
      LEFT JOIN kiosk_order_items koi ON mp.id = koi.manufacturer_product_id
      LEFT JOIN kiosk_orders ko ON koi.order_id = ko.id AND ko.branch_id = ${branch.id}::uuid AND ko.forwarded_to_manufacturer = true
      LEFT JOIN b2b_order_items boi ON mp.id = boi.manufacturer_product_id
      LEFT JOIN b2b_orders bo ON boi.order_id = bo.id AND bo.branch_id = ${branch.id}::uuid AND bo.status = 'DELIVERED'
      WHERE (ko.created_at >= ${last30dStart}::timestamp OR bo.created_at >= ${last30dStart}::timestamp)
      GROUP BY mp.id, mp.name, mp.category, mp.sub_category, mp.weight_grams, koi.product_name_snapshot, boi.product_name_snapshot
      HAVING SUM(COALESCE(koi.quantity, boi.quantity, 0)) > 0
      ORDER BY total_units DESC
      LIMIT 5
    `;

    // Build category and weight breakdowns
    const byCategory: Record<string, number> = {};
    const byWeight: Record<string, number> = {};

    const allProducts = await prisma.$queryRaw<Record<string, unknown>[]>`
      SELECT
        mp.category,
        mp.weight_grams,
        SUM(COALESCE(koi.quantity, boi.quantity, 0)) as qty
      FROM manufacturer_products mp
      LEFT JOIN kiosk_order_items koi ON mp.id = koi.manufacturer_product_id
      LEFT JOIN kiosk_orders ko ON koi.order_id = ko.id AND ko.branch_id = ${branch.id}::uuid
      LEFT JOIN b2b_order_items boi ON mp.id = boi.manufacturer_product_id
      LEFT JOIN b2b_orders bo ON boi.order_id = bo.id AND bo.branch_id = ${branch.id}::uuid
      WHERE (ko.created_at >= ${last30dStart}::timestamp OR bo.created_at >= ${last30dStart}::timestamp)
      GROUP BY mp.category, mp.weight_grams
    `;

    allProducts.forEach((p) => {
      if (p.category) byCategory[p.category] = (byCategory[p.category] || 0) + Number(p.qty);
      const range = getWeightRange(p.weight_grams);
      byWeight[range] = (byWeight[range] || 0) + Number(p.qty);
    });

    const totalUnits = Object.values(byCategory).reduce((a, b) => a + b, 0);

    branchSales.push({
      branchId: branch.id,
      branchName: branch.name,
      totalUnitsLast30d: totalUnits,
      topProducts: products.map((p) => ({
        productName: p.product_name,
        category: p.category,
        subCategory: p.sub_category,
        units: Number(p.total_units),
        stars: calculateStars(Number(p.total_units)),
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

export async function getManufacturerRetailerSales(): Promise<any[]> {
  const { last30dStart } = getDateRanges();

  const results = await prisma.$queryRaw<Record<string, unknown>[]>`
    SELECT
      s.id as retailer_id,
      s.name as retailer_name,
      mp.id as product_id,
      mp.name,
      mp.category,
      mp.sub_category,
      SUM(COALESCE(koi.quantity, boi.quantity, 0)) as total_units
    FROM stores s
    LEFT JOIN kiosk_orders ko ON s.id = ko.store_id
    LEFT JOIN kiosk_order_items koi ON ko.id = koi.order_id AND ko.forwarded_to_manufacturer = true
    LEFT JOIN b2b_orders bo ON s.id = bo.store_id
    LEFT JOIN b2b_order_items boi ON bo.id = boi.order_id AND bo.status = 'DELIVERED'
    LEFT JOIN manufacturer_products mp ON COALESCE(koi.manufacturer_product_id, boi.manufacturer_product_id) = mp.id
    WHERE (ko.created_at >= ${last30dStart}::timestamp OR bo.created_at >= ${last30dStart}::timestamp)
    GROUP BY s.id, s.name, mp.id, mp.name, mp.category, mp.sub_category
    HAVING SUM(COALESCE(koi.quantity, boi.quantity, 0)) > 0
    ORDER BY retailer_name, total_units DESC
  `;

  return results;
}

// ────────────────────────────────────────────────────────────────────────────
// MANUFACTURER: Category + Weight breakdown (all retailers)
// ────────────────────────────────────────────────────────────────────────────

export async function getManufacturerCategoryWeightBreakdown(): Promise<any[]> {
  const { last30dStart } = getDateRanges();

  const results = await prisma.$queryRaw<Record<string, unknown>[]>`
    SELECT
      mp.category,
      mp.sub_category,
      mp.weight_grams,
      SUM(COALESCE(koi.quantity, boi.quantity, 0)) as total_units
    FROM manufacturer_products mp
    LEFT JOIN kiosk_order_items koi ON mp.id = koi.manufacturer_product_id
    LEFT JOIN kiosk_orders ko ON koi.order_id = ko.id AND ko.forwarded_to_manufacturer = true
    LEFT JOIN b2b_order_items boi ON mp.id = boi.manufacturer_product_id
    LEFT JOIN b2b_orders bo ON boi.order_id = bo.id AND bo.status = 'DELIVERED'
    WHERE (ko.created_at >= ${last30dStart}::timestamp OR bo.created_at >= ${last30dStart}::timestamp)
    GROUP BY mp.category, mp.sub_category, mp.weight_grams
    ORDER BY mp.category, mp.sub_category, mp.weight_grams
  `;

  return results;
}

// ────────────────────────────────────────────────────────────────────────────
// MANUFACTURER: Top 10 products (all retailers, all time)
// ────────────────────────────────────────────────────────────────────────────

export async function getManufacturerTopProducts(limit = 10): Promise<any[]> {
  const results = await prisma.$queryRaw<Record<string, unknown>[]>`
    SELECT
      mp.id,
      mp.name,
      mp.design_number,
      mp.category,
      mp.sub_category,
      mp.weight_grams,
      mpi.secure_url,
      SUM(COALESCE(koi.quantity, boi.quantity, 0)) as total_units
    FROM manufacturer_products mp
    LEFT JOIN kiosk_order_items koi ON mp.id = koi.manufacturer_product_id
    LEFT JOIN kiosk_orders ko ON koi.order_id = ko.id AND ko.forwarded_to_manufacturer = true
    LEFT JOIN b2b_order_items boi ON mp.id = boi.manufacturer_product_id
    LEFT JOIN b2b_orders bo ON boi.order_id = bo.id AND bo.status = 'DELIVERED'
    LEFT JOIN manufacturer_product_images mpi ON mp.id = mpi.product_id AND mpi.is_primary = true
    GROUP BY mp.id, mp.name, mp.design_number, mp.category, mp.sub_category, mp.weight_grams, mpi.secure_url
    HAVING SUM(COALESCE(koi.quantity, boi.quantity, 0)) > 0
    ORDER BY total_units DESC
    LIMIT ${limit}
  `;

  return results;
}
