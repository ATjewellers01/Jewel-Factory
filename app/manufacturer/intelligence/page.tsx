'use client';

import { Loader2, Package, BarChart3, Scale, Store as StoreIcon, Trophy } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { AnalyticsFilterBar } from '@/components/analytics/AnalyticsFilterBar';
import { ProductDetailModal, type AnalyticsProduct } from '@/components/analytics/ProductDetailModal';
import {
  AnalyticsFilters,
  DEFAULT_ANALYTICS_FILTERS,
  matchesFilters,
  rangeQueryString,
} from '@/lib/analytics-filters';
import { calculateStars, getWeightRange } from '@/lib/db/analytics';

// Flat row shape shared by /manufacturer/top-products, /category-weight, /retailers
interface FlatRow {
  id?: string;
  product_id?: string;
  name?: string;
  design_number?: string | null;
  category?: string | null;
  sub_category?: string | null;
  weight_grams?: string | number | null;
  secure_url?: string | null;
  total_units?: number | string;
  retailer_id?: string;
  retailer_name?: string;
}

interface FilterableProduct {
  id: string;
  name: string;
  designNumber: string | null;
  imageUrl: string | null;
  category: string | null;
  subCategory: string | null;
  weight: number | null;
  units: number;
  stars: number;
  retailerName?: string;
}

function toProduct(row: FlatRow): FilterableProduct {
  const units = Number(row.total_units) || 0;
  return {
    id: row.id ?? row.product_id ?? '',
    name: row.name ?? 'Unknown',
    designNumber: row.design_number ?? null,
    imageUrl: row.secure_url ?? null,
    category: row.category ?? null,
    subCategory: row.sub_category ?? null,
    weight: row.weight_grams != null ? parseFloat(String(row.weight_grams)) : null,
    units,
    stars: calculateStars(units),
    retailerName: row.retailer_name,
  };
}

