/**
 * Analytics helpers and types for sales data aggregation.
 * Used by all roles (Store Manager, Retailer, Manufacturer) for insights.
 */

export interface ProductSalesData {
  manufacturerProductId: string;
  productName: string;
  designNumber: string;
  category: string | null;
  subCategory: string | null;
  weight: number | null;
  imageUrl: string | null;

  unitsLast30d: number;
  unitsPrevious30d: number;
  unitsAllTime: number;

  trendPercent: number; // positive = up, negative = down
  stars: number; // 1-5
  trendDirection: 'up' | 'down' | 'stable';
}

export interface BranchSalesData {
  branchId: string;
  branchName: string;
  totalUnitsLast30d: number;
  topProducts: Array<{
    productName: string;
    category: string | null;
    subCategory: string | null;
    units: number;
    stars: number;
  }>;
  byCategory: Record<string, number>; // { Bangles: 200, Sets: 100 }
  byWeight: Record<string, number>; // { '5-10g': 250, '10-15g': 180 }
}

export interface RetailerSalesData {
  retailerId: string;
  retailerName: string;
  totalUnitsLast30d: number;
  branches: BranchSalesData[];
  topProducts: Array<{
    productName: string;
    category: string | null;
    subCategory: string | null;
    branchName: string;
    units: number;
    stars: number;
  }>;
  byCategory: Record<string, number>;
  byWeight: Record<string, number>;
}

export interface CategoryBreakdownItem {
  category: string;
  subCategory: string;
  weightRanges: {
    range: string;
    units: number;
    retailers?: string[]; // list of retailer names (for manufacturer view)
  }[];
  totalUnits: number;
}

// ────────────────────────────────────────────────────────────────────────────
// CALCULATIONS
// ────────────────────────────────────────────────────────────────────────────

/**
 * Calculate star rating from unit count (last 30 days)
 * 0-10 → ⭐
 * 11-30 → ⭐⭐
 * 31-60 → ⭐⭐⭐
 * 61-100 → ⭐⭐⭐⭐
 * 100+ → ⭐⭐⭐⭐⭐
 */
export function calculateStars(units: number): number {
  if (units >= 100) return 5;
  if (units >= 61) return 4;
  if (units >= 31) return 3;
  if (units >= 11) return 2;
  if (units > 0) return 1;
  return 0;
}

/**
 * Calculate trend direction and percentage change
 */
export function calculateTrend(
  current: number,
  previous: number
): { direction: 'up' | 'down' | 'stable'; percent: number } {
  if (previous === 0) return { direction: 'stable', percent: 0 };

  const percent = Math.round(((current - previous) / previous) * 100);

  // Only flag as trend if > 5% change threshold
  if (percent > 5) return { direction: 'up', percent };
  if (percent < -5) return { direction: 'down', percent: Math.abs(percent) };

  return { direction: 'stable', percent: 0 };
}

/**
 * Group weight in grams into ranges
 */
export function getWeightRange(weight: number | null | string): string {
  if (!weight) return 'Unknown';

  const w = typeof weight === 'string' ? parseFloat(weight) : weight;

  if (w < 5) return '0-5g';
  if (w < 10) return '5-10g';
  if (w < 15) return '10-15g';
  if (w < 20) return '15-20g';
  return '20g+';
}

/**
 * Parse Decimal type from Prisma (may be Decimal object or number)
 */
export function parseDecimal(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return parseFloat(value);
  // Handle Decimal object from prisma (has a toNumber() method)
  if (typeof value === 'object' && typeof (value as { toNumber?: unknown }).toNumber === 'function') {
    return (value as { toNumber: () => number }).toNumber();
  }
  // Fallback for other decimal representations (e.g. { d, e, s } internal shape)
  return parseFloat(String(value));
}

/**
 * Format date for comparison (YYYY-MM-DD)
 */
export function formatDateForComparison(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Get date ranges for analytics queries
 */
export function getDateRanges(): {
  last30dStart: Date;
  previous30dStart: Date;
  previous30dEnd: Date;
  all30dStart: Date;
} {
  const now = new Date();

  // Last 30 days: now - 30
  const last30dStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Previous 30 days: now - 60 to now - 30
  const previous30dEnd = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const previous30dStart = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  // All 60 days for all-time baseline
  const all30dStart = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  return { last30dStart, previous30dStart, previous30dEnd, all30dStart };
}
