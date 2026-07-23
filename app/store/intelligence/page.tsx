'use client';

import { Loader2, TrendingUp, Package, Lightbulb, Store as StoreIcon, BarChart3, Scale } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { useApi } from '@/hooks/use-api';
import { StarRating } from '@/components/ui/StarRating';
import { AnalyticsFilterBar } from '@/components/analytics/AnalyticsFilterBar';
import { ProductDetailModal, type AnalyticsProduct } from '@/components/analytics/ProductDetailModal';
import { getWeightRange } from '@/lib/db/analytics';
import type { BranchSalesData } from '@/lib/db/analytics';
import {
  AnalyticsFilters,
  DEFAULT_ANALYTICS_FILTERS,
  matchesFilters,
  rangeQueryString,
} from '@/lib/analytics-filters';

type Summary = { views7: number; views30: number; tryons7: number; tryons30: number; sales30: number; activeProducts: number };
type Rec = { productId: string; name: string; type: string; reason: string; imageUrl: string | null };

export default function IntelligencePage() {
  const summary = useApi<Summary>('/api/store/intelligence/summary', '/store/login');
  const recs = useApi<Rec[]>('/api/store/intelligence/recommendations', '/store/login');

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5">
      <div>
        <h1 className="text-2xl font-medium tracking-tight">Intelligence</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Demand signals and restock recommendations for your inventory.</p>
      </div>

      {summary.loading && <div className="flex items-center gap-2 py-8 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>}
      {summary.data && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Views (7d)" value={summary.data.views7} icon={TrendingUp} />
          <Stat label="Views (30d)" value={summary.data.views30} icon={TrendingUp} />
          <Stat label="Try-ons (7d)" value={summary.data.tryons7} icon={TrendingUp} />
          <Stat label="Try-ons (30d)" value={summary.data.tryons30} icon={TrendingUp} />
          <Stat label="Sales (30d)" value={summary.data.sales30} icon={TrendingUp} />
          <Stat label="Active Products" value={summary.data.activeProducts} icon={Package} />
        </div>
      )}

      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="flex items-center gap-2 border-b bg-muted/40 px-4 py-3">
          <Lightbulb className="h-4 w-4 text-primary" /><p className="text-sm font-medium">Recommendations</p>
        </div>
        {recs.loading && <div className="flex items-center gap-2 px-4 py-8 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>}
        {recs.data && recs.data.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">No recommendations yet. They appear as your kiosk gathers views, try-ons and sales.</p>
        )}
        {recs.data && recs.data.length > 0 && (
          <div className="divide-y">
            {recs.data.map((r) => (
              <div key={r.productId} className="flex items-center gap-3 px-4 py-3">
                {r.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.imageUrl} alt="" className="h-10 w-10 rounded-lg border object-cover" />
                ) : <div className="h-10 w-10 rounded-lg border bg-muted" />}
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium">{r.name}</p>
                  <p className="text-xs text-muted-foreground">{r.reason}</p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${r.type === 'restock' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-700'}`}>
                  {r.type}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <BranchBreakdown />
    </div>
  );
}

function Stat({ label, value, icon: Icon }: { label: string; value: number; icon: typeof TrendingUp }) {
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

// Which of the retailer's stores (branches) is selling what — best-sellers per
// branch, category + weight split, fully filterable. Complements the summary
// above (which is store-wide, not per-branch).
function BranchBreakdown() {
  const [branches, setBranches] = useState<BranchSalesData[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<AnalyticsFilters>(DEFAULT_ANALYTICS_FILTERS);
  const [selectedProduct, setSelectedProduct] = useState<AnalyticsProduct | null>(null);

  useEffect(() => {
    setLoading(true);
    (async () => {
      try {
        const qs = rangeQueryString(filters);
        const res = await fetch(`/api/analytics/store/branches${qs ? `?${qs}` : ''}`, { credentials: 'same-origin' });
        if (!res.ok) return;
        const json = (await res.json()) as { data: BranchSalesData[] };
        const list = json.data || [];
        setBranches(list);
        setSelectedBranchId((prev) => (prev && list.some((b) => b.branchId === prev) ? prev : list[0]?.branchId ?? null));
      } catch {
        // non-critical — the page above still works without this section
      } finally {
        setLoading(false);
      }
    })();
    // Only the date-range portion of filters triggers a refetch — category/
    // sub-category/weight/units are applied client-side below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.datePreset, filters.customFrom, filters.customTo]);

  const branch = branches.find((b) => b.branchId === selectedBranchId);

  const view = useMemo(() => {
    if (!branch) return null;
    const filtered = branch.products.filter((p) => matchesFilters(p, filters));
    const byCategory: Record<string, number> = {};
    const byWeight: Record<string, number> = {};
    filtered.forEach((p) => {
      if (p.category) byCategory[p.category] = (byCategory[p.category] || 0) + p.units;
      const range = getWeightRange(p.weight);
      byWeight[range] = (byWeight[range] || 0) + p.units;
    });
    const totalUnits = filtered.reduce((sum, p) => sum + p.units, 0);
    const topProducts = [...filtered].sort((a, b) => b.units - a.units).slice(0, 8);
    return { filtered, byCategory, byWeight, totalUnits, topProducts };
  }, [branch, filters]);

  if (loading && !branches.length) {
    return <div className="flex items-center gap-2 py-8 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading store breakdown…</div>;
  }
  if (!branches.length) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <StoreIcon className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">Store-wise sales</h2>
      </div>

      <AnalyticsFilterBar filters={filters} onChange={setFilters} unitsLabel="Units sold" />

      <div className="flex gap-2 flex-wrap">
        {branches.map((b) => (
          <button
            key={b.branchId}
            onClick={() => setSelectedBranchId(b.branchId)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              selectedBranchId === b.branchId ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/70'
            }`}
          >
            {b.branchName}
          </button>
        ))}
      </div>

      {loading && <div className="flex items-center gap-2 py-4 text-muted-foreground text-sm"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Refreshing…</div>}

      {view && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat label="Units in range" value={view.totalUnits} icon={BarChart3} />
            <Stat label="Products sold" value={view.filtered.length} icon={Package} />
            <Stat label="Categories" value={Object.keys(view.byCategory).length} icon={Scale} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-xl border bg-card p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Top products</p>
              <div className="space-y-2">
                {view.topProducts.length === 0 && <p className="text-sm text-muted-foreground">No sales match these filters.</p>}
                {view.topProducts.map((p, idx) => (
                  <button
                    type="button"
                    key={idx}
                    onClick={() => setSelectedProduct(p)}
                    className="flex w-full items-center justify-between gap-3 rounded-lg -mx-2 px-2 py-1.5 text-left transition-colors hover:bg-muted/60"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{p.productName}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.category}{p.subCategory ? ` › ${p.subCategory}` : ''}{p.weight != null ? ` · ${p.weight}g` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <StarRating count={p.stars} size="sm" />
                      <span className="text-sm font-semibold tabular-nums">{p.units}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

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

            <div className="rounded-xl border bg-card p-4 lg:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">By weight range</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
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
        </>
      )}

      {selectedProduct && (
        <ProductDetailModal product={selectedProduct} onClose={() => setSelectedProduct(null)} />
      )}
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
