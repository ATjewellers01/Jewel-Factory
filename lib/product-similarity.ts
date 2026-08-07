/**
 * Client-side "similar to this" ranking, shared by the cart's "You may also
 * like" section and the catalogue's keyword search. Priority-based, not an
 * exact-match filter: category carries the most weight, then purity — so a
 * cart item still surfaces *something* even when nothing matches every field
 * exactly (a strict AND filter went empty far too often on a real catalogue).
 */
type SimilarityInput = {
  id: string;
  category: string | null;
  purity?: string | null;
};

/** Higher is more similar. 0 means "no signal at all" — callers should still
 *  show these last rather than drop them, unless the list is already long. */
function similarityScore(target: SimilarityInput, candidate: SimilarityInput): number {
  let score = 0;
  if (target.category && candidate.category === target.category) score += 6;
  if (target.purity && candidate.purity === target.purity) score += 3;
  return score;
}

/** Ranks `pool` by similarity to `target`, excluding `target` itself, and
 *  drops anything with zero signal once there are enough real matches. */
export function rankSimilar<T extends SimilarityInput>(target: T, pool: T[], limit = 8): T[] {
  const scored = pool
    .filter((p) => p.id !== target.id)
    .map((p) => ({ product: p, score: similarityScore(target, p) }))
    .sort((a, b) => b.score - a.score);

  const withSignal = scored.filter((s) => s.score > 0);
  const ranked = withSignal.length >= limit ? withSignal : scored;
  return ranked.slice(0, limit).map((s) => s.product);
}

type DescribableProduct = {
  designNumber: string;
  category: string | null;
  subCategory: string | null;
  description?: string | null;
};

/** Keyword search across design number, category/sub-category, and the free-
 *  text description — a looser match than the exact-designNumber search box
 *  this sits alongside, so "gold necklace" or "antique" finds pieces the
 *  design-number box can't. Splits the query on whitespace and requires
 *  every word to appear somewhere (AND, not OR), so multi-word queries
 *  narrow rather than widen the results. */
export function matchesDescriptionQuery(product: DescribableProduct, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    product.designNumber,
    product.category ?? '',
    product.subCategory ?? '',
    product.description ?? '',
  ].join(' ').toLowerCase();
  return q.split(/\s+/).every((word) => haystack.includes(word));
}
