'use client';

import { Gem, X } from 'lucide-react';
import { useEffect } from 'react';

import { StarRating } from '@/components/ui/StarRating';
import { titleCaseName } from '@/lib/format';

export type AnalyticsProduct = {
  manufacturerProductId: string;
  productName: string;
  designNumber: string | null;
  imageUrl: string | null;
  category: string | null;
  subCategory: string | null;
  weight?: number | null;
  units: number;
  stars: number;
};

export function ProductDetailModal({ product, onClose }: { product: AnalyticsProduct; onClose: () => void }) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex min-h-full items-center justify-center overflow-y-auto bg-black/50 p-3 py-6 backdrop-blur-[2px] sm:p-4 sm:py-8"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${titleCaseName(product.productName)} details`}
    >
      <div
        className="relative max-h-[calc(100vh-3rem)] w-full max-w-md overflow-y-auto rounded-2xl bg-card shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close product details"
          className="absolute right-3 top-3 z-20 rounded-full bg-black/60 p-2 text-white transition-colors hover:bg-black/80"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="bg-[#ece5da] p-4 rounded-t-2xl">
          <div className="aspect-square overflow-hidden rounded-xl bg-white">
            {product.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={product.imageUrl} alt={product.productName} className="h-full w-full object-contain" />
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground/40"><Gem className="h-10 w-10" /></div>
            )}
          </div>
        </div>

        <div className="space-y-4 p-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">
              {product.category ?? 'Jewellery'}{product.subCategory ? ` · ${product.subCategory}` : ''}
            </p>
            <h2 className="mt-1 font-display text-xl font-medium">{titleCaseName(product.productName)}</h2>
            {product.designNumber ? <p className="mt-0.5 text-sm text-muted-foreground">Design {product.designNumber}</p> : null}
          </div>

          <div className="overflow-hidden rounded-lg border text-sm">
            {product.weight != null ? (
              <div className="flex justify-between px-4 py-2.5">
                <span className="text-muted-foreground">Weight</span>
                <span className="font-medium">{product.weight}g</span>
              </div>
            ) : null}
            <div className="flex justify-between gap-4 bg-muted/40 px-4 py-2.5">
              <span className="text-muted-foreground">Category</span>
              <span className="text-right font-medium">{product.category ?? '—'}{product.subCategory ? ` › ${product.subCategory}` : ''}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-muted-foreground">Units sold</span>
              <span className="flex items-center gap-2 font-semibold">
                <StarRating count={product.stars} size="sm" />
                {product.units}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
