'use client';

import { Minus, Plus } from 'lucide-react';

/**
 * Items-per-row stepper: shows the current column count between plain "-"
 * and "+" buttons, e.g. "[- 3 +]" — "-" decreases the count, "+" increases
 * it, matching ordinary arithmetic instead of a zoom metaphor (a previous
 * version had "+"/"-" wired to the opposite column-count change, and hid the
 * number entirely, so neither the icon nor the direction was self-evident).
 * `min`/`max` bound the value (inclusive).
 */
export function ItemsPerRowControl({
  value,
  onChange,
  min,
  max,
}: {
  value: number;
  onChange: (next: number) => void;
  min: number;
  max: number;
}) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-black/15 bg-white/50 px-1.5 py-1" role="group" aria-label="Items per row">
      <span className="hidden pl-1 text-xs font-medium text-[#746b62] min-[420px]:inline">Items per row</span>
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        aria-label="Fewer items per row"
        title="Fewer items per row"
        className="flex h-7 w-7 items-center justify-center rounded-md text-[#746b62] transition-colors hover:bg-black/[0.05] disabled:opacity-30 disabled:hover:bg-transparent"
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <span className="w-5 text-center text-sm font-medium tabular-nums text-[#37302a]" aria-live="polite">{value}</span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        aria-label="More items per row"
        title="More items per row"
        className="flex h-7 w-7 items-center justify-center rounded-md text-[#746b62] transition-colors hover:bg-black/[0.05] disabled:opacity-30 disabled:hover:bg-transparent"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
