'use client';

import { Filter, X } from 'lucide-react';
import type { ReactNode } from 'react';

import { CATEGORIES, subCategoriesFor } from '@/lib/categories';
import {
  AnalyticsFilters,
  DATE_PRESETS,
  DEFAULT_ANALYTICS_FILTERS,
  isFiltersActive,
} from '@/lib/analytics-filters';

interface AnalyticsFilterBarProps {
  filters: AnalyticsFilters;
  onChange: (next: AnalyticsFilters) => void;
  unitsLabel?: string; // e.g. "Units sold" vs "Sales"
}

export function AnalyticsFilterBar({ filters, onChange, unitsLabel = 'Units sold' }: AnalyticsFilterBarProps) {
  const subCategories = subCategoriesFor(filters.category);
  const active = isFiltersActive(filters);

  function set<K extends keyof AnalyticsFilters>(key: K, value: AnalyticsFilters[K]) {
    onChange({ ...filters, [key]: value });
  }

  return (
    <div className="rounded-xl border bg-card p-4 space-y-4">
      {/* Date range presets */}
      <div className="flex flex-wrap items-center gap-2">
        {DATE_PRESETS.map((preset) => (
          <button
            key={preset.value}
            type="button"
            onClick={() => set('datePreset', preset.value)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              filters.datePreset === preset.value
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted hover:bg-muted/70'
            }`}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {filters.datePreset === 'custom' && (
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs font-medium text-muted-foreground">From</label>
          <input
            type="date"
            value={filters.customFrom}
            onChange={(e) => set('customFrom', e.target.value)}
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
          />
          <label className="text-xs font-medium text-muted-foreground">To</label>
          <input
            type="date"
            value={filters.customTo}
            onChange={(e) => set('customTo', e.target.value)}
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
          />
        </div>
      )}

      {/* Category / sub-category / weight / units filters */}
      <div className="flex flex-wrap items-end gap-3 border-t pt-4">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <Filter className="h-3.5 w-3.5" /> Filters
        </div>

        <FilterField label="Category">
          <select
            value={filters.category}
            onChange={(e) => set('category', e.target.value)}
            className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
          >
            <option value="">All</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </FilterField>

        {subCategories.length > 0 && (
          <FilterField label="Sub-category">
            <select
              value={filters.subCategory}
              onChange={(e) => set('subCategory', e.target.value)}
              className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
            >
              <option value="">All</option>
              {subCategories.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </FilterField>
        )}

        <FilterField label="Weight (gm) — min">
          <input
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            placeholder="e.g. 2.5"
            value={filters.weightMin}
            onChange={(e) => set('weightMin', e.target.value)}
            className="h-9 w-24 rounded-md border border-input bg-transparent px-2 text-sm"
          />
        </FilterField>

        <FilterField label="Weight (gm) — max">
          <input
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            placeholder="e.g. 15"
            value={filters.weightMax}
            onChange={(e) => set('weightMax', e.target.value)}
            className="h-9 w-24 rounded-md border border-input bg-transparent px-2 text-sm"
          />
        </FilterField>

        <FilterField label={`${unitsLabel} — min`}>
          <input
            type="number"
            min="0"
            inputMode="numeric"
            placeholder="0"
            value={filters.unitsMin}
            onChange={(e) => set('unitsMin', e.target.value)}
            className="h-9 w-20 rounded-md border border-input bg-transparent px-2 text-sm"
          />
        </FilterField>

        <FilterField label={`${unitsLabel} — max`}>
          <input
            type="number"
            min="0"
            inputMode="numeric"
            placeholder="∞"
            value={filters.unitsMax}
            onChange={(e) => set('unitsMax', e.target.value)}
            className="h-9 w-20 rounded-md border border-input bg-transparent px-2 text-sm"
          />
        </FilterField>

        {active && (
          <button
            type="button"
            onClick={() => onChange({ ...DEFAULT_ANALYTICS_FILTERS, datePreset: filters.datePreset, customFrom: filters.customFrom, customTo: filters.customTo })}
            className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" /> Clear filters
          </button>
        )}
      </div>
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
