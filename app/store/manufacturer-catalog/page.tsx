'use client';

import { Loader2, Gem, Heart, ShoppingCart, Minus, Plus, Trash2, Sparkles } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

import { StoreManagerProductDetailModal } from '@/components/kiosk/StoreManagerProductDetailModal';
import { CartQtyControl } from '@/components/orders/CartQtyControl';
import { ItemsPerRowControl } from '@/components/orders/ItemsPerRowControl';
import { WeightRangeSlider } from '@/components/orders/WeightRangeSlider';
import { Button } from '@/components/ui/button';
import { FieldError } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { StarRating } from '@/components/ui/StarRating';
import { useApi, apiPost } from '@/hooks/use-api';
import { useB2bCart } from '@/hooks/use-b2b-cart';
import { useFavorites } from '@/hooks/use-favorites';
import { CATEGORIES, PURITIES, subCategoriesFor } from '@/lib/categories';
import { fieldError, toFieldErrors } from '@/lib/field-error';
import { formatWeight } from '@/lib/format';
import { matchesDescriptionQuery, rankSimilar } from '@/lib/product-similarity';
import { SORT_OPTIONS, weightExtent, matchWeightRange, sortProducts, type SortOption } from '@/lib/weight-filter';

type Img = { secureUrl: string; isPrimary: boolean };
type Product = { id: string; designNumber: string; name?: string | null; category: string | null; subCategory: string | null; purity: string | null; weightGrams: string | null; size?: string | null; description?: string | null; hasTryon: boolean; images: Img[] };
// Sales info across ALL of this retailer's branches, keyed by manufacturerProductId.
type SalesInfo = { stars: number; unitsLast30d: number };

// Items per row. Tailwind needs whole class names, so both scales are lookups.
// Mobile gets the full 1-4 range (below `sm`) — previously the control offered
// 2-4 everywhere, but every option's class was `sm:`-prefixed, so picking 3 or
// 4 on a phone silently did nothing below that breakpoint.
const MOBILE_COLS = {
  1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4',
} as const;
const WIDE_COLS = {
  1: 'sm:grid-cols-1 lg:grid-cols-1',
  2: 'sm:grid-cols-2 lg:grid-cols-2',
  3: 'sm:grid-cols-3 lg:grid-cols-3',
  4: 'sm:grid-cols-3 lg:grid-cols-4',
} as const;
type MobileCols = keyof typeof MOBILE_COLS;
type WideCols = keyof typeof WIDE_COLS;
const COLS_STORAGE_KEY = 'jf.retailer-catalog.cols';

