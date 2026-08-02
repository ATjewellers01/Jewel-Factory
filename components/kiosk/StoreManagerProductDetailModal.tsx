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
  size?: string | null; // bangles only — hidden when absent
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
    .filter((candidate) => candidate.id !== product.id && (
      (product.subCategory && candidate.subCategory === product.subCategory) ||
      (product.category && candidate.category === product.category)
    ))
    .sort((a, b) => {
      const aSub = product.subCategory && a.subCategory === product.subCategory ? 0 : 1;
      const bSub = product.subCategory && b.subCategory === product.subCategory ? 0 : 1;
      return aSub - bSub;
    })
    .slice(0, 6);

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex min-h-full items-start justify-center overflow-y-auto bg-black/50 p-3 py-6 backdrop-blur-[2px] sm:items-center sm:p-4 sm:py-8"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-label={`${product.designNumber} details`}
      >
        <div className="relative max-h-[calc(100dvh-3rem)] w-full max-w-3xl overflow-y-auto overscroll-contain rounded-2xl bg-card shadow-2xl sm:max-h-[calc(100dvh-4rem)]" onClick={(event) => event.stopPropagation()}>
          <button type="button" onClick={onClose} aria-label="Close product details" className="absolute right-3 top-3 z-20 rounded-full bg-black/60 p-2 text-white transition-colors hover:bg-black/80"><X className="h-4 w-4" /></button>

          <ProductBlock product={product} primaryAction={primaryAction} tryOnBack={tryOnBack} onZoom={setZoom} />

          {/* Similar designs are rendered as FULL blocks — same size and content as
              the design that was opened — so the user can just keep scrolling and
              add any of them to the order without selecting one first. */}
          {similar.length > 0 ? (
            <>
              <div className="border-t bg-muted/30 px-5 py-3 sm:px-6">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Similar designs</p>
              </div>
              {similar.map((candidate) => (
                <div key={candidate.id} className="border-t">
                  <ProductBlock product={candidate} primaryAction={primaryAction} tryOnBack={tryOnBack} onZoom={setZoom} />
                </div>
              ))}
            </>
          ) : null}
        </div>
      </div>

      {zoom ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4 sm:p-6" onClick={() => setZoom(null)} role="dialog" aria-modal="true" aria-label="Enlarged product image">
          <button type="button" onClick={() => setZoom(null)} aria-label="Close enlarged image" className="absolute right-4 top-4 rounded-full bg-white/15 p-2 text-white hover:bg-white/25"><X className="h-5 w-5" /></button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoom} alt="" onClick={(event) => event.stopPropagation()} className="max-h-[90dvh] max-w-[92vw] rounded-lg object-contain" />
        </div>
      ) : null}
    </>
  );
}

/** One design: gallery + specs + description + actions. Used for the opened design
 *  and for every similar design below it, so they look and behave identically. */
function ProductBlock({
  product,
  primaryAction,
  tryOnBack,
  onZoom,
}: {
  product: StoreManagerProduct;
  primaryAction: (product: StoreManagerProduct) => ReactNode;
  tryOnBack: string;
  onZoom: (url: string) => void;
}) {
  const [imageIndex, setImageIndex] = useState(0);
  const selectedImage = product.images[imageIndex] ?? product.images[0];

  return (
    <div className="grid md:grid-cols-2">
      <div className="bg-[#ece5da] p-3 sm:p-4">
        <div className="aspect-square overflow-hidden rounded-xl bg-white">
          {selectedImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={selectedImage.secureUrl} alt={product.designNumber} onClick={() => onZoom(selectedImage.secureUrl)} className="h-full w-full cursor-zoom-in object-contain" title="Click to enlarge" />
          ) : <div className="flex h-full items-center justify-center text-muted-foreground/40"><Gem className="h-10 w-10" /></div>}
        </div>
        {product.images.length > 1 ? (
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {product.images.map((image, index) => (
              <button key={image.secureUrl} type="button" onClick={() => setImageIndex(index)} aria-label={`View image ${index + 1}`} className={`h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg border-2 ${index === imageIndex ? 'border-primary' : 'border-transparent'}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image.secureUrl} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="space-y-4 p-4 sm:p-6">
        <div className="pr-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">{product.category ?? 'Jewellery'}{product.subCategory ? ` · ${product.subCategory}` : ''}</p>
          <h2 className="mt-1 font-display text-xl font-medium sm:text-2xl">Design {product.designNumber}</h2>
        </div>
        <div className="overflow-hidden rounded-lg border text-sm">
          {product.purity ? <div className="flex justify-between px-4 py-2.5"><span className="text-muted-foreground">Purity</span><span className="font-medium">{product.purity}</span></div> : null}
          {formatWeight(product.weightGrams) ? <div className="flex justify-between px-4 py-2.5"><span className="text-muted-foreground">Weight</span><span className="font-medium">{formatWeight(product.weightGrams)}</span></div> : null}
          {product.size ? <div className="flex justify-between px-4 py-2.5"><span className="text-muted-foreground">Size</span><span className="font-medium">{product.size}</span></div> : null}
          <div className="flex justify-between gap-4 bg-muted/40 px-4 py-2.5"><span className="text-muted-foreground">Category</span><span className="text-right font-medium">{product.category ?? '—'}{product.subCategory ? ` › ${product.subCategory}` : ''}</span></div>
        </div>
        {product.description && product.description.trim().length >= 4 ? <p className="text-sm leading-relaxed text-muted-foreground">{product.description}</p> : null}
        <div className="flex flex-col gap-2 sm:flex-row">
          {primaryAction(product)}
          {product.hasTryon ? (
            <Button asChild variant="outline" className="border-primary/40 text-primary">
              <Link href={`/store-manager/try-on?product=${product.id}&back=${encodeURIComponent(tryOnBack)}`}><Sparkles className="mr-1.5 h-4 w-4" />Try On</Link>
            </Button>
          ) : null}
        </div>
        <p className="text-[11px] text-muted-foreground">{productMetaLine({ category: product.category, subCategory: product.subCategory, purity: product.purity, weight: product.weightGrams })}</p>
      </div>
    </div>
  );
}
