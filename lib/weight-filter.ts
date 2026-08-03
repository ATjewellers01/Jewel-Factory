/**
 * Shared weight filtering + sorting for every catalogue grid (Retailer Admin,
 * Retailer User kiosk/restock, Manufacturer).
 *
 * Pure functions so the three call sites stay in sync — previously each page
 * hand-rolled its own filter block and they had already drifted apart.
 *
 * Weights arrive as Prisma Decimal strings ("12.500"), so everything parses
 * defensively and a product with no usable weight is simply never matched by a
 * band (it would otherwise sort as 0 and pile up at the light end).
 */

/** A selectable weight range. `max === null` means "and above". */
export type WeightBand = { value: string; label: string; min: number; max: number | null };

export type WeightSort = '' | 'weight-asc' | 'weight-desc';

export const WEIGHT_SORT_OPTIONS: Array<{ value: WeightSort; label: string }> = [
  { value: '', label: 'Sort: default' },
  { value: 'weight-asc', label: 'Weight: light to heavy' },
  { value: 'weight-desc', label: 'Weight: heavy to light' },
];

/** Parse a Decimal-string / number weight to a positive number, else null. */
export function weightValue(weight: string | number | null | undefined): number | null {
  if (weight === null || weight === undefined || weight === '') return null;
  const n = typeof weight === 'number' ? weight : Number(weight);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// Round a bound to a tidy number so labels read "0–10 g", not "0–9.73 g".
function niceStep(spread: number): number {
  if (spread <= 12) return 2;
  if (spread <= 30) return 5;
  if (spread <= 80) return 10;
  if (spread <= 200) return 25;
  return 50;
}

/**
 * Derive weight bands from the stock actually on screen, instead of hardcoding
 * ranges: a bangle catalogue (10–100 g) and a pendant catalogue (1–8 g) need
 * very different buckets, and a fixed list would leave most options empty.
 *
 * Returns [] when there aren't at least two distinct weights — a single band
 * would match everything and just be noise.
 */
export function deriveWeightBands(weights: Array<string | number | null | undefined>): WeightBand[] {
  const values = weights.map(weightValue).filter((n): n is number => n !== null);
  if (values.length === 0) return [];

  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max - min < 0.5) return [];

  const step = niceStep(max - min);
  const start = Math.floor(min / step) * step;
  const end = Math.ceil(max / step) * step;

  const bands: WeightBand[] = [];
  for (let lower = start; lower < end; lower += step) {
    const upper = lower + step;
    // Only offer a band that actually contains something.
    const isLast = upper >= end;
    const hit = values.some((v) => v >= lower && (isLast ? v <= upper : v < upper));
    if (!hit) continue;
    bands.push({
      value: `${lower}-${upper}`,
      label: `${trim(lower)}–${trim(upper)} g`,
      min: lower,
      max: upper,
    });
  }

  return bands.length > 1 ? bands : [];
}

function trim(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/** True when the product's weight falls in the selected band (or none is selected). */
export function matchWeightBand(
  weight: string | number | null | undefined,
  bandValue: string,
  bands: WeightBand[],
): boolean {
  if (!bandValue) return true;
  const band = bands.find((b) => b.value === bandValue);
  if (!band) return true;
  const n = weightValue(weight);
  if (n === null) return false;
  // The top band is inclusive of its upper bound so the heaviest piece is never
  // excluded by the `< max` used everywhere else.
  const isTop = bands[bands.length - 1]?.value === band.value;
  return n >= band.min && (band.max === null || (isTop ? n <= band.max : n < band.max));
}

/**
 * Sort by weight. Products without a usable weight always sink to the end
 * regardless of direction, so an unset weight never masquerades as "lightest".
 */
export function sortByWeight<T>(
  items: T[],
  direction: WeightSort,
  getWeight: (item: T) => string | number | null | undefined,
): T[] {
  if (!direction) return items;
  const dir = direction === 'weight-asc' ? 1 : -1;
  return [...items].sort((a, b) => {
    const wa = weightValue(getWeight(a));
    const wb = weightValue(getWeight(b));
    if (wa === null && wb === null) return 0;
    if (wa === null) return 1;
    if (wb === null) return -1;
    return (wa - wb) * dir;
  });
}
