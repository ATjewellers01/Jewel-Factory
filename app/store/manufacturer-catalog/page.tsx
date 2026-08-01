'use client';

import { Loader2, Gem, Heart, ShoppingCart, Check, Minus, Plus, Trash2, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { StoreManagerProductDetailModal } from '@/components/kiosk/StoreManagerProductDetailModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StarRating } from '@/components/ui/StarRating';
import { useApi, apiPost } from '@/hooks/use-api';
import { useB2bCart } from '@/hooks/use-b2b-cart';
import { useFavorites } from '@/hooks/use-favorites';
import { CATEGORIES, subCategoriesFor } from '@/lib/categories';
import { formatWeight } from '@/lib/format';

type Img = { secureUrl: string; isPrimary: boolean };
type Product = { id: string; designNumber: string; name?: string | null; category: string | null; subCategory: string | null; purity: string | null; weightGrams: string | null; description?: string | null; hasTryon: boolean; images: Img[] };
// Sales info across ALL of this retailer's branches, keyed by manufacturerProductId.
type SalesInfo = { stars: number; unitsLast30d: number };

export default function ManufacturerCatalogBrowsePage() {
  const { data, error, loading } = useApi<Product[]>('/api/store/catalog', '/store/login');
  const cart = useB2bCart();
  const favorites = useFavorites('/api/store/favorites');
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [subCategory, setSubCategory] = useState('');
  const [showCart, setShowCart] = useState(false);
  const [showFavorites, setShowFavorites] = useState(false);
  const [notes, setNotes] = useState('');
  const [placing, setPlacing] = useState(false);
  const [salesMap, setSalesMap] = useState<Record<string, SalesInfo>>({});
  const [detail, setDetail] = useState<Product | null>(null);

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

  const filtered = (data ?? []).filter((p) => {
    const matchSearch = !search || p.designNumber.toLowerCase().includes(search.toLowerCase());
    const matchCat = !category || p.category === category;
    const matchSub = !subCategory || p.subCategory === subCategory;
    return matchSearch && matchCat && matchSub;
  });

  async function placeOrder() {
    setPlacing(true);
    try {
      const order = (await apiPost('/api/store/orders', {
        notes: notes || undefined,
        items: cart.items.map((i) => ({ manufacturerProductId: i.productId, quantity: i.quantity })),
      })) as { id: string };
      cart.clear();
      router.push(`/store/b2b-orders`);
      void order;
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not place order');
    } finally { setPlacing(false); }
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-medium tracking-tight">Manufacturer Catalog</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Browse designs and place a restock order.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowFavorites((v) => !v)}>
            <Heart className="mr-1.5 h-4 w-4" />Favorites ({favorites.count})
          </Button>
          <Button variant="outline" onClick={() => setShowCart((v) => !v)}>
            <ShoppingCart className="mr-1.5 h-4 w-4" />Cart ({cart.count})
          </Button>
        </div>
      </div>

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
        {(category || subCategory || search) && (
          <button type="button" onClick={() => { setSearch(''); setCategory(''); setSubCategory(''); }} className="text-xs text-muted-foreground hover:text-foreground">Clear</button>
        )}
      </div>

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
                          {f.manufacturerProduct.weightGrams != null ? ` · ${f.manufacturerProduct.weightGrams}g` : ''}
                        </span>
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
                            cart.add({ productId: f.manufacturerProductId, name: f.manufacturerProduct.designNumber, designNumber: f.manufacturerProduct.designNumber, imageUrl: img?.secureUrl });
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
          <h2 className="text-sm font-semibold">Your Catalog Cart</h2>
          {cart.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Cart is empty.</p>
          ) : (
            <>
              <div className="space-y-2">
                {cart.items.map((i) => {
                  const fullProduct = (data ?? []).find((p) => p.id === i.productId);
                  return (
                    <div key={i.productId} className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => fullProduct && setDetail(fullProduct)}
                        disabled={!fullProduct}
                        className="flex min-w-0 flex-1 items-center gap-3 text-left disabled:cursor-default"
                      >
                        {i.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={i.imageUrl} alt="" className="h-12 w-12 shrink-0 rounded-lg border bg-white object-contain p-0.5" />
                        ) : <div className="h-12 w-12 shrink-0 rounded-lg border bg-muted" />}
                        <span className="min-w-0">
                          <span className={`block truncate text-sm ${fullProduct ? 'hover:text-primary' : ''}`}>{i.name}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {fullProduct?.category ?? '—'}
                            {fullProduct?.subCategory ? ` › ${fullProduct.subCategory}` : ''}
                            {fullProduct?.weightGrams != null ? ` · ${fullProduct.weightGrams}g` : ''}
                          </span>
                        </span>
                      </button>
                      <div className="flex items-center gap-1">
                        <button onClick={() => (i.quantity <= 1 ? cart.remove(i.productId) : cart.setQty(i.productId, i.quantity - 1))} className="rounded border p-1"><Minus className="h-3 w-3" /></button>
                        <span className="w-8 text-center text-sm tabular-nums">{i.quantity}</span>
                        <button onClick={() => cart.setQty(i.productId, i.quantity + 1)} className="rounded border p-1"><Plus className="h-3 w-3" /></button>
                      </div>
                      <button onClick={() => cart.remove(i.productId)} className="text-muted-foreground hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  );
                })}
              </div>
              <textarea placeholder="Notes for manufacturer (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm min-h-[60px]" />
              <p className="text-xs text-muted-foreground">Ships to your fixed store address.</p>
              <Button onClick={placeOrder} disabled={placing} className="metal-sheen text-[#17120b] font-semibold w-full">
                {placing ? <Loader2 className="h-4 w-4 animate-spin" /> : `Place order (${cart.count} item(s))`}
              </Button>
            </>
          )}
        </div>
      )}

      {data && filtered.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((p) => {
            const img = p.images.find((i) => i.isPrimary) ?? p.images[0];
            const inCart = cart.items.some((i) => i.productId === p.id);
            return (
              <div key={p.id} className="overflow-hidden rounded-xl border bg-card">
                <button type="button" onClick={() => setDetail(p)} className="relative block aspect-[3/4] w-full bg-[#ece5da]" title="View details">
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
                  <button type="button" onClick={() => setDetail(p)} className="block w-full text-left">
                    <p className="truncate text-sm font-medium hover:text-primary">{p.designNumber}</p>
                    {/* Weight on its own non-truncating line so narrow phone
                        cards can't clip it (it was last on one truncated line). */}
                    <p className="truncate text-xs text-muted-foreground">
                      {p.category ? `${p.category}` : ''}{p.subCategory ? ` › ${p.subCategory}` : ''}
                    </p>
                    {formatWeight(p.weightGrams) && <p className="text-xs font-medium text-muted-foreground">{formatWeight(p.weightGrams)}</p>}
                    {salesMap[p.id] ? (
                      <div className="mt-1 flex items-center gap-1.5">
                        <StarRating count={salesMap[p.id].stars} size="sm" />
                        <span className="text-[10px] text-muted-foreground">{salesMap[p.id].unitsLast30d} sold · 30d</span>
                      </div>
                    ) : null}
                  </button>
                  <Button size="sm" variant={inCart ? 'outline' : 'default'} className={`w-full ${inCart ? 'border-green-300 text-green-700' : 'metal-sheen text-[#17120b] font-semibold'}`}
                    onClick={() => cart.add({ productId: p.id, name: p.designNumber, designNumber: p.designNumber, imageUrl: img?.secureUrl })}>
                    {inCart ? <><Check className="mr-1 h-3.5 w-3.5" />In cart</> : <><Plus className="mr-1 h-3.5 w-3.5" />Add</>}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {detail ? (
        <StoreManagerProductDetailModal
          key={detail.id}
          product={detail}
          products={data ?? []}
          onClose={() => setDetail(null)}
          tryOnBack="/store/manufacturer-catalog"
          primaryAction={(product) => {
            const inCart = cart.items.some((i) => i.productId === product.id);
            const img = product.images.find((i) => i.isPrimary) ?? product.images[0];
            return (
              <Button
                onClick={() => { cart.add({ productId: product.id, name: product.designNumber, designNumber: product.designNumber, imageUrl: img?.secureUrl }); setDetail(null); }}
                className="metal-sheen flex-1 font-semibold text-[#17120b]"
              >
                {inCart ? <><Check className="mr-1.5 h-4 w-4" />In cart</> : <><Plus className="mr-1.5 h-4 w-4" />Add</>}
              </Button>
            );
          }}
        />
      ) : null}
    </div>
  );
}
