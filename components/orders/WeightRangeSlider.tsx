'use client';

import { Slider } from '@/components/ui/slider';

/**
 * Dual-handle weight range filter shared by every catalogue grid (Manufacturer,
 * Retailer, Store Manager). `extent` is the [min, max] actually present in the
 * currently-visible product set (from lib/weight-filter.ts's weightExtent) so
 * the slider's bounds always describe real stock, not a fixed guess.
 */
export function WeightRangeSlider({
  extent,
  value,
  onChange,
}: {
  extent: [number, number];
  /** null = full range selected (no filter applied). */
  value: [number, number] | null;
  onChange: (value: [number, number] | null) => void;
}) {
  const [min, max] = extent;
  const current = value ?? extent;
  const step = max - min > 20 ? 1 : 0.1;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Weight (gm)</p>
        {value ? (
          <button type="button" onClick={() => onChange(null)} className="text-xs font-medium text-primary hover:underline">Reset</button>
        ) : null}
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={current}
        onValueChange={(v) => {
          const [lo, hi] = v as number[];
          onChange(lo <= min && hi >= max ? null : [lo, hi]);
        }}
        minStepsBetweenThumbs={1}
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{Number(current[0]).toFixed(current[0] % 1 === 0 ? 0 : 1)} g</span>
        <span>{Number(current[1]).toFixed(current[1] % 1 === 0 ? 0 : 1)} g</span>
      </div>
    </div>
  );
}
