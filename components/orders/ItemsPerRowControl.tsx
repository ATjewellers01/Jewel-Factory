'use client';

import { Minus, Plus, ZoomIn } from 'lucide-react';

/**
 * Zoom-style grid-density control: "-" zooms out (more items per row, smaller
 * cards), "+" zooms in (fewer items per row, bigger cards) — the same mental
 * model as a map/photo zoom control, so the buttons read as self-explanatory
 * without needing a legend. `min`/`max` bound the value (inclusive).
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
    <div className="flex items-center gap-1 rounded-lg border border-black/15 bg-white/50 px-1.5 py-1" role="group" aria-label="Grid zoom — items per row">
      <ZoomIn className="h-4 w-4 shrink-0 text-[#8d8174]" aria-hidden />
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        aria-label="Zoom out (more items per row, smaller cards)"
        title="Zoom out — more items per row"
        className="flex h-7 w-7 items-center justify-center rounded-md text-[#746b62] transition-colors hover:bg-black/[0.05] disabled:opacity-30 disabled:hover:bg-transparent"
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        aria-label="Zoom in (fewer items per row, bigger cards)"
        title="Zoom in — fewer items per row"
        className="flex h-7 w-7 items-center justify-center rounded-md text-[#746b62] transition-colors hover:bg-black/[0.05] disabled:opacity-30 disabled:hover:bg-transparent"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
