'use client';

import { ArrowRight, ArrowUpRight, Loader2, Sparkles, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { useApi } from '@/hooks/use-api';
import { CATEGORIES, subCategoriesFor } from '@/lib/categories';

type Img = { secureUrl: string; isPrimary: boolean };
type Product = {
  id: string; designNumber: string; category: string | null; subCategory: string | null;
  weightGrams: string | null; images: Img[];
};

const primaryImage = (p: Product) => (p.images.find((i) => i.isPrimary) ?? p.images[0])?.secureUrl ?? null;

/** Fisher-Yates shuffle — used both to randomize each category's own queue
 *  and the category order itself, so the strip looks different on every
 *  page load instead of a fixed sequence. */
function shuffled<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

/** Round-robins products across categories (one per category per pass) so the
 *  strip mixes the catalogue instead of running every design of one category
 *  before moving to the next — both the category order and each category's
 *  own queue are shuffled first, so the result varies on every page load
 *  rather than always showing the same fixed sequence. Bounded by a single
 *  pass over each category's queue (via a shared index), so it always
 *  terminates regardless of how the categories are distributed — no
 *  while-loop that could spin forever. */
function interleaveByCategory(products: Product[]): Product[] {
  const byCategory = new Map<string, Product[]>();
  for (const p of products) {
    const key = p.category ?? '';
    const list = byCategory.get(key);
    if (list) list.push(p); else byCategory.set(key, [p]);
  }
  const queues = shuffled([...byCategory.values()].map((list) => shuffled(list)));
  if (queues.length === 0) return [];
  const result: Product[] = [];
  const maxLen = Math.max(...queues.map((q) => q.length));
  for (let round = 0; round < maxLen; round++) {
    for (const queue of queues) {
      if (round < queue.length) result.push(queue[round]!);
    }
  }
  return result;
}

/**
 * Retailer Admin home — a browsing entry point, distinct from /store/dashboard
 * (which is operations: approvals, order counts).
 *
 * Two sections:
 *  1. A running strip of the live catalogue; each photo opens that design.
 *  2. An asymmetric category mosaic. A category with sub-categories opens a
 *     panel to pick one; a category without them goes straight to the catalog.
 *
 * Every tile deep-links into /store/manufacturer-catalog with ?category= (and
 * optionally &subCategory=), which that page reads to pre-filter itself.
 */
export default function StoreHomePage() {
  const { data, error, loading } = useApi<Product[]>('/api/store/catalog', '/store/login');
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const router = useRouter();

  const rawProducts = useMemo(() => (data ?? []).filter((p) => primaryImage(p)), [data]);
  // Interleave categories round-robin so the strip doesn't run several designs
  // from the same category back-to-back before moving to the next one.
  const products = useMemo(() => interleaveByCategory(rawProducts), [rawProducts]);

  // One representative image per category, for the mosaic tiles.
  const coverByCategory = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of products) {
      if (p.category && !map[p.category]) {
        const src = primaryImage(p);
        if (src) map[p.category] = src;
      }
    }
    return map;
  }, [products]);

  // Live design counts per category and per "Category|Sub" pair, so the tiles and
  // the sub-category panel can show how much stock actually sits behind each one
  // instead of just how many sub-categories the taxonomy defines.
  const counts = useMemo(() => {
    const byCategory: Record<string, number> = {};
    const bySub: Record<string, number> = {};
    for (const p of products) {
      if (!p.category) continue;
      byCategory[p.category] = (byCategory[p.category] ?? 0) + 1;
      if (p.subCategory) {
        const key = `${p.category}|${p.subCategory}`;
        bySub[key] = (bySub[key] ?? 0) + 1;
      }
    }
    return { byCategory, bySub };
  }, [products]);

  // Only categories with actual stock — the taxonomy has 14 entries and most
  // retailers only carry a handful, so showing every category padded the grid
  // with empty gold-gradient placeholders that had nothing behind them.
  const stockedCategories = useMemo(
    () => CATEGORIES.filter((c) => coverByCategory[c]).sort((a, b) => (counts.byCategory[b] ?? 0) - (counts.byCategory[a] ?? 0)),
    [coverByCategory, counts.byCategory],
  );

  function openCatalog(category: string, subCategory?: string) {
    const qs = new URLSearchParams({ category });
    if (subCategory) qs.set('subCategory', subCategory);
    router.push(`/store/manufacturer-catalog?${qs.toString()}`);
  }

  function handleCategoryClick(category: string) {
    if (subCategoriesFor(category).length > 0) setOpenCategory(category);
    else openCatalog(category);
  }

  // Close the sub-category panel on Escape, and lock body scroll while it's open.
  useEffect(() => {
    if (!openCategory) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenCategory(null); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [openCategory]);

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-10 pb-4">
      <header>
        <p className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.17em] text-[#9a7229]">
          <Sparkles className="h-3.5 w-3.5" /> The collection
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-[-0.025em] sm:text-4xl">Browse by category</h1>
        <p className="mt-1.5 max-w-xl text-sm leading-6 text-muted-foreground">
          Explore the full product catalogue, then build a restock order.
        </p>
      </header>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {loading && (
        <div className="flex items-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading the collection…
        </div>
      )}

      {!loading && !error && (
        <>
          <CatalogueStrip products={products} />
          <CategoryMosaic
            categories={stockedCategories}
            coverByCategory={coverByCategory}
            countByCategory={counts.byCategory}
            onSelect={handleCategoryClick}
          />
        </>
      )}

      {openCategory && (
        <SubCategoryPanel
          category={openCategory}
          cover={coverByCategory[openCategory]}
          total={counts.byCategory[openCategory] ?? 0}
          countBySub={counts.bySub}
          onPick={(sub) => openCatalog(openCategory, sub)}
          onViewAll={() => openCatalog(openCategory)}
          onClose={() => setOpenCategory(null)}
        />
      )}
    </div>
  );
}

