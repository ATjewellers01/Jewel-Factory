'use client';

import { Gem, X } from 'lucide-react';
import { useEffect } from 'react';

import { formatWeight } from '@/lib/format';

export type OrderItemProductSafe = {
  designNumber: string;
  category: string | null;
  subCategory: string | null;
  subCategory2?: string | null;
  weightGrams: string | number | null;
  grossWeightGrams?: string | number | null;
  netWeightGrams?: string | number | null;
  size: string | null;
  purity: string | null;
  description: string | null;
  images: { secureUrl: string; isPrimary: boolean }[];
};

/**
 * Retailer/Store-Manager-facing product detail popup for an order line item.
 * Never shows karigarCode (manufacturer-internal only) — see
 * ManufacturerOrderItemModal for the manufacturer-side equivalent that does.
 */
export function OrderItemDetailModal({ product, onClose }: { product: OrderItemProductSafe; onClose: () => void }) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const img = product.images.find((i) => i.isPrimary) ?? product.images[0];

  return (
    <div className="fixed inset-0 z-50 flex min-h-full items-center justify-center overflow-y-auto bg-black/50 p-4 py-8" onClick={onClose} role="dialog" aria-modal="true">
      <div className="relative w-full max-w-lg rounded-2xl bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={onClose} aria-label="Close" className="absolute right-3 top-3 z-20 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80"><X className="h-4 w-4" /></button>
        <div className="grid sm:grid-cols-2">
          <div className="bg-[#ece5da] p-4 sm:rounded-l-2xl">
            <div className="aspect-square overflow-hidden rounded-xl bg-white">
              {img ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={img.secureUrl} alt={product.designNumber} className="h-full w-full object-contain" />
              ) : <div className="flex h-full items-center justify-center text-muted-foreground/40"><Gem className="h-10 w-10" /></div>}
            </div>
          </div>
          <div className="space-y-3 p-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-primary">{product.category ?? 'Jewellery'}{product.subCategory ? ` · ${product.subCategory}` : ''}</p>
              <h2 className="mt-1 font-display text-xl font-medium">{product.designNumber}</h2>
            </div>
            <div className="overflow-hidden rounded-lg border text-sm">
              {product.purity && <div className="flex justify-between px-4 py-2"><span className="text-muted-foreground">Purity</span><span className="font-medium">{product.purity}</span></div>}
              {(product.grossWeightGrams || product.netWeightGrams) ? (
                <>
                  {formatWeight(product.grossWeightGrams ?? null) && <div className="flex justify-between bg-muted/40 px-4 py-2"><span className="text-muted-foreground">Gross Weight</span><span className="font-medium">{formatWeight(product.grossWeightGrams ?? null)}</span></div>}
                  {formatWeight(product.netWeightGrams ?? null) && <div className="flex justify-between px-4 py-2"><span className="text-muted-foreground">Net Weight</span><span className="font-medium">{formatWeight(product.netWeightGrams ?? null)}</span></div>}
                </>
              ) : (
                formatWeight(product.weightGrams) && <div className="flex justify-between bg-muted/40 px-4 py-2"><span className="text-muted-foreground">Weight</span><span className="font-medium">{formatWeight(product.weightGrams)}</span></div>
              )}
              {product.size && <div className="flex justify-between px-4 py-2"><span className="text-muted-foreground">Size</span><span className="font-medium">{product.size}</span></div>}
              <div className="flex justify-between px-4 py-2"><span className="text-muted-foreground">Category</span><span className="text-right font-medium">{product.category ?? '—'}{product.subCategory ? ` › ${product.subCategory}` : ''}</span></div>
            </div>
            {product.description && <p className="text-sm leading-relaxed text-muted-foreground">{product.description}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
