'use client';

import { Plus, Loader2, Package, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CATEGORIES, subCategoriesFor } from '@/lib/categories';
import { formatWeight } from '@/lib/format';

type ProductImage = { id: string; secureUrl: string; isPrimary: boolean };
type Product = {
  id: string;
  designNumber: string;
  name: string | null;
  category: string | null;
  subCategory: string | null;
  weightGrams: string | null;
  karigarCode: string | null;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  hasTryon: boolean;
  images: ProductImage[];
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  ACTIVE: 'bg-green-100 text-green-800',
  ARCHIVED: 'bg-red-100 text-red-700',
};

export default function ManufacturerCatalogPage() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [subCategory, setSubCategory] = useState('');
  const [karigarCode, setKarigarCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const res = await fetch('/api/manufacturer/products', { cache: 'no-store' });
      if (res.status === 401) { window.location.assign('/manufacturer/login'); return; }
      const json = (await res.json()) as { data?: Product[]; error?: { message: string } };
      if (!res.ok || json.error) { setError(json.error?.message ?? 'Failed to load'); return; }
      setProducts(json.data!);
    } catch {
      setError('Network error');
    }
  }

  useEffect(() => { void load(); }, []);

  const filtered = (products ?? []).filter((p) => {
    const matchSearch =
      !search ||
      p.designNumber.toLowerCase().includes(search.toLowerCase()) ||
      (p.name ?? '').toLowerCase().includes(search.toLowerCase());
    const matchCat = !category || p.category === category;
    const matchSub = !subCategory || p.subCategory === subCategory;
    const matchKarigar = !karigarCode || p.karigarCode === karigarCode;
    return matchSearch && matchCat && matchSub && matchKarigar;
  });

  const karigarOptions = Array.from(
    new Set((products ?? []).map((p) => p.karigarCode).filter((k): k is string => !!k)),
  ).sort();

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-medium tracking-tight">Catalog</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Your global design catalog. No price shown — Gold only.</p>
        </div>
        <Link href="/manufacturer/catalog/new">
          <Button className="metal-sheen text-[#17120b] font-semibold">
            <Plus className="mr-1.5 h-4 w-4" /> Add Design
          </Button>
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        <Input placeholder="Search by design number…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
        <select
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
          value={category}
          onChange={(e) => { setCategory(e.target.value); setSubCategory(''); }}
        >
          <option value="">All categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        {subCategoriesFor(category).length > 0 && (
          <select
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
            value={subCategory}
            onChange={(e) => setSubCategory(e.target.value)}
          >
            <option value="">All sub-categories</option>
            {subCategoriesFor(category).map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
        {karigarOptions.length > 0 && (
          <select
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
            value={karigarCode}
            onChange={(e) => setKarigarCode(e.target.value)}
          >
            <option value="">All karigars</option>
            {karigarOptions.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        )}
        {(category || subCategory || search || karigarCode) && (
          <button type="button" onClick={() => { setSearch(''); setCategory(''); setSubCategory(''); setKarigarCode(''); }} className="text-xs text-muted-foreground hover:text-foreground">Clear</button>
        )}
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {!products && !error && (
        <div className="flex items-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      )}

      {products && filtered.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
          <Package className="h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">{search ? 'No designs match your search.' : 'No designs yet.'}</p>
          {!search && (
            <Link href="/manufacturer/catalog/new">
              <Button variant="outline" size="sm"><Plus className="mr-1.5 h-4 w-4" /> Add your first design</Button>
            </Link>
          )}
        </div>
      )}

      {products && filtered.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((p) => {
            const img = p.images.find((i) => i.isPrimary) ?? p.images[0];
            return (
              <Link key={p.id} href={`/manufacturer/catalog/${p.id}`}>
                <div className="group overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-md">
                  <div className="relative aspect-[3/4] bg-[#ece5da]">
                    {img ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={img.secureUrl} alt={p.designNumber} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-muted-foreground/40">
                        <Package className="h-8 w-8" />
                      </div>
                    )}
                    {p.hasTryon && (
                      <span className="metal-sheen absolute right-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold text-[#17120b]">
                        <Sparkles className="mr-0.5 inline h-2.5 w-2.5" />AR
                      </span>
                    )}
                    <span className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_COLORS[p.status]}`}>
                      {p.status.toLowerCase()}
                    </span>
                  </div>
                  <div className="p-3">
                    <p className="truncate text-sm font-medium">{p.designNumber}</p>
                    <p className="truncate text-xs text-muted-foreground">{p.category ?? ''}{p.subCategory ? ` › ${p.subCategory}` : ''}</p>
                    {formatWeight(p.weightGrams) && <p className="text-xs text-muted-foreground">{formatWeight(p.weightGrams)}</p>}
                    {p.karigarCode && <p className="text-xs text-muted-foreground/70">Karigar: {p.karigarCode}</p>}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
