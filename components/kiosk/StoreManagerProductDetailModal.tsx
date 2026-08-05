'use client';

import { ChevronDown, Gem, Sparkles, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { formatWeight } from '@/lib/format';

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
  const [scrolled, setScrolled] = useState(false);

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
        className="fixed inset-0 z-50 flex items-center justify-center bg-[#17130f]/65 p-3 backdrop-blur-[3px] sm:p-5"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-label={`${product.designNumber} details`}
      >
        <div className="flex w-full max-w-[28rem] flex-col items-center gap-2.5 sm:max-w-[52rem]" onClick={(event) => event.stopPropagation()}>
          <div
            className="relative h-[min(32rem,calc(100dvh-5rem))] w-full overflow-hidden rounded-[1.4rem] border border-white/60 bg-[#fdfcf9] shadow-[0_30px_100px_rgba(0,0,0,0.38)] sm:h-[min(32rem,calc(100dvh-5rem))] sm:rounded-[1.6rem]"
          >
            <button type="button" onClick={onClose} aria-label="Close product details" className="absolute right-3 top-3 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-white/30 bg-[#211b16]/75 text-white shadow-lg backdrop-blur-md transition hover:rotate-90 hover:bg-[#211b16] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d2a84a] focus-visible:ring-offset-2 sm:right-5 sm:top-5"><X className="h-5 w-5" /></button>

            <div
              className="h-full snap-y snap-mandatory overflow-y-auto overscroll-contain"
              onScroll={(event) => setScrolled(event.currentTarget.scrollTop > 24)}
            >
              <div className="h-full snap-start snap-always">
                <ProductBlock product={product} primaryAction={primaryAction} tryOnBack={tryOnBack} onZoom={setZoom} />
              </div>

              {similar.map((candidate) => (
                <div key={candidate.id} className="h-full snap-start snap-always border-t border-[#d8c8aa]/55">
                  <ProductBlock product={candidate} primaryAction={primaryAction} tryOnBack={tryOnBack} onZoom={setZoom} />
                </div>
              ))}
            </div>
          </div>

          {similar.length > 0 ? (
            <div aria-hidden className="pointer-events-none flex h-8 items-center justify-center">
              <span className={`flex items-center gap-1.5 rounded-full border border-white/20 bg-[#211b16]/82 px-3.5 py-1.5 text-[11px] font-medium text-white shadow-lg backdrop-blur-md transition-all ${scrolled ? 'translate-y-1 opacity-0' : 'opacity-100'}`}>
                Scroll to see similar <ChevronDown className="h-3 w-3 animate-bounce" />
              </span>
            </div>
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
  const formattedWeight = formatWeight(product.weightGrams);

  return (
    <article className="flex h-full min-h-0 flex-col bg-[#fdfcf9] sm:grid sm:grid-cols-[0.96fr_1.04fr]">
      <div className="flex h-[40%] min-h-[12rem] shrink-0 flex-col bg-[#ede5d8] p-2.5 sm:h-full sm:min-h-0 sm:border-r sm:border-[#d8c8aa]/55 sm:p-3.5 lg:p-4">
        <div className="relative min-h-0 flex-1 overflow-hidden rounded-[1.1rem] bg-white shadow-[inset_0_0_0_1px_rgba(122,91,39,0.08)]">
          {selectedImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={selectedImage.secureUrl} alt={product.designNumber} onClick={() => onZoom(selectedImage.secureUrl)} className="h-full w-full cursor-zoom-in object-contain transition duration-500 hover:scale-[1.015]" title="Click to enlarge" />
          ) : <div className="flex h-full items-center justify-center text-muted-foreground/40"><Gem className="h-10 w-10" /></div>}
          <span className="pointer-events-none absolute bottom-2.5 left-2.5 rounded-full border border-white/40 bg-white/80 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.15em] text-[#6f5731] shadow-sm backdrop-blur-md">Tap to enlarge</span>
        </div>
        {product.images.length > 1 ? (
          <div className="mt-2 flex shrink-0 justify-center gap-2 overflow-x-auto pb-0.5">
            {product.images.map((image, index) => (
              <button key={image.secureUrl} type="button" onClick={() => setImageIndex(index)} aria-label={`View image ${index + 1}`} className={`h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg border-2 transition-colors sm:h-12 sm:w-12 ${index === imageIndex ? 'border-primary' : 'border-transparent hover:border-primary/40'}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image.secureUrl} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="flex min-h-0 flex-1 flex-col bg-[#fdfcf9] sm:h-full">
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-4 sm:px-5 sm:pb-5 sm:pt-6 md:px-6 lg:px-8 lg:pt-8">
          <div className="pr-8">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#b48228] sm:text-xs">{product.category ?? 'Jewellery'}{product.subCategory ? ` · ${product.subCategory}` : ''}</p>
            <h2 className="mt-1 font-display text-xl font-medium leading-tight text-[#211b16] sm:text-2xl md:text-3xl lg:text-4xl">Design {product.designNumber}</h2>
          </div>
          <div className="mt-2.5 grid grid-cols-2 overflow-hidden rounded-xl border border-[#ded3c3] bg-white text-xs shadow-[0_5px_22px_rgba(75,54,28,0.04)] sm:mt-4 sm:text-sm">
            {product.purity ? <Spec label="Purity" value={product.purity} /> : null}
            {formattedWeight ? <Spec label="Weight" value={formattedWeight} /> : null}
            {product.size ? <Spec label="Size" value={product.size} /> : null}
            <Spec label="Category" value={`${product.category ?? '—'}${product.subCategory ? ` › ${product.subCategory}` : ''}`} wide={!product.size} />
          </div>
          {product.description && product.description.trim().length >= 4 ? <p className="mt-2.5 text-xs leading-[1.15rem] text-[#6f665e] sm:mt-4 sm:text-sm md:leading-6 lg:text-base lg:leading-7">{product.description}</p> : null}
        </div>

        <footer className="shrink-0 border-t border-[#e7dfd3] bg-[#fdfcf9]/95 px-2 py-1.5 shadow-[0_-10px_28px_rgba(73,52,26,0.06)] backdrop-blur sm:px-5 sm:py-3 md:px-6 lg:px-8">
          <div className="flex flex-col gap-1.5 [&>*]:min-h-12 sm:flex-row sm:gap-2 sm:[&>*]:min-h-10">
            {primaryAction(product)}
            {product.hasTryon ? (
              <Button asChild variant="outline" className="border-primary/40 text-primary">
                <Link href={`/store-manager/try-on?product=${product.id}&back=${encodeURIComponent(tryOnBack)}`}><Sparkles className="mr-1.5 h-4 w-4" />Try On</Link>
              </Button>
            ) : null}
          </div>
        </footer>
      </div>
    </article>
  );
}

function Spec({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={`min-w-0 border-b border-r border-[#e7dfd3] px-3 py-2.5 last:border-b-0 lg:px-4 lg:py-3 ${wide ? 'col-span-2' : ''}`}>
      <span className="block text-[9px] font-semibold uppercase tracking-[0.15em] text-[#978b7f] sm:text-[10px]">{label}</span>
      <span className="mt-1 block break-words font-medium leading-snug text-[#29231e]">{value}</span>
    </div>
  );
}
