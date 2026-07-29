'use client';

import { Loader2, Gem, ShoppingCart, Check, Minus, Plus, Trash2, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StarRating } from '@/components/ui/StarRating';
import { useApi, apiPost } from '@/hooks/use-api';
import { useB2bCart } from '@/hooks/use-b2b-cart';
import { CATEGORIES, subCategoriesFor } from '@/lib/categories';
import { formatWeight } from '@/lib/format';

type Img = { secureUrl: string; isPrimary: boolean };
type Product = { id: string; designNumber: string; name?: string | null; category: string | null; subCategory: string | null; weightGrams: string | null; hasTryon: boolean; images: Img[] };
// Sales info across ALL of this retailer's branches, keyed by manufacturerProductId.
type SalesInfo = { stars: number; unitsLast30d: number };

export default function ManufacturerCatalogBrowsePage() {
  const { data, error, loading } = useApi<Product[]>('/api/store/catalog', '/store/login');
  const cart = useB2bCart();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [subCategory, setSubCategory] = useState('');
  const [showCart, setShowCart] = useState(false);
  const [notes, setNotes] = useState('');
  const [placing, setPlacing] = useState(false);
  const [salesMap, setSalesMap] = useState<Record<string, SalesInfo>>({});

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
          <p className="mt-0.5 text-sm text-muted-foreground">Browse designs and place a restock order (goes to manager approval).</p>
        </div>
        <Button variant="outline" onClick={() => setShowCart((v) => !v)}>
          <ShoppingCart className="mr-1.5 h-4 w-4" />Cart ({cart.count})
        </Button>
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

      {showCart && (
        <div className="rounded-xl border bg-card p-4 space-y-3">
          <h2 className="text-sm font-semibold">Your B2B Cart</h2>
          {cart.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Cart is empty.</p>
          ) : (
            <>
              <div className="space-y-2">
                {cart.items.map((i) => (
                  <div key={i.productId} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0"><p className="truncate text-sm">{i.name}</p><p className="text-xs text-muted-foreground">{i.designNumber}</p></div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => cart.setQty(i.productId, i.quantity - 1)} className="rounded border p-1"><Minus className="h-3 w-3" /></button>
                      <span className="w-8 text-center text-sm tabular-nums">{i.quantity}</span>
                      <button onClick={() => cart.setQty(i.productId, i.quantity + 1)} className="rounded border p-1"><Plus className="h-3 w-3" /></button>
                    </div>
                    <button onClick={() => cart.remove(i.productId)} className="text-muted-foreground hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                  </div>
                ))}
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
                <div className="relative aspect-[3/4] bg-[#ece5da]">
                  {img ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={img.secureUrl} alt={p.designNumber} className="h-full w-full object-cover" />
                  ) : <div className="flex h-full items-center justify-center text-muted-foreground/40"><Gem className="h-8 w-8" /></div>}
                  {p.hasTryon && <span className="metal-sheen absolute right-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold text-[#17120b]"><Sparkles className="mr-0.5 inline h-2.5 w-2.5" />AR</span>}
                </div>
                <div className="p-3 space-y-2">
                  <div>
                    <p className="truncate text-sm font-medium">{p.designNumber}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {p.category ? `${p.category}` : ''}{p.subCategory ? ` › ${p.subCategory}` : ''}{formatWeight(p.weightGrams) ? ` · ${formatWeight(p.weightGrams)}` : ''}
                    </p>
                    {salesMap[p.id] ? (
                      <div className="mt-1 flex items-center gap-1.5">
                        <StarRating count={salesMap[p.id].stars} size="sm" />
                        <span className="text-[10px] text-muted-foreground">{salesMap[p.id].unitsLast30d} sold · 30d</span>
                      </div>
                    ) : null}
                  </div>
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
    </div>
  );
}
