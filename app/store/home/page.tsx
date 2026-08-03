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

  const products = useMemo(() => (data ?? []).filter((p) => primaryImage(p)), [data]);

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

  // Show categories that actually have stock first, but keep the rest visible
  // so the retailer can see the full range on offer.
  const orderedCategories = useMemo(() => {
    const withStock = CATEGORIES.filter((c) => coverByCategory[c]);
    const withoutStock = CATEGORIES.filter((c) => !coverByCategory[c]);
    return [...withStock, ...withoutStock];
  }, [coverByCategory]);

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
            categories={orderedCategories}
            coverByCategory={coverByCategory}
            onSelect={handleCategoryClick}
          />
        </>
      )}

      {openCategory && (
        <SubCategoryPanel
          category={openCategory}
          cover={coverByCategory[openCategory]}
          onPick={(sub) => openCatalog(openCategory, sub)}
          onViewAll={() => openCatalog(openCategory)}
          onClose={() => setOpenCategory(null)}
        />
      )}
    </div>
  );
}

/** Edge-to-edge auto-scrolling strip of real catalogue photos; each is clickable. */
function CatalogueStrip({ products }: { products: Product[] }) {
  if (products.length === 0) return null;
  // Duplicated once so the -50% translate loops seamlessly (see globals.css).
  const reel = [...products, ...products];

  return (
    <section aria-label="Catalogue highlights">
      <div className="group relative overflow-hidden rounded-2xl border border-[#e8e0d2] bg-[#faf7f1]">
        {/* Fade the edges so items enter and leave softly. */}
        <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-[#faf7f1] to-transparent sm:w-20" />
        <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-[#faf7f1] to-transparent sm:w-20" />

        <div className="jf-marquee-track flex gap-3 p-3 sm:gap-4 sm:p-4">
          {reel.map((p, i) => (
            <Link
              key={`${p.id}-${i}`}
              href={`/store/manufacturer-catalog?category=${encodeURIComponent(p.category ?? '')}`}
              // The duplicate half is decorative — keep it out of the tab order
              // and off the accessibility tree so nothing is announced twice.
              aria-hidden={i >= products.length}
              tabIndex={i >= products.length ? -1 : undefined}
              className="group/card relative block h-44 w-36 shrink-0 overflow-hidden rounded-xl bg-white ring-1 ring-black/5 transition-shadow hover:shadow-[0_10px_30px_rgba(31,24,15,0.16)] sm:h-56 sm:w-48 lg:h-64 lg:w-56"
              title={p.designNumber}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={primaryImage(p)!}
                alt={p.designNumber}
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-500 group-hover/card:scale-105"
              />
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent px-2.5 pb-2 pt-6 text-[11px] font-semibold tabular-nums text-white sm:text-xs">
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
 * Asymmetric mosaic. A repeating 6-column rhythm gives a deliberately uneven,
 * editorial layout instead of a uniform grid: a wide hero, two narrower tiles,
 * then a mirrored row. Below `sm` it collapses to a single column so the
 * pattern can't squeeze tiles into unreadable slivers.
 */
function CategoryMosaic({
  categories, coverByCategory, onSelect,
}: {
  categories: string[];
  coverByCategory: Record<string, string>;
  onSelect: (category: string) => void;
}) {
  // A repeating 6-tile rhythm over a 6-column grid, in three tidy rows:
  //   row 1 — wide 4 + narrow 2
  //   row 2 — narrow 2 + wide 4   (mirrored, so the layout never looks striped)
  //   row 3 — even 3 + 3
  //
  // Height comes from fixed row heights, NOT per-tile aspect ratios: grid rows
  // size to their tallest child, so mixing a 21/9 tile with a 3/4 tile in one
  // row left a large hole under the short one. Fixed heights keep every row
  // flush while the differing widths still give the asymmetric, editorial feel.
  const RHYTHM = [
    { span: 'sm:col-span-4', height: 'h-56 sm:h-64' },
    { span: 'sm:col-span-2', height: 'h-56 sm:h-64' },
    { span: 'sm:col-span-2', height: 'h-56 sm:h-72' },
    { span: 'sm:col-span-4', height: 'h-56 sm:h-72' },
    { span: 'sm:col-span-3', height: 'h-56 sm:h-60' },
    { span: 'sm:col-span-3', height: 'h-56 sm:h-60' },
  ];

  return (
    <section aria-label="Categories" className="space-y-4">
      <h2 className="font-display text-xl font-semibold tracking-tight">Categories</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-6 sm:gap-4">
        {categories.map((category, i) => {
          const { span, height } = RHYTHM[i % RHYTHM.length]!;
          const cover = coverByCategory[category];
          const subs = subCategoriesFor(category);

          return (
            <button
              key={category}
              type="button"
              onClick={() => onSelect(category)}
              className={`group relative ${span} ${height} overflow-hidden rounded-2xl bg-[#efe7da] text-left ring-1 ring-black/5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_20px_44px_rgba(31,24,15,0.18)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9a84c]`}
            >
              {cover ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={cover}
                  alt=""
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.06]"
                />
              ) : (
                <span aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(201,168,76,0.28),transparent_60%)]" />
              )}

              {/* Scrim keeps the label readable over any photo. */}
              <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/72 via-black/25 to-transparent" />

              <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4 sm:p-5">
                <span className="min-w-0">
                  <span className="block font-display text-lg font-semibold leading-tight text-white drop-shadow-sm sm:text-xl">
                    {category}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-white/70">
                    {subs.length > 0 ? `${subs.length} collections` : 'View designs'}
                  </span>
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
  category, cover, onPick, onViewAll, onClose,
}: {
  category: string;
  cover?: string;
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
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          <div className="grid grid-cols-2 gap-2.5">
            {subs.map((sub) => (
              <button
                key={sub}
                type="button"
                onClick={() => onPick(sub)}
                className="group flex min-h-[62px] items-center justify-between gap-2 rounded-xl border border-[#e8e0d2] bg-white px-3 py-2.5 text-left text-sm font-medium text-[#37302a] transition-all hover:-translate-y-0.5 hover:border-[#c9a84c] hover:shadow-[0_8px_20px_rgba(31,24,15,0.1)]"
              >
                <span className="min-w-0 leading-snug">{sub}</span>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[#b39244] opacity-0 transition-opacity group-hover:opacity-100" />
              </button>
            ))}
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
