'use client';

import { Loader2, Package } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Input } from '@/components/ui/input';
import { ProductCard, type KioskProduct } from '@/components/kiosk/ProductCard';
import { CATEGORIES, subCategoriesFor } from '@/lib/categories';

export default function KioskCatalogPage() {
  const [products, setProducts] = useState<KioskProduct[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [subCategory, setSubCategory] = useState('');
  const [tryOnOnly, setTryOnOnly] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/kiosk/catalog', { cache: 'no-store' });
        const json = (await res.json()) as { data?: KioskProduct[]; error?: { message: string } };
        if (!res.ok || json.error) { setError(json.error?.message ?? 'Failed to load'); return; }
        setProducts(json.data!);
      } catch { setError('Network error'); }
    })();
  }, []);

  const filtered = (products ?? []).filter((p) =>
    (!search || p.designNumber.toLowerCase().includes(search.toLowerCase())) &&
    (!category || p.category === category) &&
    (!subCategory || p.subCategory === subCategory) &&
    (!tryOnOnly || p.hasTryon),
  );

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-normal tracking-tight">Catalog</h1>
        <p className="mt-1 text-sm text-muted-foreground">Explore our full collection.</p>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
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
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={tryOnOnly} onChange={(e) => setTryOnOnly(e.target.checked)} className="accent-[#C29A33]" />
          AR Try-On only
        </label>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {!products && !error && <div className="flex items-center gap-2 py-16 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>}
      {products && filtered.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <Package className="h-10 w-10 text-muted-foreground/40" /><p className="text-sm text-muted-foreground">No designs found.</p>
        </div>
      )}
      {products && filtered.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      )}
    </main>
  );
}
