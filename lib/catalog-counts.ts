/**
 * Shared "does this sub-category actually have any designs" helper.
 *
 * Originally written inline (twice, duplicated) in app/store/home/page.tsx
 * for the "Browse by category" collection drawer — "Home page collection
 * cards only show sub-categories with ≥1 active design" (2026-08-24) — so
 * an empty sub-category isn't advertised there. Extracted here 2026-09-23
 * so the SAME rule can be applied to every other place a Sub-category 1/2
 * filter dropdown lists the full taxonomy regardless of whether any design
 * exists in it: app/store/manufacturer-catalog/page.tsx's filters and
 * app/store-manager/CatalogOrderPanel.tsx's CatalogFilters (shared by both
 * the kiosk and restock pages).
 *
 * Pure client-side counting over whatever product list the caller already
 * fetched (no new API call/endpoint) — every one of these pages already
 * loads its own catalog via useApi<Product[]>.
 */

type CountableProduct = {
  category: string | null;
  subCategory?: string | null;
  subCategory2?: string | null;
};

export type CatalogCounts = {
  /** `${category}` -> count */
  byCategory: Record<string, number>;
  /** `${category}|${subCategory1}` -> count */
  bySub1: Record<string, number>;
  /** `${category}|${subCategory1}|${subCategory2}` -> count */
  bySub2: Record<string, number>;
};

export function buildCatalogCounts(products: CountableProduct[]): CatalogCounts {
  const byCategory: Record<string, number> = {};
  const bySub1: Record<string, number> = {};
  const bySub2: Record<string, number> = {};

  for (const p of products) {
    if (!p.category) continue;
    byCategory[p.category] = (byCategory[p.category] ?? 0) + 1;
    if (p.subCategory) {
      const key1 = `${p.category}|${p.subCategory}`;
      bySub1[key1] = (bySub1[key1] ?? 0) + 1;
      if (p.subCategory2) {
        const key2 = `${key1}|${p.subCategory2}`;
        bySub2[key2] = (bySub2[key2] ?? 0) + 1;
      }
    }
  }

  return { byCategory, bySub1, bySub2 };
}

/** Filters a full Sub-category 1 list down to only entries with ≥1 design
 * in the given category. */
export function subCategories1WithStock(counts: CatalogCounts, category: string | null | undefined, allSubs1: string[]): string[] {
  if (!category) return allSubs1;
  return allSubs1.filter((sub) => (counts.bySub1[`${category}|${sub}`] ?? 0) > 0);
}

/** Filters a full Sub-category 2 list down to only entries with ≥1 design
 * under the given category + Sub-category 1. */
export function subCategories2WithStock(
  counts: CatalogCounts,
  category: string | null | undefined,
  subCategory1: string | null | undefined,
  allSubs2: string[],
): string[] {
  if (!category || !subCategory1) return allSubs2;
  return allSubs2.filter((sub) => (counts.bySub2[`${category}|${subCategory1}|${sub}`] ?? 0) > 0);
}