/**
 * Edge-to-edge auto-scrolling strip of real catalogue photos; each is
 * clickable. Sized well above a typical thumbnail strip at every breakpoint —
 * this is meant to be looked at, not skimmed as a row of icons.
 */
function CatalogueStrip({ products }: { products: Product[] }) {
  if (products.length === 0) return null;
  // Duplicated once so the -50% translate loops seamlessly (see globals.css).
  const reel = [...products, ...products];

  return (
    <section aria-label="Catalogue highlights">
      <div className="group relative overflow-hidden rounded-2xl border border-[#e8e0d2] bg-[#faf7f1]">
        {/* Fade the edges so items enter and leave softly. */}
        <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-[#faf7f1] to-transparent sm:w-28" />
        <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-[#faf7f1] to-transparent sm:w-28" />

        <div className="jf-marquee-track flex gap-4 p-4 sm:gap-5 sm:p-5">
          {reel.map((p, i) => (
            <Link
              key={`${p.id}-${i}`}
              href={`/store/manufacturer-catalog?category=${encodeURIComponent(p.category ?? '')}`}
              // The duplicate half is decorative — keep it out of the tab order
              // and off the accessibility tree so nothing is announced twice.
              aria-hidden={i >= products.length}
              tabIndex={i >= products.length ? -1 : undefined}
              className="group/card relative block h-64 w-52 shrink-0 overflow-hidden rounded-xl bg-white ring-1 ring-black/5 transition-shadow hover:shadow-[0_10px_30px_rgba(31,24,15,0.16)] sm:h-96 sm:w-80 lg:h-[30rem] lg:w-[24rem]"
              title={p.designNumber}
            >
              {/* Eager, not lazy: this strip auto-scrolls via a CSS transform
                  (not real scroll events), so the browser's lazy-load
                  viewport heuristic doesn't reliably fire before an item
                  slides into view — it was showing blank white cards mid-scroll. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={primaryImage(p)!}
                alt={p.designNumber}
                loading="eager"
                className="h-full w-full object-cover transition-transform duration-500 group-hover/card:scale-105"
              />
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent px-4 pb-3 pt-9 text-sm font-semibold tabular-nums text-white sm:px-5 sm:text-base">
                {p.designNumber}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * Category mosaic, sized to how many categories actually have stock (2-6 in
 * practice, not the taxonomy's 14) — the old version used a repeating 6-tile
 * rhythm meant for a long list, so with only 2-3 real categories it looked
 * like a cut-off pattern rather than a deliberate layout. Each COUNT below is
 * a hand-composed arrangement instead of a formula, so 2 categories reads as
 * a balanced pair and 5 reads as a considered spread — not the same rhythm
 * truncated at different points.
 */
function CategoryMosaic({
  categories, coverByCategory, countByCategory, onSelect,
}: {
  categories: string[];
  coverByCategory: Record<string, string>;
  countByCategory: Record<string, number>;
  onSelect: (category: string) => void;
}) {
  if (categories.length === 0) return null;

  // span: column span out of 12 (sm and up). height: fixed, since grid rows
  // size to their tallest child — mixing aspect ratios in one row leaves a
  // gap under the shorter tile, so every layout below fixes heights per row.
  type Tile = { span: string; height: string };
  const LAYOUTS: Record<number, Tile[]> = {
    1: [{ span: 'sm:col-span-12', height: 'h-72 sm:h-96' }],
    2: [
      { span: 'sm:col-span-7', height: 'h-64 sm:h-[26rem]' },
      { span: 'sm:col-span-5', height: 'h-64 sm:h-[26rem]' },
    ],
    3: [
      { span: 'sm:col-span-7', height: 'h-64 sm:h-[22rem]' },
      { span: 'sm:col-span-5', height: 'h-56 sm:h-[10.5rem]' },
      { span: 'sm:col-span-5', height: 'h-56 sm:h-[10.5rem]' },
    ],
    4: [
      { span: 'sm:col-span-6', height: 'h-60 sm:h-72' },
      { span: 'sm:col-span-6', height: 'h-60 sm:h-72' },
      { span: 'sm:col-span-4', height: 'h-52 sm:h-60' },
      { span: 'sm:col-span-8', height: 'h-52 sm:h-60' },
    ],
    5: [
      { span: 'sm:col-span-7', height: 'h-64 sm:h-80' },
      { span: 'sm:col-span-5', height: 'h-64 sm:h-80' },
      { span: 'sm:col-span-4', height: 'h-52 sm:h-56' },
      { span: 'sm:col-span-4', height: 'h-52 sm:h-56' },
      { span: 'sm:col-span-4', height: 'h-52 sm:h-56' },
    ],
  };
  // 6+: two even hero rows of 3, repeating — still deliberate (a clean grid),
  // not a truncated rhythm, because every tile in it is the same shape.
  const layoutFor = (count: number): Tile[] => {
    if (LAYOUTS[count]) return LAYOUTS[count];
    return Array.from({ length: count }, () => ({ span: 'sm:col-span-4', height: 'h-56 sm:h-64' }));
  };
  const layout = layoutFor(categories.length);

  return (
    <section aria-label="Categories" className="space-y-4">
      <h2 className="font-display text-xl font-semibold tracking-tight">Categories</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-12 sm:gap-4">
        {categories.map((category, i) => {
          const { span, height } = layout[i]!;
          const cover = coverByCategory[category];
          const subs = subCategoriesFor(category);
          const total = countByCategory[category] ?? 0;
          const meta = `${total} ${total === 1 ? 'design' : 'designs'}${subs.length > 0 ? ` · ${subs.length} collections` : ''}`;

          return (
            <button
              key={category}
              type="button"
              onClick={() => onSelect(category)}
              className={`group relative ${span} ${height} overflow-hidden rounded-2xl bg-[#efe7da] text-left ring-1 ring-black/5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_20px_44px_rgba(31,24,15,0.18)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9a84c]`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={cover}
                alt=""
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.06]"
              />

              {/* Scrim keeps the label readable over any photo. */}
              <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/72 via-black/25 to-transparent" />

              <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4 sm:p-5">
                <span className="min-w-0">
                  <span className="block font-display text-lg font-semibold leading-tight text-white drop-shadow-sm sm:text-xl">
                    {category}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-white/70">{meta}</span>
                </span>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-white ring-1 ring-white/25 backdrop-blur-sm transition-colors group-hover:bg-[#c9a84c] group-hover:ring-[#c9a84c]">
                  <ArrowUpRight className="h-4 w-4" />
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/** Slide-over listing a category's sub-categories. */
function SubCategoryPanel({
  category, cover, total, countBySub, onPick, onViewAll, onClose,
}: {
  category: string;
  cover?: string;
  total: number;
  countBySub: Record<string, number>;
  onPick: (sub: string) => void;
  onViewAll: () => void;
  onClose: () => void;
}) {
  const subs = subCategoriesFor(category);

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={`${category} collections`}>
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" />

      {/* Full-width sheet on mobile, right-hand drawer from sm up. */}
      <aside className="absolute inset-x-0 bottom-0 flex max-h-[88vh] flex-col rounded-t-3xl bg-[#fffdfa] shadow-2xl sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-[min(92vw,460px)] sm:rounded-none">
        <div className="relative h-32 shrink-0 overflow-hidden sm:h-44">
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full bg-[#efe7da]" />
          )}
          <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/75 to-black/10" />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-colors hover:bg-black/60"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/70">Collection</p>
            <h2 className="font-display text-2xl font-semibold text-white">{category}</h2>
            <p className="mt-0.5 text-xs text-white/75">
              {total} {total === 1 ? 'design' : 'designs'} · {subs.length} collections
            </p>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          <div className="grid grid-cols-2 gap-2.5">
            {subs.map((sub) => {
              const n = countBySub[`${category}|${sub}`] ?? 0;
              return (
                <button
                  key={sub}
                  type="button"
                  onClick={() => onPick(sub)}
                  className="group flex min-h-[62px] items-center justify-between gap-2 rounded-xl border border-[#e8e0d2] bg-white px-3 py-2.5 text-left text-sm font-medium text-[#37302a] transition-all hover:-translate-y-0.5 hover:border-[#c9a84c] hover:shadow-[0_8px_20px_rgba(31,24,15,0.1)]"
                >
                  <span className="min-w-0">
                    <span className="block leading-snug">{sub}</span>
                    {/* A dimmed 0 is more useful than a hidden count — it says
                        "nothing in stock" rather than leaving the retailer guessing. */}
                    <span className={`mt-0.5 block text-[11px] font-normal tabular-nums ${n > 0 ? 'text-[#8a7f72]' : 'text-[#bdb3a6]'}`}>
                      {n} {n === 1 ? 'design' : 'designs'}
                    </span>
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[#b39244] opacity-0 transition-opacity group-hover:opacity-100" />
                </button>
              );
            })}
          </div>
        </div>

        <div className="shrink-0 border-t border-[#eee7dc] p-4 sm:p-5">
          <button
            type="button"
            onClick={onViewAll}
            className="metal-sheen flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold text-[#17120b] transition-transform hover:scale-[1.01]"
          >
            View all {category} <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </aside>
    </div>
  );
}
