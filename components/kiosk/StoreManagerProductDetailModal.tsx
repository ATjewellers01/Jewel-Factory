'use client';

import { ArrowLeftRight, Gem, Sparkles, X } from 'lucide-react';
import Image from 'next/image';
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
  // "Sub-category 2" — manufacturer-editable, own list per category.
  subCategory2?: string | null;
  purity?: string | null;
  weightGrams: string | null;
  grossWeightGrams?: string | null;
  netWeightGrams?: string | null;
  size?: string | null; // bangles only — hidden when absent
  description?: string | null;
  expectedDate?: string | null;
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
  // Which design the main block currently shows — starts as the opened
  // product, but switches in-place when a thumbnail below is tapped, so
  // browsing alternatives never needs closing/reopening the modal.
  const [active, setActive] = useState(product);

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

  // Similar designs are always relative to the ORIGINALLY opened product, not
  // whichever one is currently active — switching the main view shouldn't
  // also reshuffle the thumbnail strip out from under the thumb mid-browse.
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
    .slice(0, 10);

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-[#17130f]/65 p-3 backdrop-blur-[3px] sm:p-5"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-label={`${active.designNumber} details`}
      >
        <div className="flex w-full max-w-[28rem] flex-col items-center gap-3 sm:max-w-[52rem]" onClick={(event) => event.stopPropagation()}>
          <div
            className="relative h-[min(32rem,calc(100dvh-5rem))] w-full overflow-hidden rounded-[1.4rem] border border-white/60 bg-[#fdfcf9] shadow-[0_30px_100px_rgba(0,0,0,0.38)] sm:h-[min(32rem,calc(100dvh-5rem))] sm:rounded-[1.6rem]"
          >
            <button type="button" onClick={onClose} aria-label="Close product details" className="absolute right-3 top-3 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-white/30 bg-[#211b16]/75 text-white shadow-lg backdrop-blur-md transition hover:rotate-90 hover:bg-[#211b16] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d2a84a] focus-visible:ring-offset-2 sm:right-5 sm:top-5"><X className="h-5 w-5" /></button>
            <ProductBlock product={active} primaryAction={primaryAction} tryOnBack={tryOnBack} onZoom={setZoom} />
          </div>

          {/* Similar designs — a horizontally-scrollable thumbnail strip
              instead of a full-screen block per design (previously required
              one vertical scroll-snap per alternative to see each one). Tap
              a thumbnail to swap it into the main block above. */}
          {similar.length > 0 ? (
            <div className="w-full rounded-2xl border border-white/50 bg-[#fdfcf9]/95 p-2.5 shadow-[0_18px_50px_rgba(0,0,0,0.2)] backdrop-blur-md sm:p-3">
              <div className="mb-2 flex items-center justify-between px-0.5">
                <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9b7e3f]">Similar designs</span>
                <span className="flex items-center gap-1 text-[10px] text-[#8d8174]"><ArrowLeftRight className="h-3 w-3" /> Scroll for more</span>
              </div>
              <div className="relative">
                <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-[#fdfcf9] to-transparent" />
                <div className="flex gap-2 overflow-x-auto pb-1 snap-x snap-mandatory no-scrollbar">
                  {similar.map((candidate) => (
                    <button
                      key={candidate.id}
                      type="button"
                      onClick={() => setActive(candidate)}
                      aria-label={`View ${candidate.designNumber}`}
                      aria-current={active.id === candidate.id}
                      className={`w-16 shrink-0 snap-start overflow-hidden rounded-xl border-2 bg-white text-left transition-colors sm:w-20 ${active.id === candidate.id ? 'border-[#c9a84c]' : 'border-transparent hover:border-[#c9a84c]/50'}`}
                    >
                      <div className="relative aspect-square bg-[#ece5da]">
                        {(candidate.images.find((i) => i.isPrimary) ?? candidate.images[0]) ? (
                          <Image src={(candidate.images.find((i) => i.isPrimary) ?? candidate.images[0])!.secureUrl} alt={candidate.designNumber} fill className="object-cover" />
                        ) : <div className="flex h-full items-center justify-center text-muted-foreground/40"><Gem className="h-4 w-4" /></div>}
                      </div>
                      <p className="truncate px-1 py-1 text-[10px] font-medium text-[#3d3529]">{candidate.designNumber}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {zoom ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4 sm:p-6" onClick={() => setZoom(null)} role="dialog" aria-modal="true" aria-label="Enlarged product image">
          <button type="button" onClick={() => setZoom(null)} aria-label="Close enlarged image" className="absolute right-4 top-4 rounded-full bg-white/15 p-2 text-white hover:bg-white/25"><X className="h-5 w-5" /></button>
          <div className="relative h-[90dvh] w-[92vw]" onClick={(event) => event.stopPropagation()}>
            <Image src={zoom} alt="" fill className="rounded-lg object-contain" />
          </div>
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
  // Studded (non-Set categories) and every Set-specific Sub-category 2 value
  // (Antique/Handmade/Casting/Turkish/Temple Set) both store Gross/Net Weight
  // instead of a single Weight — detect via the data itself rather than
  // duplicating ProductForm's Set-options list here.
  const studded = Boolean(product.grossWeightGrams || product.netWeightGrams);
  const formattedWeight = formatWeight(product.weightGrams);
  const formattedGross = formatWeight(product.grossWeightGrams ?? null);
  const formattedNet = formatWeight(product.netWeightGrams ?? null);

  return (
    <article className="flex h-full min-h-0 flex-col bg-[#fdfcf9] sm:grid sm:grid-cols-[0.96fr_1.04fr]">
      <div className="flex h-[50%] min-h-56 shrink-0 flex-col bg-[#ede5d8] p-1.5 sm:h-full sm:min-h-0 sm:border-r sm:border-[#d8c8aa]/55 sm:p-3.5 lg:p-4">
        <div className="relative min-h-0 flex-1 overflow-hidden rounded-[1.1rem] bg-white shadow-[inset_0_0_0_1px_rgba(122,91,39,0.08)]">
          {selectedImage ? (
            <Image src={selectedImage.secureUrl} alt={product.designNumber} fill onClick={() => onZoom(selectedImage.secureUrl)} className="cursor-zoom-in object-contain transition duration-500 hover:scale-[1.015]" title="Click to enlarge" />
          ) : <div className="flex h-full items-center justify-center text-muted-foreground/40"><Gem className="h-10 w-10" /></div>}
          <span className="pointer-events-none absolute bottom-2.5 left-2.5 rounded-full border border-white/40 bg-white/80 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.15em] text-[#6f5731] shadow-sm backdrop-blur-md">Tap to enlarge</span>
        </div>
        {product.images.length > 1 ? (
          <div className="mt-2 flex shrink-0 justify-center gap-2 overflow-x-auto pb-0.5">
            {product.images.map((image, index) => (
              <button key={image.secureUrl} type="button" onClick={() => setImageIndex(index)} aria-label={`View image ${index + 1}`} className={`relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg border-2 transition-colors sm:h-12 sm:w-12 ${index === imageIndex ? 'border-primary' : 'border-transparent hover:border-primary/40'}`}>
                <Image src={image.secureUrl} alt="" fill className="object-cover" />
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="flex min-h-0 flex-1 flex-col bg-[#fdfcf9] sm:h-full">
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-3 pt-3 sm:px-5 sm:pb-5 sm:pt-6 md:px-6 lg:px-8 lg:pt-8">
          <div className="pr-8">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#b48228] sm:text-xs">{product.category ?? 'Jewellery'}{product.subCategory ? ` · ${product.subCategory}` : ''}</p>
            <h2 className="mt-0.5 font-display text-lg font-medium leading-tight text-[#211b16] sm:mt-1 sm:text-2xl md:text-3xl lg:text-4xl">Design {product.designNumber}</h2>
          </div>
          <div className="mt-2 grid grid-cols-2 overflow-hidden rounded-xl border border-[#ded3c3] bg-white text-xs shadow-[0_5px_22px_rgba(75,54,28,0.04)] sm:mt-4 sm:text-sm">
            {product.purity ? <Spec label="Purity" value={product.purity} /> : null}
            {studded ? (
              <>
                {formattedGross ? <Spec label="Gross Weight" value={formattedGross} /> : null}
                {formattedNet ? <Spec label="Net Weight" value={formattedNet} /> : null}
              </>
            ) : (
              formattedWeight ? <Spec label="Weight" value={formattedWeight} /> : null
            )}
            {product.size ? <Spec label="Size" value={product.size} /> : null}
            <Spec label="Category" value={`${product.category ?? '—'}${product.subCategory ? ` › ${product.subCategory}` : ''}`} wide={!product.size} />
            {product.expectedDate ? <Spec label="Estimated Order Time" value={product.expectedDate} wide /> : null}
          </div>
          {product.description && product.description.trim().length >= 4 ? <p className="mt-2 text-xs leading-[1.15rem] text-[#6f665e] sm:mt-4 sm:text-sm md:leading-6 lg:text-base lg:leading-7">{product.description}</p> : null}
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
    <div className={`min-w-0 border-b border-r border-[#e7dfd3] px-3 py-2 last:border-b-0 sm:py-2.5 lg:px-4 lg:py-3 ${wide ? 'col-span-2' : ''}`}>
      <span className="block text-[9px] font-semibold uppercase tracking-[0.15em] text-[#978b7f] sm:text-[10px]">{label}</span>
      <span className="mt-1 block break-words font-medium leading-snug text-[#29231e]">{value}</span>
    </div>
  );
}
