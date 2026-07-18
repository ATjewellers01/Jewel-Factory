'use client';

import { Loader2, Gem, Plus, Minus, Trash2, ShoppingCart, Check, Sparkles, X } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useApi, apiPost } from '@/hooks/use-api';
import { CATEGORIES, subCategoriesFor } from '@/lib/categories';
import { titleCaseName, formatWeight, productMetaLine } from '@/lib/format';

type Img = { secureUrl: string; isPrimary: boolean };
type Product = { id: string; designNumber: string; name: string; category: string | null; subCategory: string | null; weightGrams: string | null; purity?: string | null; description?: string | null; hasTryon: boolean; images: Img[] };
type CartLine = { id: string; name: string; designNumber: string; imageUrl?: string; qty: number };

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
}: {
  title: string;
  subtitle: string;
  placeEndpoint: string; // e.g. /api/branch-manager/kiosk-orders
  onPlaced: (order: { orderNumber?: string }) => void;
  notePlaceholder: string;
}) {
  const { data, loading, error } = useApi<Product[]>('/api/branch-manager/catalog', '/store-manager/login');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [subCategory, setSubCategory] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [note, setNote] = useState('');
  const [showCart, setShowCart] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [detail, setDetail] = useState<Product | null>(null);
  const [detailImg, setDetailImg] = useState(0);
  const [placeError, setPlaceError] = useState<string | null>(null);

  const filtered = (data ?? []).filter((p) =>
    (!search || p.name.toLowerCase().includes(search.toLowerCase()) || p.designNumber.toLowerCase().includes(search.toLowerCase())) &&
    (!category || p.category === category) &&
    (!subCategory || p.subCategory === subCategory),
  );

  const count = cart.reduce((s, l) => s + l.qty, 0);

  function add(p: Product) {
    setCart((c) => {
      const ex = c.find((l) => l.id === p.id);
      if (ex) return c.map((l) => (l.id === p.id ? { ...l, qty: l.qty + 1 } : l));
      return [...c, { id: p.id, name: p.name, designNumber: p.designNumber, imageUrl: (p.images.find((i) => i.isPrimary) ?? p.images[0])?.secureUrl, qty: 1 }];
    });
  }
  function setQty(id: string, qty: number) {
    if (qty <= 0) return setCart((c) => c.filter((l) => l.id !== id));
    setCart((c) => c.map((l) => (l.id === id ? { ...l, qty } : l)));
  }

  async function place() {
    setPlaceError(null);
    setPlacing(true);
    try {
      const order = (await apiPost(placeEndpoint, {
        requirementNote: note.trim() || undefined,
        items: cart.map((l) => ({ manufacturerProductId: l.id, quantity: l.qty })),
      })) as { orderNumber?: string };
      setCart([]); setNote(''); setShowCart(false);
      onPlaced(order);
    } catch (e) {
      setPlaceError(e instanceof Error ? e.message : 'Could not place order');
    } finally { setPlacing(false); }
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-4 px-4 py-6 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-medium tracking-tight">{title}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <Button variant="outline" onClick={() => setShowCart((v) => !v)}>
          <ShoppingCart className="mr-1.5 h-4 w-4" />Cart ({count})
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Input placeholder="Search designs…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
        <select className="h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={category} onChange={(e) => { setCategory(e.target.value); setSubCategory(''); }}>
          <option value="">All categories</option>
          {CATEGORIES.map((cc) => <option key={cc} value={cc}>{cc}</option>)}
        </select>
        {subCategoriesFor(category).length > 0 && (
          <select className="h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={subCategory} onChange={(e) => setSubCategory(e.target.value)}>
            <option value="">All sub-categories</option>
            {subCategoriesFor(category).map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {loading && <div className="flex items-center gap-2 py-12 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>}

      {showCart && (
        <div className="rounded-xl border bg-card p-4 space-y-3">
          <h2 className="text-sm font-semibold">Order ({count} item{count === 1 ? '' : 's'})</h2>
          {cart.length === 0 ? (
            <p className="text-sm text-muted-foreground">Cart is empty.</p>
          ) : (
            <>
              <div className="space-y-2">
                {cart.map((l) => (
                  <div key={l.id} className="flex items-center gap-3">
                    {l.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={l.imageUrl} alt="" className="h-12 w-12 rounded-lg border bg-white object-contain p-0.5" />
                    ) : <div className="h-12 w-12 rounded-lg border bg-muted" />}
                    <div className="min-w-0 flex-1"><p className="truncate text-sm">{titleCaseName(l.name)}</p><p className="text-xs text-muted-foreground">{l.designNumber}</p></div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setQty(l.id, l.qty - 1)} className="rounded border p-1"><Minus className="h-3 w-3" /></button>
                      <span className="w-8 text-center text-sm tabular-nums">{l.qty}</span>
                      <button onClick={() => setQty(l.id, l.qty + 1)} className="rounded border p-1"><Plus className="h-3 w-3" /></button>
                    </div>
                    <button onClick={() => setQty(l.id, 0)} className="text-muted-foreground hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                  </div>
                ))}
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Requirement / note (goes to Head Office)</label>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={notePlaceholder} className="mt-1 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm min-h-[70px]" />
              </div>
              {placeError && <p className="text-sm text-red-600">{placeError}</p>}
              <Button onClick={place} disabled={placing} className="metal-sheen w-full text-[#17120b] font-semibold">
                {placing ? <Loader2 className="h-4 w-4 animate-spin" /> : `Send to Head Office (${count} item${count === 1 ? '' : 's'})`}
              </Button>
            </>
          )}
        </div>
      )}

      {data && filtered.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((p) => {
            const img = p.images.find((i) => i.isPrimary) ?? p.images[0];
            const inCart = cart.some((l) => l.id === p.id);
            return (
              <div key={p.id} className="overflow-hidden rounded-xl border bg-card">
                <button type="button" onClick={() => { setDetail(p); setDetailImg(0); }} className="relative block aspect-[3/4] w-full bg-[#ece5da]" title="View details">
                  {img ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={img.secureUrl} alt={p.name} className="h-full w-full object-cover" />
                  ) : <div className="flex h-full items-center justify-center text-muted-foreground/40"><Gem className="h-8 w-8" /></div>}
                  {p.hasTryon && <span className="metal-sheen absolute right-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold text-[#17120b]"><Sparkles className="mr-0.5 inline h-2.5 w-2.5" />AR</span>}
                </button>
                <div className="p-3 space-y-2">
                  <button type="button" onClick={() => { setDetail(p); setDetailImg(0); }} className="block w-full text-left">
                    <p className="truncate text-sm font-medium hover:text-primary">{titleCaseName(p.name)}</p>
                    <p className="truncate text-xs text-muted-foreground">{p.designNumber}{p.category ? ` · ${p.category}` : ''}{p.subCategory ? ` › ${p.subCategory}` : ''}{formatWeight(p.weightGrams) ? ` · ${formatWeight(p.weightGrams)}` : ''}</p>
                  </button>
                  <Button size="sm" variant={inCart ? 'outline' : 'default'} className={`w-full ${inCart ? 'border-green-300 text-green-700' : 'metal-sheen text-[#17120b] font-semibold'}`} onClick={() => add(p)}>
                    {inCart ? <><Check className="mr-1 h-3.5 w-3.5" />Added</> : <><Plus className="mr-1 h-3.5 w-3.5" />Add</>}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Product detail modal (Store Manager shows this to the customer) */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setDetail(null)}>
          <div className="grid max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-card shadow-xl md:grid-cols-2" onClick={(e) => e.stopPropagation()}>
            {/* Gallery */}
            <div className="relative bg-[#ece5da] p-4">
              <button onClick={() => setDetail(null)} className="absolute right-3 top-3 z-10 rounded-full bg-black/50 p-1.5 text-white hover:bg-black/70"><X className="h-4 w-4" /></button>
              <div className="aspect-square overflow-hidden rounded-xl bg-white">
                {detail.images[detailImg] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={detail.images[detailImg].secureUrl} alt={detail.name} className="h-full w-full object-contain" />
                ) : <div className="flex h-full items-center justify-center text-muted-foreground/40"><Gem className="h-10 w-10" /></div>}
              </div>
              {detail.images.length > 1 && (
                <div className="mt-3 flex gap-2 overflow-x-auto">
                  {detail.images.map((im, i) => (
                    <button key={i} onClick={() => setDetailImg(i)} className={`h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg border-2 ${i === detailImg ? 'border-primary' : 'border-transparent'}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={im.secureUrl} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* Info */}
            <div className="space-y-4 p-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-primary">{detail.category ?? 'Jewellery'}{detail.subCategory ? ` · ${detail.subCategory}` : ''}</p>
                <h2 className="mt-1 font-display text-2xl font-medium">{titleCaseName(detail.name)}</h2>
                <p className="mt-0.5 text-sm text-muted-foreground">Design {detail.designNumber}</p>
              </div>
              <div className="overflow-hidden rounded-xl border text-sm">
                <div className="flex justify-between px-4 py-2.5"><span className="text-muted-foreground">Metal</span><span className="font-medium">Gold</span></div>
                {detail.purity && <div className="flex justify-between bg-muted/40 px-4 py-2.5"><span className="text-muted-foreground">Purity</span><span className="font-medium">{detail.purity}</span></div>}
                {formatWeight(detail.weightGrams) && <div className="flex justify-between px-4 py-2.5"><span className="text-muted-foreground">Weight</span><span className="font-medium">{formatWeight(detail.weightGrams)}</span></div>}
                <div className="flex justify-between bg-muted/40 px-4 py-2.5"><span className="text-muted-foreground">Category</span><span className="font-medium">{detail.category ?? '—'}{detail.subCategory ? ` › ${detail.subCategory}` : ''}</span></div>
              </div>
              {detail.description && detail.description.trim().length >= 4 && (
                <p className="text-sm leading-relaxed text-muted-foreground">{detail.description}</p>
              )}
              <div className="flex gap-2">
                <Button onClick={() => { add(detail); setDetail(null); }} className="metal-sheen flex-1 text-[#17120b] font-semibold"><Plus className="mr-1.5 h-4 w-4" />Add to order</Button>
                <Button variant="outline" onClick={() => setDetail(null)}>Close</Button>
              </div>
              <p className="text-[11px] text-muted-foreground">{productMetaLine({ category: detail.category, subCategory: detail.subCategory, purity: detail.purity, weight: detail.weightGrams })}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
