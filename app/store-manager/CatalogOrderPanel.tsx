'use client';

import { Award, Check, ChevronDown, Gem, Heart, LayoutGrid, Loader2, Minus, Plus, Search, ShoppingCart, SlidersHorizontal, SortAsc, Trash2, X } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';

import { StoreManagerProductDetailModal, type StoreManagerProduct } from '@/components/kiosk/StoreManagerProductDetailModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StarRating } from '@/components/ui/StarRating';
import { useApi, apiPost } from '@/hooks/use-api';
import { useFavorites } from '@/hooks/use-favorites';
import { useStoreManagerKioskCart, useStoreManagerRestockCart } from '@/hooks/use-store-manager-cart';
import { subCategoriesFor } from '@/lib/categories';
import { formatWeight } from '@/lib/format';
import { useStoreManager } from './store-manager-context';

type Img = { secureUrl: string; isPrimary: boolean };
type Product = StoreManagerProduct & { images: Img[] };

// Items per row. Tailwind needs whole class names, so both scales are lookups.
// The mobile choice applies below `md`, the wide-screen choice from `md` up.
const MOBILE_COLS = { 1: 'grid-cols-1', 2: 'grid-cols-2' } as const;
const WIDE_COLS = {
  2: 'md:grid-cols-2',
  3: 'md:grid-cols-3',
  4: 'md:grid-cols-4',
  5: 'md:grid-cols-5',
} as const;
type MobileCols = keyof typeof MOBILE_COLS;
type WideCols = keyof typeof WIDE_COLS;
const COLS_STORAGE_KEY = 'jf.catalog.cols';
// Best-seller info for THIS branch, keyed by manufacturerProductId (restock only).
type SalesInfo = { stars: number; unitsLast30d: number };

/**
 * Shared catalog → cart → place-order panel used by the Store Manager's Kiosk and
 * Restock pages. No customer PII — only products, quantities and an editable note.
 */
