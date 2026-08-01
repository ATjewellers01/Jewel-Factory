/**
 * Small display formatters shared across catalog / detail / list views.
 * Pure functions, safe on both server and client.
 */

/**
 * Make a raw product name presentable: turn "necklace_simple" / "gold-chain"
 * into "Necklace Simple" / "Gold Chain". Leaves already-nice names sensible.
 * Only used for DISPLAY — the stored name is never changed.
 */
export function titleCaseName(name: string | null | undefined): string {
  if (!name) return '';
  return name
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

/**
 * Format a weight (Prisma Decimal arrives as a string like "12.500") to a clean
 * "12.5 g". Returns null when there's no usable weight.
 */
export function formatWeight(weight: string | number | null | undefined): string | null {
  if (weight === null || weight === undefined || weight === '') return null;
  const n = typeof weight === 'number' ? weight : Number(weight);
  if (!Number.isFinite(n) || n <= 0) return null;
  // Drop trailing zeros: 12.500 -> 12.5, 12.000 -> 12
  const clean = n.toFixed(3).replace(/\.?0+$/, '');
  return `${clean} g`;
}

/**
 * Build the small meta line under a product: "Set · Short Set · Gold 22K · 12.5 g".
 * Skips any missing part.
 */
export function productMetaLine(opts: {
  category?: string | null;
  subCategory?: string | null;
  purity?: string | null;
  weight?: string | number | null;
}): string {
  const parts: string[] = [];
  if (opts.category) parts.push(opts.category);
  if (opts.subCategory) parts.push(opts.subCategory);
  parts.push(`Gold${opts.purity ? ` ${opts.purity}` : ''}`);
  const w = formatWeight(opts.weight);
  if (w) parts.push(w);
  return parts.join(' · ');
}

/**
 * Split version of {@link productMetaLine} for narrow catalogue cards.
 *
 * On a phone the single-line variant is `truncate`d, and because the weight is
 * last it is the FIRST thing clipped — exactly the information a jeweller needs.
 * Callers render `descriptor` on a truncating line and `weight` on its own line
 * that never truncates, so the weight is always readable at any card width.
 */
export function productMetaParts(opts: {
  category?: string | null;
  subCategory?: string | null;
  purity?: string | null;
  weight?: string | number | null;
}): { descriptor: string; weight: string | null } {
  const parts: string[] = [];
  if (opts.category) parts.push(opts.category);
  if (opts.subCategory) parts.push(opts.subCategory);
  parts.push(`Gold${opts.purity ? ` ${opts.purity}` : ''}`);
  return { descriptor: parts.join(' · '), weight: formatWeight(opts.weight) };
}