// useSearchParams needs a Suspense boundary in the App Router.
export default function ManufacturerCatalogBrowsePage() {
  return (
    <Suspense fallback={<div className="flex items-center gap-2 py-16 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>}>
      <CatalogBrowse />
    </Suspense>
  );
}

function CatalogBrowse() {
  const { data, error, loading } = useApi<Product[]>('/api/store/catalog', '/store/login');
  const cart = useB2bCart();
  const favorites = useFavorites('/api/store/favorites');
  const router = useRouter();
  // Seeded from the URL so /store/home category tiles can deep-link into a
  // pre-filtered catalog (?category=Bangles&subCategory=Fusion%20Bangle).
  const params = useSearchParams();
  const [search, setSearch] = useState('');
  const [descQuery, setDescQuery] = useState('');
  const [category, setCategory] = useState(params.get('category') ?? '');
  const [subCategory, setSubCategory] = useState(params.get('subCategory') ?? '');
  const [size, setSize] = useState('');
  const [weightRange, setWeightRange] = useState<[number, number] | null>(null);
  const [sort, setSort] = useState<SortOption>('');
  // ?open=cart|favorites lets the layout's header buttons (visible on every
  // /store/* page, not just this one) jump straight here with the right panel open.
  const [showCart, setShowCart] = useState(params.get('open') === 'cart');
  const [showFavorites, setShowFavorites] = useState(params.get('open') === 'favorites');
  const [notes, setNotes] = useState('');
  const [placing, setPlacing] = useState(false);
  const [submitErr, setSubmitErr] = useState<unknown>(null);
  const [salesMap, setSalesMap] = useState<Record<string, SalesInfo>>({});
  const [detail, setDetail] = useState<Product | null>(null);
  const [mobileCols, setMobileCols] = useState<MobileCols>(2);
  const [wideCols, setWideCols] = useState<WideCols>(4);

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

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/analytics/store/products', { credentials: 'same-origin' });
        if (!res.ok) return;
        const json = (await res.json()) as { data?: Array<{ manufacturerProductId: string; stars: number; unitsLast30d: number }> };
        const map: Record<string, SalesInfo> = {};
        (json.data ?? []).forEach((p) => { map[p.manufacturerProductId] = { stars: p.stars, unitsLast30d: p.unitsLast30d }; });
        setSalesMap(map);
      } catch { /* non-critical — catalog still works without sales data */ }
    })();
  }, []);

  // Everything except the weight band, so the bands below describe the set the
  // retailer is actually looking at (Bangles run 10-100 g, pendants 1-8 g — one
  // fixed range would leave most options empty).
  const preWeight = (data ?? []).filter((p) => {
    const matchSearch = !search || p.designNumber.toLowerCase().includes(search.toLowerCase());
    const matchDesc = matchesDescriptionQuery(p, descQuery);
    const matchCat = !category || p.category === category;
    const matchSub = !subCategory || p.subCategory === subCategory;
    const matchSize = !size || p.size === size;
    return matchSearch && matchDesc && matchCat && matchSub && matchSize;
  });

  const weightBounds = weightExtent(preWeight.map((p) => p.weightGrams));
  const filtered = sortProducts(
    preWeight.filter((p) => matchWeightRange(p.weightGrams, weightRange)),
    sort,
    (p) => p.designNumber,
    (p) => p.weightGrams,
  );

  const sizeOptions = Array.from(
    new Set((data ?? []).map((p) => p.size).filter((s): s is string => !!s)),
  ).sort();

  async function placeOrder() {
    setPlacing(true);
    setSubmitErr(null);
    try {
      const order = (await apiPost('/api/store/orders', {
        notes: notes || undefined,
        items: cart.items.map((i) => ({ manufacturerProductId: i.productId, quantity: i.quantity, purity: i.purity || undefined })),
      })) as { id: string };
      cart.clear();
      router.push(`/store/b2b-orders`);
      void order;
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not place order');
      setSubmitErr(e);
    } finally { setPlacing(false); }
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-medium tracking-tight">Product Catalogue</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Browse designs and place a restock order.</p>
        </div>
        {/* Description search — a looser match than the design-number box below
            (category/sub-category/description text, not just the exact design
            number) so "gold necklace" or "antique" surfaces pieces that box
            can't. Sits above the design-number search on mobile (its own row,
            full width) and between the heading and Favorites/Cart on desktop. */}
        <div className="order-first w-full sm:order-none sm:w-auto sm:max-w-xs sm:flex-1">
          <Input
            placeholder="Search by description, category…"
            value={descQuery}
            onChange={(e) => setDescQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => { setShowFavorites((v) => !v); setShowCart(false); }}>
            <Heart className="mr-1.5 h-4 w-4" />Favorites ({favorites.count})
          </Button>
          <Button variant="outline" onClick={() => { setShowCart((v) => !v); setShowFavorites(false); }}>
            <ShoppingCart className="mr-1.5 h-4 w-4" />Cart ({cart.count})
          </Button>
        </div>
      </div>

      {!showCart && !showFavorites && (
        <>
          <div className="flex flex-wrap gap-2">
            <Input placeholder="Search designs…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
            <select className="h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={category} onChange={(e) => { setCategory(e.target.value); setSubCategory(''); }}>
              <option value="">All categories</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            {subCategoriesFor(category).length > 0 && (
              <select className="h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={subCategory} onChange={(e) => setSubCategory(e.target.value)}>
                <option value="">All sub-categories</option>
                {subCategoriesFor(category).map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            )}
            {sizeOptions.length > 0 && (
              <select className="h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={size} onChange={(e) => setSize(e.target.value)} aria-label="Filter by size">
                <option value="">All sizes</option>
                {sizeOptions.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            )}
            <select className="h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={sort} onChange={(e) => setSort(e.target.value as SortOption)} aria-label="Sort by">
              {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {(category || subCategory || search || descQuery || size || sort || weightRange) && (
              <button type="button" onClick={() => { setSearch(''); setDescQuery(''); setCategory(''); setSubCategory(''); setSize(''); setWeightRange(null); setSort(''); }} className="text-xs text-muted-foreground hover:text-foreground">Clear</button>
            )}
            {/* Items per row — 1 or 2 on phones, 2–4 from tablet up. Each set is
                only rendered at the size it applies to, so the choice is unambiguous. */}
            <span className="sm:hidden">
              <ItemsPerRowControl value={mobileCols} onChange={(v) => setMobileCols(v as MobileCols)} min={1} max={4} />
            </span>
            <span className="hidden sm:inline-flex">
              <ItemsPerRowControl value={wideCols} onChange={(v) => setWideCols(v as WideCols)} min={2} max={4} />
            </span>
          </div>

          {weightBounds && (
            <div className="max-w-xs rounded-lg border bg-card p-3">
              <WeightRangeSlider extent={weightBounds} value={weightRange} onChange={setWeightRange} />
            </div>
          )}
        </>
      )}

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {loading && <div className="flex items-center gap-2 py-12 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>}

      {showFavorites && (
        <div className="rounded-xl border bg-card p-4 space-y-3">
          <h2 className="text-sm font-semibold">Your Favorites</h2>
          {favorites.entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No favorites yet.</p>
          ) : (
            <div className="space-y-2">
              {favorites.entries.map((f) => {
                const img = f.manufacturerProduct.images.find((i) => i.isPrimary) ?? f.manufacturerProduct.images[0];
                const inCartQty = cart.items.find((i) => i.productId === f.manufacturerProductId)?.quantity ?? 0;
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
                        <span className={`block truncate text-sm ${fullProduct ? 'hover:text-primary' : ''}`}>{f.manufacturerProduct.designNumber}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {f.manufacturerProduct.category ?? '—'}
                          {f.manufacturerProduct.subCategory ? ` › ${f.manufacturerProduct.subCategory}` : ''}
                        </span>
                        {(formatWeight(f.manufacturerProduct.weightGrams) || f.manufacturerProduct.size) && (
                          <span className="block text-xs font-medium text-muted-foreground">
                            {formatWeight(f.manufacturerProduct.weightGrams)}
                            {formatWeight(f.manufacturerProduct.weightGrams) && f.manufacturerProduct.size ? ' · ' : ''}
                            {f.manufacturerProduct.size ? `Size ${f.manufacturerProduct.size}` : ''}
                          </span>
                        )}
                      </span>
                    </button>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => (inCartQty <= 1 ? cart.remove(f.manufacturerProductId) : cart.setQty(f.manufacturerProductId, inCartQty - 1))}
                        disabled={inCartQty === 0}
                        className="rounded border p-1 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-6 text-center text-sm tabular-nums">{inCartQty}</span>
                      <button
                        onClick={() => {
                          if (inCartQty === 0) {
                            cart.add({ productId: f.manufacturerProductId, name: f.manufacturerProduct.designNumber, designNumber: f.manufacturerProduct.designNumber, imageUrl: img?.secureUrl, purity: f.manufacturerProduct.purity ?? undefined });
                          } else {
                            cart.setQty(f.manufacturerProductId, inCartQty + 1);
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
              })}
            </div>
          )}
        </div>
      )}

      {showCart && (
        <div className="rounded-xl border bg-card p-4 space-y-3">
          <h2 className="text-sm font-semibold">Your Catalogue Cart</h2>
          {cart.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Cart is empty.</p>
          ) : (
            <>
              {/* Column header for the steppers — without it the bare numbers
                  read as a count of something unspecified. */}
              <div className="flex items-center justify-end gap-3 pr-7 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                <span className="w-[104px] text-center">Qty</span>
              </div>
              <div className="space-y-2">
                {cart.items.map((i) => {
                  const fullProduct = (data ?? []).find((p) => p.id === i.productId);
                  return (
                    <div key={i.productId} className="space-y-1.5">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => fullProduct && setDetail(fullProduct)}
                          disabled={!fullProduct}
                          className="flex min-w-0 flex-1 items-center gap-3 text-left disabled:cursor-default"
                        >
                          {i.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={i.imageUrl} alt="" className="h-16 w-16 shrink-0 rounded-lg border bg-white object-contain p-0.5" />
                          ) : <div className="h-16 w-16 shrink-0 rounded-lg border bg-muted" />}
                          <span className="min-w-0">
                            <span className={`block truncate text-base font-medium ${fullProduct ? 'hover:text-primary' : ''}`}>{i.name}</span>
                            <span className="block truncate text-sm text-muted-foreground">
                              {fullProduct?.category ?? '—'}
                              {fullProduct?.subCategory ? ` › ${fullProduct.subCategory}` : ''}
                            </span>
                            {(formatWeight(fullProduct?.weightGrams) || fullProduct?.size) && (
                              <span className="block text-sm font-medium text-muted-foreground">
                                {formatWeight(fullProduct?.weightGrams)}
                                {formatWeight(fullProduct?.weightGrams) && fullProduct?.size ? ' · ' : ''}
                                {fullProduct?.size ? `Size ${fullProduct.size}` : ''}
                              </span>
                            )}
                          </span>
                        </button>
                        <div className="flex w-[104px] shrink-0 items-center justify-center gap-1">
                          <button onClick={() => (i.quantity <= 1 ? cart.remove(i.productId) : cart.setQty(i.productId, i.quantity - 1))} aria-label="One less" className="rounded border p-1"><Minus className="h-3 w-3" /></button>
                          <span className="w-8 text-center text-sm tabular-nums">{i.quantity}</span>
                          <button onClick={() => cart.setQty(i.productId, i.quantity + 1)} aria-label="One more" className="rounded border p-1"><Plus className="h-3 w-3" /></button>
                        </div>
                        <button onClick={() => cart.remove(i.productId)} className="text-muted-foreground hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                      </div>
                      {/* Melting/purity — defaults to the product's own purity but
                          overridable per line, travels with the order. */}
                      <div className="flex items-center gap-2 pl-[76px]">
                        <span className="text-[11px] text-muted-foreground">Melting/Purity:</span>
                        <select
                          value={i.purity ?? ''}
                          onChange={(e) => cart.setPurity(i.productId, e.target.value)}
                          className="h-7 rounded-md border border-input bg-transparent px-2 text-xs"
                        >
                          <option value="">—</option>
                          {PURITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>

              <textarea placeholder="Notes for manufacturer (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm min-h-[60px]" />
              <FieldError errors={toFieldErrors(fieldError(submitErr, 'notes'))} />
              <p className="text-xs text-muted-foreground">Ships to your fixed store address.</p>
              <Button onClick={placeOrder} disabled={placing} className="metal-sheen text-[#17120b] font-semibold w-full">
                {placing ? <Loader2 className="h-4 w-4 animate-spin" /> : `Place order (${cart.count} item(s))`}
              </Button>
            </>
          )}
        </div>
      )}

      {/* Normal catalogue grid — hidden while Cart or Favorites is open, since
          that's not what's on screen there (the "You may also like" grid
          below takes this exact spot instead when the cart is open). */}
      {!showCart && !showFavorites && data && filtered.length > 0 && (
        <ProductGrid products={filtered} cart={cart} favorites={favorites} salesMap={salesMap} cols={`${MOBILE_COLS[mobileCols]} ${WIDE_COLS[wideCols]}`} onOpen={setDetail} />
      )}

      {/* "You may also like" — one group per unique cart line, ranked by
          category > purity rather than an exact-match filter (a strict AND
          went empty far too often on a real catalogue). Sits where the
          catalogue grid normally does, using the same card style, rather
          than a small strip inside the cart card. */}
      {showCart && cart.items.length > 0 && (() => {
        const seen = new Set<string>();
        const groups = cart.items
          .map((i) => (data ?? []).find((p) => p.id === i.productId))
          .filter((p): p is Product => !!p)
          .map((fullProduct) => ({
            fullProduct,
            similar: rankSimilar(fullProduct, data ?? [], 4).filter((p) => {
              if (cart.items.some((line) => line.productId === p.id)) return false;
              if (seen.has(p.id)) return false;
              seen.add(p.id);
              return true;
            }),
          }))
          .filter((g) => g.similar.length > 0);

        // Below that: the FULL, unfiltered catalogue for every category
        // represented in the cart — one section per unique category, not
        // capped to a handful of "similar" picks.
        const cartCategories = Array.from(new Set(
          cart.items
            .map((i) => (data ?? []).find((p) => p.id === i.productId)?.category)
            .filter((c): c is string => !!c),
        ));
        const categoryGroups = cartCategories.map((category) => ({
          category,
          items: (data ?? []).filter((p) => p.category === category),
        })).filter((g) => g.items.length > 0);

        if (groups.length === 0 && categoryGroups.length === 0) return null;
        return (
          <div className="space-y-8">
            {groups.length > 0 && (
              <div className="space-y-6">
                {groups.map(({ fullProduct, similar }) => (
                  <div key={`similar-${fullProduct.id}`} className="space-y-3">
                    <h2 className="text-sm font-semibold">You may also like — like {fullProduct.designNumber}</h2>
                    <ProductGrid products={similar} cart={cart} favorites={favorites} salesMap={salesMap} cols={`${MOBILE_COLS[mobileCols]} ${WIDE_COLS[wideCols]}`} onOpen={setDetail} />
                  </div>
                ))}
              </div>
            )}
            {categoryGroups.length > 0 && (
              <div className="space-y-6">
                {categoryGroups.map(({ category, items }) => (
                  <div key={`category-${category}`} className="space-y-3">
                    <h2 className="text-sm font-semibold">More from {category}</h2>
                    <ProductGrid products={items} cart={cart} favorites={favorites} salesMap={salesMap} cols={`${MOBILE_COLS[mobileCols]} ${WIDE_COLS[wideCols]}`} onOpen={setDetail} />
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {detail ? (
        <StoreManagerProductDetailModal
          key={detail.id}
          product={detail}
          products={data ?? []}
          onClose={() => setDetail(null)}
          tryOnBack="/store/manufacturer-catalog"
          /* The popup stays open on add — similar designs are listed below it,
             so several can be added (and adjusted) while scrolling. */
          primaryAction={(product) => {
            const quantity = cart.items.find((i) => i.productId === product.id)?.quantity ?? 0;
            const img = product.images.find((i) => i.isPrimary) ?? product.images[0];
            return (
              <CartQtyControl
                className="flex-1"
                designNumber={product.designNumber}
                quantity={quantity}
                onAdd={() => cart.add({ productId: product.id, name: product.designNumber, designNumber: product.designNumber, imageUrl: img?.secureUrl, purity: product.purity ?? undefined })}
                onSetQuantity={(next) => (next <= 0 ? cart.remove(product.id) : cart.setQty(product.id, next))}
              />
            );
          }}
        />
      ) : null}
    </div>
  );
}

/** Shared card grid — used for the normal catalogue browse AND for "You may
 *  also like" (which takes this exact spot when the cart is open), so both
 *  look identical: same card, same Add-to-cart control, same info shown. */
function ProductGrid({
  products, cart, favorites, salesMap, cols, onOpen,
}: {
  products: Product[];
  cart: ReturnType<typeof useB2bCart>;
  favorites: ReturnType<typeof useFavorites>;
  salesMap: Record<string, SalesInfo>;
  cols: string;
  onOpen: (product: Product) => void;
}) {
  return (
    <div className={`grid gap-4 ${cols}`}>
      {products.map((p) => {
        const img = p.images.find((i) => i.isPrimary) ?? p.images[0];
        const inCartQty = cart.items.find((i) => i.productId === p.id)?.quantity ?? 0;
        return (
          <div key={p.id} className="overflow-hidden rounded-xl border bg-card">
            <button type="button" onClick={() => onOpen(p)} className="relative block aspect-[3/4] w-full bg-[#ece5da]" title="View details">
              {img ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={img.secureUrl} alt={p.designNumber} className="h-full w-full object-cover" />
              ) : <div className="flex h-full items-center justify-center text-muted-foreground/40"><Gem className="h-8 w-8" /></div>}
              {p.hasTryon && <span className="metal-sheen absolute right-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold text-[#17120b]"><Sparkles className="mr-0.5 inline h-2.5 w-2.5" />AR</span>}
              <span
                role="button"
                tabIndex={-1}
                onClick={(e) => { e.stopPropagation(); void favorites.toggle(p.id); }}
                className="absolute left-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/40 backdrop-blur-sm transition-colors hover:bg-black/60"
                aria-label={favorites.isFavorite(p.id) ? 'Remove from favorites' : 'Add to favorites'}
              >
                <Heart className={`h-3.5 w-3.5 ${favorites.isFavorite(p.id) ? 'fill-red-500 text-red-500' : 'text-white'}`} />
              </span>
            </button>
            <div className="p-3 space-y-2">
              <button type="button" onClick={() => onOpen(p)} className="block w-full text-left">
                <p className="truncate text-sm font-medium hover:text-primary">{p.designNumber}</p>
                {/* Weight on its own non-truncating line so narrow phone
                    cards can't clip it (it was last on one truncated line). */}
                <p className="truncate text-xs text-muted-foreground">
                  {p.category ? `${p.category}` : ''}{p.subCategory ? ` › ${p.subCategory}` : ''}
                </p>
                {formatWeight(p.weightGrams) && <p className="text-xs font-medium text-muted-foreground">{formatWeight(p.weightGrams)}{p.size ? ` · Size ${p.size}` : ''}</p>}
                {salesMap[p.id] ? (
                  <div className="mt-1 flex items-center gap-1.5">
                    <StarRating count={salesMap[p.id].stars} size="sm" />
                    <span className="text-[10px] text-muted-foreground">{salesMap[p.id].unitsLast30d} sold · 30d</span>
                  </div>
                ) : null}
              </button>
              <CartQtyControl
                size="sm"
                designNumber={p.designNumber}
                quantity={inCartQty}
                onAdd={() => cart.add({ productId: p.id, name: p.designNumber, designNumber: p.designNumber, imageUrl: img?.secureUrl, purity: p.purity ?? undefined })}
                onSetQuantity={(quantity) => (quantity <= 0 ? cart.remove(p.id) : cart.setQty(p.id, quantity))}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
