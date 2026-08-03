/**
 * Category taxonomy — the SINGLE SOURCE OF TRUTH for the whole app.
 *
 * Product forms, the custom-design kiosk form, catalog filters, and the DB seed
 * all import from here so the list can never drift out of sync.
 *
 * Shape: parent category -> its sub-categories (may be empty).
 * Values are stored on products verbatim as they appear here (Title Case).
 * Sub-category is optional; a category with an empty array simply has no
 * sub-categories, and the sub-category field then accepts free text.
 */

export const CATEGORY_TREE: Record<string, string[]> = {
  Bangles: [
    'Top Seller Bangles',
    'Premium Bangles',
    'Ultra Light Bangles',
    'Fancy Hmade Bangles',
    'Fusion Bangles',
    'Antique Bangles',
    'Baby Bangles',
    'Gajra Bangles',
    'Hollow Bangles',
    'Indo Italian Bangles',
    'Machine Bangles',
    'Plaster Bangles',
    'Raji Bangles',
    'V- Pacheli Bangles',
    'Nakshi Bangles',
  ],
  'Bindiya / Mangtika': [],
  Bracelet: ['Gents Bracelet / Kada', 'Ladies Bracelet'],
  Chain: [],
  'Ear Chain Kannoti': [],
  Earrings: ['Chandbali', 'Jhumki', 'Kannoti Earring', 'Tops', 'V Chain Earring'],
  'JF Coin': [],
  Mangalsutra: [],
  "Men's Collection": ['Belt Buckle', 'Cufflinks'],
  'Nath / Nose Ring': [],
  Pendants: ['Dorla Pendants', 'Double Hook Pendants', 'Single Hook Pendants'],
  Rings: ['Couple Ring', 'Gents Ring', 'Ladies Ring'],
  Set: ['Antique Set', 'Chain Set', 'Choker Set', 'Long Set', 'Pendent Set', 'Short Set', 'Turkish Set'],
  Watch: ['Gents Watch', 'Ladies Watch'],
};

/** Ordered list of top-level category names. */
export const CATEGORIES: string[] = Object.keys(CATEGORY_TREE);

/** Sub-categories for a given category (empty array if none / unknown). */
export function subCategoriesFor(category: string | null | undefined): string[] {
  if (!category) return [];
  return CATEGORY_TREE[category] ?? [];
}

/** True if the category has a predefined sub-category list. */
export function hasSubCategories(category: string | null | undefined): boolean {
  return subCategoriesFor(category).length > 0;
}

/** URL/DB-friendly slug for a category name (used by the seed's categories table). */
export function categorySlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Legacy → new mapping for the one-off migration of pre-existing products that
 * used the old flat 10-category list. `null` = leave the product's value as-is.
 * (Kept here so the migration script and any future data-fix share one map.)
 */
export const LEGACY_CATEGORY_MAP: Record<string, string | null> = {
  ring: 'Rings',
  earring: 'Earrings',
  necklace: 'Set', // necklace -> Set (sub-category "Short Set")
  bangle: 'Bangles',
  bracelet: 'Bracelet',
  pendant: 'Pendants',
  chain: 'Chain',
  'nose-pin': 'Nath / Nose Ring',
  anklet: null, // leave as-is (no matching new category)
  mangalsutra: 'Mangalsutra',
};