export function CatalogOrderPanel({
  title,
  subtitle,
  placeEndpoint,
  onPlaced,
  notePlaceholder,
  showPopularity = false,
  openCartOnMount = false,
}: {
  title: string;
  subtitle: string;
  placeEndpoint: string; // e.g. /api/branch-manager/kiosk-orders
  onPlaced: (order: { orderNumber?: string }) => void;
  notePlaceholder: string;
  // Restock only: shows this branch's best-sellers (⭐ + units sold, last 30 days)
  // and offers a "Best sellers" sort so the manager restocks what's actually moving.
  showPopularity?: boolean;
  /** Opens the persisted customer cart when arriving from the global header. */
  openCartOnMount?: boolean;
}) {
  const manager = useStoreManager();
  const kioskCart = useStoreManagerKioskCart(manager.branch.id);
  const restockCart = useStoreManagerRestockCart(manager.branch.id);
  const orderCart = showPopularity ? restockCart : kioskCart;
  const { data, loading, error } = useApi<Product[]>('/api/branch-manager/catalog', '/store-manager/login');
  const favorites = useFavorites('/api/branch-manager/favorites', showPopularity ? 'RESTOCK' : 'KIOSK');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [subCategory, setSubCategory] = useState('');
  const [sort, setSort] = useState<'relevance' | 'newest' | 'name' | 'popularity'>(showPopularity ? 'popularity' : 'relevance');
  const [mobileFilters, setMobileFilters] = useState(false);
  const [showCart, setShowCart] = useState(false);
  const [showFavorites, setShowFavorites] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [detail, setDetail] = useState<Product | null>(null);
  const [placeError, setPlaceError] = useState<string | null>(null);
  const [salesMap, setSalesMap] = useState<Record<string, SalesInfo>>({});
  const [mobileCols, setMobileCols] = useState<MobileCols>(2);
  const [wideCols, setWideCols] = useState<WideCols>(4);

  useEffect(() => {
    const requestedCategory = new URLSearchParams(window.location.search).get('category');
    if (requestedCategory) setCategory(requestedCategory);
  }, []);

  // Remember the grid density across visits (per device, not per branch).
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(COLS_STORAGE_KEY) ?? 'null') as { mobile?: number; wide?: number } | null;
      if (saved?.mobile && saved.mobile in MOBILE_COLS) setMobileCols(saved.mobile as MobileCols);
      if (saved?.wide && saved.wide in WIDE_COLS) setWideCols(saved.wide as WideCols);
    } catch { /* ignore unreadable/corrupt preference */ }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(COLS_STORAGE_KEY, JSON.stringify({ mobile: mobileCols, wide: wideCols }));
    } catch { /* private mode / quota — density just won't persist */ }
  }, [mobileCols, wideCols]);

  const gridCols = `${MOBILE_COLS[mobileCols]} ${WIDE_COLS[wideCols]}`;

  useEffect(() => {
    if (openCartOnMount) setShowCart(true);
  }, [openCartOnMount]);

  useEffect(() => {
    if (!showPopularity) return;
    (async () => {
      try {
        const res = await fetch('/api/analytics/store-manager/products', { credentials: 'same-origin' });
        if (!res.ok) return;
        const json = (await res.json()) as { data?: Array<{ manufacturerProductId: string; stars: number; unitsLast30d: number }> };
        const map: Record<string, SalesInfo> = {};
        (json.data ?? []).forEach((p) => { map[p.manufacturerProductId] = { stars: p.stars, unitsLast30d: p.unitsLast30d }; });
        setSalesMap(map);
      } catch { /* non-critical — restock still works without sales data */ }
    })();
  }, [showPopularity]);

  const availableCategories = useMemo(
    () => [...new Set((data ?? []).map((product) => product.category).filter((value): value is string => Boolean(value)))].sort(),
    [data],
  );

  const filtered = useMemo(() => {
    const items = (data ?? []).filter((p) =>
      (!search || p.designNumber.toLowerCase().includes(search.toLowerCase())) &&
      (!category || p.category === category) &&
      (!subCategory || p.subCategory === subCategory),
    );
    if (sort === 'newest') return [...items].sort((a, b) => b.designNumber.localeCompare(a.designNumber));
    if (sort === 'name') return [...items].sort((a, b) => a.designNumber.localeCompare(b.designNumber));
    if (sort === 'popularity') {
      return [...items].sort((a, b) => {
        const sa = salesMap[a.id];
        const sb = salesMap[b.id];
        return (sb?.stars ?? 0) - (sa?.stars ?? 0) || (sb?.unitsLast30d ?? 0) - (sa?.unitsLast30d ?? 0);
      });
    }
    return items;
  }, [category, data, search, sort, subCategory, salesMap]);

  const cart = orderCart.items;
  const count = orderCart.count;

  function add(p: Product) {
    orderCart.add({
      productId: p.id,
      name: p.designNumber,
      designNumber: p.designNumber,
      imageUrl: (p.images.find((i) => i.isPrimary) ?? p.images[0])?.secureUrl,
    });
  }
  function setQty(id: string, qty: number) {
    orderCart.setQuantity(id, qty);
  }

  async function place() {
    setPlaceError(null);
    setPlacing(true);
    try {
      const order = (await apiPost(placeEndpoint, {
        requirementNote: orderCart.note.trim() || undefined,
        items: cart.map((l) => ({ manufacturerProductId: l.productId, quantity: l.quantity })),
      })) as { orderNumber?: string };
      orderCart.clear(); setShowCart(false);
      onPlaced(order);
    } catch (e) {
      setPlaceError(e instanceof Error ? e.message : 'Could not place order');
    } finally { setPlacing(false); }
  }

  return (
    <div className="min-h-screen">
      <section className="border-b border-black/10 bg-[#201812] text-white">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-end justify-between gap-6 px-4 py-12 md:px-6 md:py-16 lg:px-12">
          <div className="max-w-2xl">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-[#e4cf8f]">Browse</p>
            <h1 className="font-display text-4xl font-normal md:text-6xl">{title}</h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-white/68">{subtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowFavorites(true)} className="inline-flex items-center gap-2 rounded-full border border-white/25 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/10">
              <Heart className="h-4 w-4" /> Favorites ({favorites.count})
            </button>
            {showPopularity ? <button onClick={() => setShowCart(true)} className="metal-sheen inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-[#17120b] shadow-lg shadow-black/20"><ShoppingCart className="h-4 w-4" /> Order ({count})</button> : null}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1400px] px-4 py-8 md:px-6 lg:px-12">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-black/10 pb-4">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <button onClick={() => setMobileFilters((value) => !value)} className="flex items-center gap-2 rounded-lg border border-black/15 bg-white/50 px-3 py-2 text-sm lg:hidden"><SlidersHorizontal className="h-4 w-4" /> Filters</button>
            <div className="relative w-full max-w-sm"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8d8174]" /><Input placeholder="Search by design number…" value={search} onChange={(event) => setSearch(event.target.value)} className="rounded-lg border-black/15 bg-white/50 pl-9" /></div>
            <span className="hidden text-sm text-[#746b62] sm:inline">{loading ? 'Loading…' : `${filtered.length} designs`}</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Items per row — 1 or 2 on phones, 2–5 from tablet up. Each set is
                only rendered at the size it applies to, so the choice is unambiguous. */}
            <div className="flex items-center gap-1 rounded-lg border border-black/15 bg-white/50 px-1.5 py-1" role="group" aria-label="Items per row">
              <LayoutGrid className="h-4 w-4 shrink-0 text-[#8d8174]" aria-hidden />
              <span className="flex gap-0.5 md:hidden">
                {(Object.keys(MOBILE_COLS) as unknown as MobileCols[]).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setMobileCols(Number(value) as MobileCols)}
                    aria-pressed={mobileCols === Number(value)}
                    className={`h-7 w-7 rounded-md text-xs font-semibold transition-colors ${mobileCols === Number(value) ? 'bg-[#2b2119] text-white' : 'text-[#746b62] hover:bg-black/[0.05]'}`}
                  >
                    {value}
                  </button>
                ))}
              </span>
              <span className="hidden gap-0.5 md:flex">
                {(Object.keys(WIDE_COLS) as unknown as WideCols[]).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setWideCols(Number(value) as WideCols)}
                    aria-pressed={wideCols === Number(value)}
                    className={`h-7 w-7 rounded-md text-xs font-semibold transition-colors ${wideCols === Number(value) ? 'bg-[#2b2119] text-white' : 'text-[#746b62] hover:bg-black/[0.05]'}`}
                  >
                    {value}
                  </button>
                ))}
              </span>
            </div>
            <div className="relative"><SortAsc className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8d8174]" /><select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)} className="h-9 rounded-lg border border-black/15 bg-white/50 pl-9 pr-8 text-sm">{showPopularity && <option value="popularity">Best sellers</option>}<option value="relevance">Relevance</option><option value="newest">Newest first</option><option value="name">Name</option></select></div>
          </div>
        </div>

        {mobileFilters ? <div className="mb-6 rounded-lg border border-black/10 bg-[#fffdf8] p-4 lg:hidden"><CatalogFilters categories={availableCategories} category={category} subCategory={subCategory} setCategory={setCategory} setSubCategory={setSubCategory} /></div> : null}
        {error ? <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      {showCart && (
        <div className="fixed inset-0 z-[60]">
          <button onClick={() => setShowCart(false)} className="absolute inset-0 bg-black/45 backdrop-blur-sm" aria-label="Close order" />
          <div className="absolute right-0 top-0 flex h-full w-[min(94vw,440px)] flex-col bg-[#fffdf8] shadow-2xl">
            <div className="flex items-center justify-between border-b border-black/10 px-5 py-4">
              <div><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#9b762f]">Current order</p><h2 className="mt-1 font-display text-2xl">{count} item{count === 1 ? '' : 's'}</h2></div>
              <button onClick={() => setShowCart(false)} className="rounded-full p-2 hover:bg-black/5" aria-label="Close order"><X className="h-5 w-5" /></button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {cart.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center"><ShoppingCart className="h-9 w-9 text-[#b68a3e]/35" /><p className="mt-3 text-sm text-muted-foreground">Your order is empty.</p></div>
          ) : (
            <>
              <div className="space-y-2">
                {cart.map((l) => {
                  const fullProduct = (data ?? []).find((p) => p.id === l.productId);
                  return (
                    <div key={l.productId} className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => fullProduct && setDetail(fullProduct)}
                        disabled={!fullProduct}
                        className="flex min-w-0 flex-1 items-center gap-3 text-left disabled:cursor-default"
                      >
                        {l.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={l.imageUrl} alt="" className="h-12 w-12 shrink-0 rounded-lg border bg-white object-contain p-0.5" />
                        ) : <div className="h-12 w-12 shrink-0 rounded-lg border bg-muted" />}
                        <span className="min-w-0">
                          <span className={`block truncate text-sm font-medium ${fullProduct ? 'hover:text-[#b68a3e]' : ''}`}>{l.designNumber ?? l.name}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {fullProduct?.category ?? '—'}
                            {fullProduct?.subCategory ? ` › ${fullProduct.subCategory}` : ''}
                            {fullProduct?.weightGrams != null ? ` · ${fullProduct.weightGrams}g` : ''}
                          </span>
                        </span>
                      </button>
                      <div className="flex items-center gap-1">
                        <button onClick={() => setQty(l.productId, l.quantity - 1)} className="rounded border p-1"><Minus className="h-3 w-3" /></button>
                        <span className="w-8 text-center text-sm tabular-nums">{l.quantity}</span>
                        <button onClick={() => setQty(l.productId, l.quantity + 1)} className="rounded border p-1"><Plus className="h-3 w-3" /></button>
                      </div>
                      <button onClick={() => setQty(l.productId, 0)} className="text-muted-foreground hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  );
                })}
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Requirement / note (goes to Head Office)</label>
                <textarea value={orderCart.note} onChange={(e) => orderCart.setNote(e.target.value)} placeholder={notePlaceholder} className="mt-1 min-h-[90px] w-full rounded-lg border border-black/15 bg-white/60 px-3 py-2 text-sm" />
              </div>
              {placeError && <p className="text-sm text-red-600">{placeError}</p>}
              <Button onClick={place} disabled={placing} className="metal-sheen h-11 w-full rounded-full font-semibold text-[#17120b]">
                {placing ? <Loader2 className="h-4 w-4 animate-spin" /> : `Send to Head Office (${count} item${count === 1 ? '' : 's'})`}
              </Button>
            </>
          )}
            </div>
          </div>
        </div>
      )}

      {showFavorites && (
        <div className="fixed inset-0 z-[60]">
          <button onClick={() => setShowFavorites(false)} className="absolute inset-0 bg-black/45 backdrop-blur-sm" aria-label="Close favorites" />
          <div className="absolute right-0 top-0 flex h-full w-[min(94vw,440px)] flex-col bg-[#fffdf8] shadow-2xl">
            <div className="flex items-center justify-between border-b border-black/10 px-5 py-4">
              <div><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#9b762f]">Favorites</p><h2 className="mt-1 font-display text-2xl">{favorites.count} item{favorites.count === 1 ? '' : 's'}</h2></div>
              <button onClick={() => setShowFavorites(false)} className="rounded-full p-2 hover:bg-black/5" aria-label="Close favorites"><X className="h-5 w-5" /></button>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto p-5">
              {favorites.entries.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center"><Heart className="h-9 w-9 text-[#b68a3e]/35" /><p className="mt-3 text-sm text-muted-foreground">No favorites yet.</p></div>
              ) : (
                favorites.entries.map((f) => {
                  const img = f.manufacturerProduct.images.find((i) => i.isPrimary) ?? f.manufacturerProduct.images[0];
                  const inCartQty = cart.find((l) => l.productId === f.manufacturerProductId)?.quantity ?? 0;
                  const fullProduct = (data ?? []).find((p) => p.id === f.manufacturerProductId);
                  return (
                    <div key={f.id} className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => fullProduct && setDetail(fullProduct)}
                        disabled={!fullProduct}
                        className="flex min-w-0 flex-1 items-center gap-3 text-left disabled:cursor-default"
                      >
                        {img ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={img.secureUrl} alt="" className="h-12 w-12 shrink-0 rounded-lg border bg-white object-contain p-0.5" />
                        ) : <div className="h-12 w-12 shrink-0 rounded-lg border bg-muted" />}
                        <span className="min-w-0">
                          <span className={`block truncate text-sm font-medium ${fullProduct ? 'hover:text-[#b68a3e]' : ''}`}>{f.manufacturerProduct.designNumber}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {f.manufacturerProduct.category ?? '—'}
                            {f.manufacturerProduct.subCategory ? ` › ${f.manufacturerProduct.subCategory}` : ''}
                            {f.manufacturerProduct.weightGrams != null ? ` · ${f.manufacturerProduct.weightGrams}g` : ''}
                          </span>
                        </span>
                      </button>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setQty(f.manufacturerProductId, inCartQty - 1)}
                          disabled={inCartQty === 0}
                          className="rounded border p-1 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-6 text-center text-sm tabular-nums">{inCartQty}</span>
                        <button
                          onClick={() => {
                            if (inCartQty === 0) {
                              orderCart.add({ productId: f.manufacturerProductId, name: f.manufacturerProduct.designNumber, designNumber: f.manufacturerProduct.designNumber, imageUrl: img?.secureUrl });
                            } else {
                              setQty(f.manufacturerProductId, inCartQty + 1);
                            }
                          }}
                          className="rounded border p-1"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                      <button onClick={() => void favorites.toggle(f.manufacturerProductId)} className="text-muted-foreground hover:text-red-600"><Heart className="h-4 w-4 fill-red-500 text-red-500" /></button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex items-start gap-8">
        <aside className="sticky top-28 hidden w-60 shrink-0 border-r border-black/10 pr-6 lg:block">
          <CatalogFilters categories={availableCategories} category={category} subCategory={subCategory} setCategory={setCategory} setSubCategory={setSubCategory} />
        </aside>
        <div className="min-w-0 flex-1">
      {loading ? (
        <div className={`grid gap-4 md:gap-6 ${gridCols}`}>{Array.from({ length: 8 }).map((_, index) => <div key={index} className="aspect-[3/4] animate-pulse rounded-lg bg-[#ece5da]" />)}</div>
      ) : data && filtered.length > 0 ? (
        <div className={`grid gap-4 md:gap-6 ${gridCols}`}>
          {filtered.map((p) => {
            const img = p.images.find((i) => i.isPrimary) ?? p.images[0];
            const inCart = cart.some((l) => l.productId === p.id);
            return (
              <motion.article key={p.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="group">
                <button type="button" onClick={() => setDetail(p)} className="relative block aspect-[3/4] w-full overflow-hidden rounded-lg bg-[#ece5da] shadow-[0_1px_0_rgba(25,21,17,0.08)] ring-1 ring-black/5 transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-[0_18px_40px_rgba(31,24,15,0.16)]" title="View details">
                  {img ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={img.secureUrl} alt={p.designNumber} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
                  ) : <div className="flex h-full items-center justify-center text-muted-foreground/40"><Gem className="h-8 w-8" /></div>}
                  <span className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
                  {p.hasTryon && <span className="metal-sheen absolute right-3 top-3 rounded-full px-2 py-0.5 text-[10px] font-semibold text-[#17120b]">AR</span>}
                  <span
                    role="button"
                    tabIndex={-1}
                    onClick={(event) => { event.stopPropagation(); void favorites.toggle(p.id); }}
                    className="absolute left-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-black/40 backdrop-blur-sm transition-colors hover:bg-black/60"
                    aria-label={favorites.isFavorite(p.id) ? 'Remove from favorites' : 'Add to favorites'}
                  >
                    <Heart className={`h-3.5 w-3.5 ${favorites.isFavorite(p.id) ? 'fill-red-500 text-red-500' : 'text-white'}`} />
                  </span>
                  <span className="absolute bottom-3 right-3 flex items-center gap-1 rounded-full bg-[#f7fff8]/90 px-1.5 py-0.5 text-[9px] font-semibold text-[#15803d]"><Award className="h-2.5 w-2.5" /> BIS</span>
                  <span className="absolute inset-x-3 bottom-3 flex translate-y-2 gap-2 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                    <span onClick={(event) => { event.stopPropagation(); add(p); }} className="metal-sheen flex flex-1 items-center justify-center rounded-lg py-2 text-xs font-semibold text-[#17120b]"><ShoppingCart className="mr-1.5 h-3.5 w-3.5" />{inCart ? 'Add another' : 'Add to Order'}</span>
                  </span>
                </button>
                <div className="mt-3 space-y-1.5">
                  <button type="button" onClick={() => setDetail(p)} className="flex w-full items-start justify-between gap-2 text-left">
                    <p className="line-clamp-1 text-sm font-semibold text-[#211c17] hover:text-[#b68a3e]">{p.designNumber}</p>
                    {inCart ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#15803d]" /> : null}
                  </button>
                    {/* Weight gets its own non-truncating line so it stays visible
                        on narrow phone cards, where it used to be clipped first. */}
                    <p className="truncate text-xs text-muted-foreground">{p.category ? `${p.category}` : ''}{p.subCategory ? ` › ${p.subCategory}` : ''}</p>
                    {formatWeight(p.weightGrams) && <p className="text-xs font-medium text-muted-foreground">{formatWeight(p.weightGrams)}</p>}
                    {showPopularity && salesMap[p.id] ? (
                      <div className="flex items-center gap-1.5 pt-0.5">
                        <StarRating count={salesMap[p.id].stars} size="sm" />
                        <span className="text-[10px] text-muted-foreground">{salesMap[p.id].unitsLast30d} sold · 30d</span>
                      </div>
                    ) : null}
                </div>
              </motion.article>
            );
          })}
        </div>
      ) : <div className="py-20 text-center"><Gem className="mx-auto h-9 w-9 text-[#b68a3e]/35" /><p className="mt-3 text-sm text-[#746b62]">No designs match these filters.</p></div>}
        </div>
      </div>
      </div>

      {detail ? (
        <StoreManagerProductDetailModal
          key={detail.id}
          product={detail}
          products={data ?? []}
          onClose={() => setDetail(null)}
          tryOnBack={placeEndpoint.includes('b2b-orders') ? '/store-manager/restock' : '/store-manager/kiosk'}
          /* The modal stays open after adding — similar designs are listed below
             the opened one, so several can be added while scrolling. */
          primaryAction={(product) => {
            const inCart = cart.some((line) => line.productId === product.id);
            return (
              <Button onClick={() => add(product as Product)} className="metal-sheen flex-1 font-semibold text-[#17120b]">
                <Plus className="mr-1.5 h-4 w-4" />{inCart ? 'Add another' : 'Add to order'}
              </Button>
            );
          }}
        />
      ) : null}
    </div>
  );
}

function CatalogFilters({
  categories,
  category,
  subCategory,
  setCategory,
  setSubCategory,
}: {
  categories: string[];
  category: string;
  subCategory: string;
  setCategory: (value: string) => void;
  setSubCategory: (value: string) => void;
}) {
  const [categoriesOpen, setCategoriesOpen] = useState(true);
  const [subCategoriesOpen, setSubCategoriesOpen] = useState(true);
  const subCategories = subCategoriesFor(category);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between border-b border-black/10 pb-3">
        <span className="text-sm font-semibold">Filters</span>
        {(category || subCategory) ? <button onClick={() => { setCategory(''); setSubCategory(''); }} className="text-xs font-medium text-[#b68a3e] hover:underline">Clear all</button> : null}
      </div>
      <button onClick={() => setCategoriesOpen((value) => !value)} className="flex w-full items-center justify-between py-3 text-sm font-semibold">Category <ChevronDown className={`h-4 w-4 text-[#8d8174] transition-transform ${categoriesOpen ? 'rotate-180' : ''}`} /></button>
      {categoriesOpen ? (
        <div className="space-y-1 pb-4">
          <button onClick={() => { setCategory(''); setSubCategory(''); }} className={`block w-full rounded-md px-2 py-1.5 text-left text-sm ${!category ? 'bg-[#efe6d6] font-medium text-[#8f6a27]' : 'text-[#746b62] hover:bg-black/[0.03]'}`}>All categories</button>
          {categories.map((value) => <button key={value} onClick={() => { setCategory(value); setSubCategory(''); }} className={`block w-full rounded-md px-2 py-1.5 text-left text-sm ${category === value ? 'bg-[#efe6d6] font-medium text-[#8f6a27]' : 'text-[#746b62] hover:bg-black/[0.03]'}`}>{value}</button>)}
        </div>
      ) : null}
      {subCategories.length > 0 ? (
        <div className="border-t border-black/10">
          <button onClick={() => setSubCategoriesOpen((value) => !value)} className="flex w-full items-center justify-between py-3 text-sm font-semibold">Sub-category <ChevronDown className={`h-4 w-4 text-[#8d8174] transition-transform ${subCategoriesOpen ? 'rotate-180' : ''}`} /></button>
          {subCategoriesOpen ? <div className="space-y-1 pb-4"><button onClick={() => setSubCategory('')} className={`block w-full rounded-md px-2 py-1.5 text-left text-sm ${!subCategory ? 'bg-[#efe6d6] font-medium text-[#8f6a27]' : 'text-[#746b62] hover:bg-black/[0.03]'}`}>All</button>{subCategories.map((value) => <button key={value} onClick={() => setSubCategory(value)} className={`block w-full rounded-md px-2 py-1.5 text-left text-sm ${subCategory === value ? 'bg-[#efe6d6] font-medium text-[#8f6a27]' : 'text-[#746b62] hover:bg-black/[0.03]'}`}>{value}</button>)}</div> : null}
        </div>
      ) : null}
    </div>
  );
}
