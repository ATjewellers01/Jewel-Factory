'use client';

import { useEffect, useState } from 'react';

// Read-only manufacturer taxonomy (Category / Sub-category 1 / Sub-category 2
// / Purity — 2026-08-17), fetched from whichever portal-scoped /taxonomy
// endpoint applies to the caller. Mirrors the shape of the old static
// lib/categories.ts helpers (CATEGORIES, subCategoriesFor, PURITIES) so call
// sites only need to swap the import + call this hook, not restructure.

type RawSubCategory1 = { id: string; name: string; subCategories2: { id: string; name: string }[] };
type RawCategory = { id: string; name: string; subCategories1: RawSubCategory1[] };
type RawTaxonomy = { categories: RawCategory[]; purities: { id: string; name: string }[] };

export type Taxonomy = {
  categories: string[];
  purities: string[];
  subCategories1For: (category: string | null | undefined) => string[];
  // Sub-category 2 is scoped to its own parent Sub-category 1 — needs BOTH
  // the category and the chosen sub-category 1 name to resolve its list.
  subCategories2For: (category: string | null | undefined, subCategory1: string | null | undefined) => string[];
  loaded: boolean;
};

const EMPTY: Taxonomy = {
  categories: [],
  purities: [],
  subCategories1For: () => [],
  subCategories2For: () => [],
  loaded: false,
};

/**
 * `endpoint` is the full /api path to fetch — each portal has its own
 * manufacturer-scoped read route:
 *   Retailer Admin:    /api/store/taxonomy         (store-catalog.ts)
 *   Store Manager:     /api/branch-manager/taxonomy (branch-manager.ts)
 *   Manufacturer:      /api/manufacturer/taxonomy   (manufacturer-taxonomy.ts)
 *   Public kiosk:      /api/kiosk/taxonomy?store=<slug> (kiosk.ts)
 */
export function useTaxonomy(endpoint: string): Taxonomy {
  const [raw, setRaw] = useState<RawTaxonomy | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(endpoint, { cache: 'no-store', credentials: 'same-origin' });
        const json = (await res.json()) as { data?: RawTaxonomy };
        if (!cancelled) setRaw(json.data ?? { categories: [], purities: [] });
      } catch {
        if (!cancelled) setRaw({ categories: [], purities: [] });
      }
    })();
    return () => { cancelled = true; };
  }, [endpoint]);

  if (!raw) return EMPTY;

  return {
    categories: raw.categories.map((c) => c.name),
    purities: raw.purities.map((p) => p.name),
    subCategories1For: (category) => raw.categories.find((c) => c.name === category)?.subCategories1.map((s) => s.name) ?? [],
    subCategories2For: (category, subCategory1) =>
      raw.categories.find((c) => c.name === category)?.subCategories1.find((s) => s.name === subCategory1)?.subCategories2.map((s) => s.name) ?? [],
    loaded: true,
  };
}
