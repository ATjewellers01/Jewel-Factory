'use client';

import { Plus, Loader2, Package, Sparkles, Check, CheckSquare, Square, FileDown } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { WeightRangeSlider } from '@/components/orders/WeightRangeSlider';
import { useTaxonomy } from '@/hooks/use-taxonomy';
import { downloadCataloguePdf } from '@/lib/catalogue-pdf';
import { SORT_OPTIONS, weightExtent, matchWeightRange, sortProducts, type SortOption } from '@/lib/weight-filter';
import { formatWeight } from '@/lib/format';

type ProductImage = { id: string; secureUrl: string; isPrimary: boolean };
type Product = {
  id: string;
  designNumber: string;
  name: string | null;
  category: string | null;
  subCategory: string | null;
  weightGrams: string | null;
  size: string | null;
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

// The DB enum still says DRAFT; the manufacturer reads it as "Inactive".
const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'inactive',
  ACTIVE: 'active',
  ARCHIVED: 'archived',
};

export default function ManufacturerCatalogPage() {
  const taxonomy = useTaxonomy('/api/manufacturer/taxonomy');
  const [products, setProducts] = useState<Product[] | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [subCategory, setSubCategory] = useState('');
  const [karigarCode, setKarigarCode] = useState('');
  const [size, setSize] = useState('');
  const [weightRange, setWeightRange] = useState<[number, number] | null>(null);
  const [sort, setSort] = useState<SortOption>('');
  const [status, setStatus] = useState<'' | 'ACTIVE' | 'DRAFT' | 'ARCHIVED'>('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [pdfProgress, setPdfProgress] = useState<{ done: number; total: number } | null>(null);

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

  // Everything except the weight band, so the bands describe the visible set.
  const preWeight = (products ?? []).filter((p) => {
    const matchSearch =
      !search ||
      p.designNumber.toLowerCase().includes(search.toLowerCase()) ||
      (p.name ?? '').toLowerCase().includes(search.toLowerCase());
    const matchCat = !category || p.category === category;
    const matchSub = !subCategory || p.subCategory === subCategory;
    const matchKarigar = !karigarCode || p.karigarCode === karigarCode;
    const matchSize = !size || p.size === size;
    const matchStatus = !status || p.status === status;
    return matchSearch && matchCat && matchSub && matchKarigar && matchSize && matchStatus;
  });

  const weightBounds = weightExtent(preWeight.map((p) => p.weightGrams));
  const filtered = sortProducts(
    preWeight.filter((p) => matchWeightRange(p.weightGrams, weightRange)),
    sort,
    (p) => p.designNumber,
    (p) => p.weightGrams,
  );

  // Selecting designs only makes sense while a single status is in view — the
  // bulk action is "make these active", so it's offered on the Inactive filter.
  const selectionMode = status === 'DRAFT';
  const selectedInView = filtered.filter((p) => selected.has(p.id));
  const allInViewSelected = filtered.length > 0 && selectedInView.length === filtered.length;

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function activateSelected() {
    if (selectedInView.length === 0) return;
    setActivating(true);
    setError(null);
    try {
      const res = await fetch('/api/manufacturer/products/bulk-status', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedInView.map((p) => p.id), status: 'ACTIVE' }),
      });
      const json = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
      if (!res.ok || json?.error) { setError(json?.error?.message ?? 'Could not activate the selected designs.'); return; }
      setSelected(new Set());
      await load();
    } catch {
      setError('Network error — the selected designs were not activated.');
    } finally { setActivating(false); }
  }

  // Exports whatever is currently in `filtered` — the same set of cards the
  // manufacturer is looking at, in the same order.
  async function downloadPdf() {
    if (filtered.length === 0 || generatingPdf) return;
    setGeneratingPdf(true);
    setPdfProgress({ done: 0, total: filtered.length });
    try {
      await downloadCataloguePdf(
        filtered.map((p) => ({
          designNumber: p.designNumber,
          category: p.category,
          subCategory: p.subCategory,
          weightGrams: p.weightGrams,
          size: p.size,
          karigarCode: p.karigarCode,
          statusLabel: STATUS_LABELS[p.status] ?? p.status.toLowerCase(),
          imageUrl: (p.images.find((i) => i.isPrimary) ?? p.images[0])?.secureUrl ?? null,
        })),
        (done, total) => setPdfProgress({ done, total }),
      );
    } catch {
      setError('Could not generate the PDF. Please try again.');
    } finally {
      setGeneratingPdf(false);
      setPdfProgress(null);
    }
  }

  const karigarOptions = Array.from(
    new Set((products ?? []).map((p) => p.karigarCode).filter((k): k is string => !!k)),
  ).sort();
  const sizeOptions = Array.from(
    new Set((products ?? []).map((p) => p.size).filter((s): s is string => !!s)),
  ).sort();

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-medium tracking-tight">Catalogue</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Your global design catalog. No price shown — Gold only.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={downloadPdf}
            disabled={generatingPdf || filtered.length === 0}
            title="Download the currently filtered list as a PDF"
          >
            {generatingPdf ? (
              <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />{pdfProgress ? `${pdfProgress.done}/${pdfProgress.total}` : 'Generating…'}</>
            ) : (
              <><FileDown className="mr-1.5 h-4 w-4" /> Download PDF</>
            )}
          </Button>
          <Link href="/manufacturer/catalog/new">
            <Button className="metal-sheen text-[#17120b] font-semibold">
              <Plus className="mr-1.5 h-4 w-4" /> Add Design
            </Button>
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Input placeholder="Search by design number…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
        <select
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
          value={category}
          onChange={(e) => { setCategory(e.target.value); setSubCategory(''); }}
        >
          <option value="">All categories</option>
          {taxonomy.categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        {taxonomy.subCategories1For(category).length > 0 && (
          <select
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
            value={subCategory}
            onChange={(e) => setSubCategory(e.target.value)}
          >
            <option value="">All sub-categories</option>
            {taxonomy.subCategories1For(category).map((s) => <option key={s} value={s}>{s}</option>)}
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
        {sizeOptions.length > 0 && (
          <select
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
            value={size}
            onChange={(e) => setSize(e.target.value)}
            aria-label="Filter by size"
          >
            <option value="">All sizes</option>
            {sizeOptions.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
        <select
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
          value={sort}
          onChange={(e) => setSort(e.target.value as SortOption)}
          aria-label="Sort by"
        >
          {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
          value={status}
          onChange={(e) => { setStatus(e.target.value as typeof status); setSelected(new Set()); }}
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="DRAFT">Inactive</option>
          <option value="ARCHIVED">Archived</option>
        </select>
        {(category || subCategory || search || karigarCode || size || status || weightRange) && (
          <button type="button" onClick={() => { setSearch(''); setCategory(''); setSubCategory(''); setKarigarCode(''); setSize(''); setStatus(''); setWeightRange(null); setSort(''); setSelected(new Set()); }} className="text-xs text-muted-foreground hover:text-foreground">Clear</button>
        )}
      </div>

      {weightBounds && (
        <div className="max-w-xs rounded-lg border bg-card p-3">
          <WeightRangeSlider extent={weightBounds} value={weightRange} onChange={setWeightRange} />
        </div>
      )}

      {/* Bulk bar — only on the Inactive filter, where "make active" is the
          one action that applies to every design in view. */}
      {selectionMode && filtered.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/30 px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSelected(allInViewSelected ? new Set() : new Set(filtered.map((p) => p.id)))}
              className="inline-flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary"
            >
              {allInViewSelected ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4 text-muted-foreground" />}
              {allInViewSelected ? 'Clear selection' : `Select all ${filtered.length}`}
            </button>
            <span className="text-sm text-muted-foreground">
              {selectedInView.length > 0 ? `${selectedInView.length} selected` : 'Tap a design to select it'}
            </span>
          </div>
          <Button
            size="sm"
            onClick={activateSelected}
            disabled={selectedInView.length === 0 || activating}
            className="metal-sheen font-semibold text-[#17120b]"
          >
            {activating ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Check className="mr-1.5 h-4 w-4" />}
            Make active{selectedInView.length > 0 ? ` (${selectedInView.length})` : ''}
          </Button>
        </div>
      )}

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
            const isSelected = selected.has(p.id);
            const card = (
                <div className={`group overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-md ${isSelected ? 'border-primary ring-2 ring-primary/30' : ''}`}>
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
                      {STATUS_LABELS[p.status] ?? p.status.toLowerCase()}
                    </span>
                    {selectionMode && (
                      <span className={`absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-full border-2 ${isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-white/80 bg-black/30 text-transparent'}`}>
                        <Check className="h-4 w-4" />
                      </span>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="truncate text-sm font-medium">{p.designNumber}</p>
                    <p className="truncate text-xs text-muted-foreground">{p.category ?? ''}{p.subCategory ? ` › ${p.subCategory}` : ''}</p>
                    {formatWeight(p.weightGrams) && <p className="text-xs text-muted-foreground">{formatWeight(p.weightGrams)}{p.size ? ` · Size ${p.size}` : ''}</p>}
                    {p.karigarCode && <p className="text-xs text-muted-foreground/70">Karigar: {p.karigarCode}</p>}
                  </div>
                </div>
            );
            // On the Inactive filter the card selects instead of navigating —
            // editing a design is still one click away from anywhere else.
            return selectionMode ? (
              <button key={p.id} type="button" onClick={() => toggle(p.id)} aria-pressed={isSelected} className="text-left">
                {card}
              </button>
            ) : (
              <Link key={p.id} href={`/manufacturer/catalog/${p.id}`}>{card}</Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