export default function ManufacturerIntelligencePage() {
  const [filters, setFilters] = useState<AnalyticsFilters>(DEFAULT_ANALYTICS_FILTERS);
  const [topProducts, setTopProducts] = useState<FilterableProduct[]>([]);
  const [categoryRows, setCategoryRows] = useState<FilterableProduct[]>([]);
  const [retailerRows, setRetailerRows] = useState<FilterableProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<AnalyticsProduct | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const qs = rangeQueryString(filters);
        const [topRes, catRes, retRes] = await Promise.all([
          fetch(`/api/analytics/manufacturer/top-products?${qs}&limit=50`, { credentials: 'same-origin' }),
          fetch(`/api/analytics/manufacturer/category-weight?${qs}`, { credentials: 'same-origin' }),
          fetch(`/api/analytics/manufacturer/retailers?${qs}`, { credentials: 'same-origin' }),
        ]);
        if (!topRes.ok || !catRes.ok || !retRes.ok) throw new Error('Failed to load intelligence data');

        const [topJson, catJson, retJson] = await Promise.all([
          topRes.json() as Promise<{ data: FlatRow[] }>,
          catRes.json() as Promise<{ data: FlatRow[] }>,
          retRes.json() as Promise<{ data: FlatRow[] }>,
        ]);

        setTopProducts((topJson.data ?? []).map(toProduct));
        setCategoryRows((catJson.data ?? []).map(toProduct));
        setRetailerRows((retJson.data ?? []).map(toProduct));
      } catch {
        setError('Could not load intelligence data. Please try again.');
      } finally {
        setLoading(false);
      }
    })();
    // Only the date-range portion of filters triggers a refetch — category/
    // sub-category/weight/units are applied client-side below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.datePreset, filters.customFrom, filters.customTo]);

  const view = useMemo(() => {
    const filteredTop = topProducts.filter((p) => matchesFilters(p, filters));
    const filteredCategory = categoryRows.filter((p) => matchesFilters(p, filters));
    const filteredRetailer = retailerRows.filter((p) => matchesFilters(p, filters));

    const byCategory: Record<string, number> = {};
    const byWeight: Record<string, number> = {};
    filteredCategory.forEach((p) => {
      if (p.category) byCategory[p.category] = (byCategory[p.category] || 0) + p.units;
      const range = getWeightRange(p.weight);
      byWeight[range] = (byWeight[range] || 0) + p.units;
    });

    const byRetailer = new Map<string, { name: string; total: number; products: FilterableProduct[] }>();
    filteredRetailer.forEach((p) => {
      const key = p.retailerName ?? 'Unknown';
      const entry = byRetailer.get(key) ?? { name: key, total: 0, products: [] };
      entry.total += p.units;
      entry.products.push(p);
      byRetailer.set(key, entry);
    });
    const retailers = [...byRetailer.values()]
      .map((r) => ({ ...r, products: r.products.sort((a, b) => b.units - a.units).slice(0, 5) }))
      .sort((a, b) => b.total - a.total);

    const totalUnits = Object.values(byCategory).reduce((a, b) => a + b, 0);

    return {
      topProducts: filteredTop.sort((a, b) => b.units - a.units),
      byCategory,
      byWeight,
      retailers,
      totalUnits,
    };
  }, [topProducts, categoryRows, retailerRows, filters]);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      <div>
        <h1 className="text-2xl font-medium tracking-tight">Intelligence</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Which products, categories and retailers are driving orders — system-wide.</p>
      </div>

      <AnalyticsFilterBar filters={filters} onChange={setFilters} unitsLabel="Units ordered" />

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {loading && <div className="flex items-center gap-2 py-8 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>}

      {!loading && !error && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Units in range" value={view.totalUnits} icon={BarChart3} />
            <Stat label="Products ordered" value={view.topProducts.length} icon={Package} />
            <Stat label="Categories" value={Object.keys(view.byCategory).length} icon={Scale} />
            <Stat label="Retailers" value={view.retailers.length} icon={StoreIcon} />
          </div>

          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="flex items-center gap-2 border-b bg-muted/40 px-4 py-3">
              <Trophy className="h-4 w-4 text-primary" /><p className="text-sm font-medium">Top products (all retailers)</p>
            </div>
            <div className="divide-y">
              {view.topProducts.length === 0 && <p className="px-4 py-8 text-center text-sm text-muted-foreground">No orders match these filters.</p>}
              {view.topProducts.slice(0, 15).map((p, idx) => (
                <button
                  type="button"
                  key={p.id || idx}
                  onClick={() => setSelectedProduct({
                    manufacturerProductId: p.id,
                    productName: p.name,
                    designNumber: p.designNumber,
                    imageUrl: p.imageUrl,
                    category: p.category,
                    subCategory: p.subCategory,
                    weight: p.weight,
                    units: p.units,
                    stars: p.stars,
                  })}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">#{idx + 1} {p.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.designNumber}{p.category ? ` · ${p.category}` : ''}{p.subCategory ? ` › ${p.subCategory}` : ''}{p.weight != null ? ` · ${p.weight}g` : ''}
                    </p>
                  </div>
                  <span className="shrink-0 font-semibold tabular-nums">{p.units}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-xl border bg-card p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">By category</p>
              <div className="space-y-2">
                {Object.entries(view.byCategory)
                  .sort(([, a], [, b]) => b - a)
                  .map(([cat, units]) => (
                    <BarRow key={cat} label={cat} value={units} max={view.totalUnits} />
                  ))}
                {Object.keys(view.byCategory).length === 0 && <p className="text-sm text-muted-foreground">No data for these filters.</p>}
              </div>
            </div>

            <div className="rounded-xl border bg-card p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">By weight range</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {['0-5g', '5-10g', '10-15g', '15-20g', '20g+', 'Unknown']
                  .filter((range) => view.byWeight[range])
                  .map((range) => (
                    <div key={range} className="rounded-lg border px-3 py-2 text-center">
                      <p className="text-xs font-semibold">{range}</p>
                      <p className="text-lg font-bold tabular-nums">{view.byWeight[range]}</p>
                    </div>
                  ))}
                {Object.keys(view.byWeight).length === 0 && <p className="text-sm text-muted-foreground col-span-full">No data for these filters.</p>}
              </div>
            </div>
          </div>

          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="flex items-center gap-2 border-b bg-muted/40 px-4 py-3">
              <StoreIcon className="h-4 w-4 text-primary" /><p className="text-sm font-medium">By retailer</p>
            </div>
            <div className="divide-y">
              {view.retailers.length === 0 && <p className="px-4 py-8 text-center text-sm text-muted-foreground">No orders match these filters.</p>}
              {view.retailers.map((r) => (
                <div key={r.name} className="px-4 py-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">{r.name}</p>
                    <span className="text-sm font-semibold tabular-nums">{r.total} units</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                    {r.products.map((p) => (
                      <span key={p.id} className="text-xs text-muted-foreground">
                        {p.name} <span className="font-medium text-foreground">({p.units})</span>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {selectedProduct && (
        <ProductDetailModal product={selectedProduct} onClose={() => setSelectedProduct(null)} />
      )}
    </div>
  );
}

function Stat({ label, value, icon: Icon }: { label: string; value: number; icon: typeof Package }) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
        <Icon className="h-3.5 w-3.5 text-primary" />
      </div>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function BarRow({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="min-w-0 truncate">{label}</span>
      <div className="flex items-center gap-2 shrink-0">
        <div className="w-28 rounded-full bg-muted h-2">
          <div className="bg-primary h-2 rounded-full" style={{ width: `${pct}%` }} />
        </div>
        <span className="font-semibold tabular-nums w-10 text-right">{value}</span>
      </div>
    </div>
  );
}
