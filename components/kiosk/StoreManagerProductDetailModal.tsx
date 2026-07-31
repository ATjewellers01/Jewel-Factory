'use client';

import { Gem, Sparkles, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { formatWeight, productMetaLine } from '@/lib/format';

export type StoreManagerProduct = {
  id: string;
  designNumber: string;
  name?: string | null;
  category: string | null;
  subCategory: string | null;
  purity?: string | null;
  weightGrams: string | null;
  description?: string | null;
  hasTryon: boolean;
  images: { secureUrl: string; isPrimary: boolean }[];
};

export function StoreManagerProductDetailModal({
  product,
  products,
  onClose,
  primaryAction,
  tryOnBack,
}: {
  product: StoreManagerProduct;
  products: StoreManagerProduct[];
  onClose: () => void;
  primaryAction: (product: StoreManagerProduct) => ReactNode;
  tryOnBack: string;
}) {
  const [activeProduct, setActiveProduct] = useState(product);
  const [imageIndex, setImageIndex] = useState(0);
  const [zoom, setZoom] = useState<string | null>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (zoom) setZoom(null);
      else onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose, zoom]);

  const similar = products
    .filter((candidate) => candidate.id !== activeProduct.id && (
      (activeProduct.subCategory && candidate.subCategory === activeProduct.subCategory) ||
      (activeProduct.category && candidate.category === activeProduct.category)
    ))
    .sort((a, b) => {
      const aSub = activeProduct.subCategory && a.subCategory === activeProduct.subCategory ? 0 : 1;
      const bSub = activeProduct.subCategory && b.subCategory === activeProduct.subCategory ? 0 : 1;
      return aSub - bSub;
    })
    .slice(0, 6);
  const selectedImage = activeProduct.images[imageIndex];

  function selectProduct(nextProduct: StoreManagerProduct) {
    setActiveProduct(nextProduct);
    setImageIndex(0);
  }

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex min-h-full items-center justify-center overflow-y-auto bg-black/50 p-3 py-6 backdrop-blur-[2px] sm:p-4 sm:py-8"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-label={`${activeProduct.designNumber} details`}
      >
        <div className="relative max-h-[calc(100vh-3rem)] w-full max-w-3xl overflow-y-auto rounded-2xl bg-card shadow-2xl" onClick={(event) => event.stopPropagation()}>
          <button type="button" onClick={onClose} aria-label="Close product details" className="absolute right-3 top-3 z-20 rounded-full bg-black/60 p-2 text-white transition-colors hover:bg-black/80"><X className="h-4 w-4" /></button>
          <div className="grid md:grid-cols-2">
            <div className="bg-[#ece5da] p-3 sm:p-4 md:rounded-l-2xl">
              <div className="aspect-square overflow-hidden rounded-xl bg-white">
                {selectedImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={selectedImage.secureUrl} alt={activeProduct.designNumber} onClick={() => setZoom(selectedImage.secureUrl)} className="h-full w-full cursor-zoom-in object-contain" title="Click to enlarge" />
                ) : <div className="flex h-full items-center justify-center text-muted-foreground/40"><Gem className="h-10 w-10" /></div>}
              </div>
              {activeProduct.images.length > 1 ? (
                <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                  {activeProduct.images.map((image, index) => (
                    <button key={image.secureUrl} type="button" onClick={() => setImageIndex(index)} aria-label={`View image ${index + 1}`} className={`h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg border-2 ${index === imageIndex ? 'border-primary' : 'border-transparent'}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={image.secureUrl} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="space-y-4 p-5 sm:p-6">
              <div className="pr-8">
                <p className="text-xs font-semibold uppercase tracking-widest text-primary">{activeProduct.category ?? 'Jewellery'}{activeProduct.subCategory ? ` · ${activeProduct.subCategory}` : ''}</p>
                <h2 className="mt-1 font-display text-2xl font-medium">Design {activeProduct.designNumber}</h2>
              </div>
              <div className="overflow-hidden rounded-lg border text-sm">
                {activeProduct.purity ? <div className="flex justify-between px-4 py-2.5"><span className="text-muted-foreground">Purity</span><span className="font-medium">{activeProduct.purity}</span></div> : null}
                {formatWeight(activeProduct.weightGrams) ? <div className="flex justify-between px-4 py-2.5"><span className="text-muted-foreground">Weight</span><span className="font-medium">{formatWeight(activeProduct.weightGrams)}</span></div> : null}
                <div className="flex justify-between gap-4 bg-muted/40 px-4 py-2.5"><span className="text-muted-foreground">Category</span><span className="text-right font-medium">{activeProduct.category ?? '—'}{activeProduct.subCategory ? ` › ${activeProduct.subCategory}` : ''}</span></div>
              </div>
              {activeProduct.description && activeProduct.description.trim().length >= 4 ? <p className="text-sm leading-relaxed text-muted-foreground">{activeProduct.description}</p> : null}
              <div className="flex flex-col gap-2 sm:flex-row">
                {primaryAction(activeProduct)}
                {activeProduct.hasTryon ? (
                  <Button asChild variant="outline" className="border-primary/40 text-primary">
                    <Link href={`/store-manager/try-on?product=${activeProduct.id}&back=${encodeURIComponent(tryOnBack)}`}><Sparkles className="mr-1.5 h-4 w-4" />Try On</Link>
                  </Button>
                ) : null}
              </div>
              <p className="text-[11px] text-muted-foreground">{productMetaLine({ category: activeProduct.category, subCategory: activeProduct.subCategory, purity: activeProduct.purity, weight: activeProduct.weightGrams })}</p>
            </div>
          </div>

          {similar.length > 0 ? (
            <div className="border-t px-5 py-4 sm:px-6">
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Similar designs</p>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
                {similar.map((candidate) => {
                  const image = candidate.images.find((item) => item.isPrimary) ?? candidate.images[0];
                  return (
                    <button key={candidate.id} type="button" onClick={() => selectProduct(candidate)} className="group text-left" title={candidate.designNumber}>
                      <div className="aspect-square overflow-hidden rounded-lg border bg-[#ece5da]">
                        {image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={image.secureUrl} alt={candidate.designNumber} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                        ) : <div className="flex h-full items-center justify-center text-muted-foreground/40"><Gem className="h-5 w-5" /></div>}
                      </div>
                      <p className="mt-1 truncate text-[11px] group-hover:text-primary">{candidate.designNumber}</p>
                      <p className="truncate text-[10px] text-muted-foreground">{productMetaLine({ category: candidate.category, subCategory: candidate.subCategory, weight: candidate.weightGrams })}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {zoom ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4 sm:p-6" onClick={() => setZoom(null)} role="dialog" aria-modal="true" aria-label="Enlarged product image">
          <button type="button" onClick={() => setZoom(null)} aria-label="Close enlarged image" className="absolute right-4 top-4 rounded-full bg-white/15 p-2 text-white hover:bg-white/25"><X className="h-5 w-5" /></button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoom} alt={activeProduct.designNumber} onClick={(event) => event.stopPropagation()} className="max-h-[90vh] max-w-[92vw] rounded-lg object-contain" />
        </div>
      ) : null}
    </>
  );
}
