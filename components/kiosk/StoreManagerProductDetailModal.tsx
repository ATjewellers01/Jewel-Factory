'use client';

import { ArrowLeftRight, ChevronLeft, ChevronRight, Gem, Maximize2, RotateCcw, Sparkles, X, ZoomIn, ZoomOut } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

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

type ZoomState = { images: string[]; index: number };

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
  const [zoom, setZoom] = useState<ZoomState | null>(null);
  // Per-design DOM nodes inside the vertical scroll-snap stack, so the
  // horizontal thumbnail strip below can jump the vertical scroll position
  // to any design — both ways of browsing stay available together, neither
  // replaces the other.
  const blockRefs = useRef(new Map<string, HTMLDivElement>());
  const thumbRefs = useRef(new Map<string, HTMLButtonElement>());
  const scrollRef = useRef<HTMLDivElement>(null);
  // The design currently on screen in the vertical stack — its thumbnail is
  // highlighted in the strip so it's clear which one "+ Add" applies to.
  const [activeId, setActiveId] = useState(product.id);

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

  const jumpTo = (id: string) => {
    setActiveId(id);
    blockRefs.current.get(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const similarKey = similar.map((candidate) => candidate.id).join(',');
  useEffect(() => {
    setActiveId(product.id);
    const root = scrollRef.current;
    if (!root || !similarKey) return;
    // Whichever design block crosses a line ~40% down the box is the active one.
    const observer = new IntersectionObserver((entries) => {
      const hit = entries.find((entry) => entry.isIntersecting);
      const id = hit ? (hit.target as HTMLElement).dataset.designId : undefined;
      if (id) setActiveId(id);
    }, { root, rootMargin: '-40% 0px -59% 0px', threshold: 0 });
    blockRefs.current.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [product.id, similarKey]);

  // Keep the highlighted thumbnail in view inside the horizontal strip.
  useEffect(() => {
    thumbRefs.current.get(activeId)?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  }, [activeId]);

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-[#17130f]/65 backdrop-blur-[3px] sm:p-5"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-label={`${product.designNumber} details`}
      >
        {/* Mobile: a full-screen sheet (no outer gap / rounded corners) so the
            product photo can use the whole screen width. Desktop: floating card. */}
        <div className="flex h-full w-full flex-col items-center sm:h-auto sm:max-w-[60rem] sm:gap-2.5" onClick={(event) => event.stopPropagation()}>
          <div
            className={`relative min-h-0 w-full flex-1 overflow-hidden bg-[#fdfcf9] sm:flex-none sm:rounded-[1.6rem] sm:border sm:border-white/60 sm:shadow-[0_30px_100px_rgba(0,0,0,0.38)] ${similar.length > 0 ? 'sm:h-[min(38rem,calc(100dvh-12rem))]' : 'sm:h-[min(38rem,calc(100dvh-2.5rem))]'}`}
          >
            <button type="button" onClick={onClose} aria-label="Close product details" className="absolute right-3 top-[max(0.75rem,env(safe-area-inset-top))] z-20 flex h-10 w-10 items-center justify-center rounded-full border border-white/30 bg-[#211b16]/75 text-white shadow-lg backdrop-blur-md transition hover:rotate-90 hover:bg-[#211b16] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d2a84a] focus-visible:ring-offset-2 sm:right-5 sm:top-5"><X className="h-5 w-5" /></button>

            {/* Mobile: each design is one naturally tall page (image → specs → actions)
                and the whole card scrolls once — no nested scroll area, so reading the
                specs never jumps to the next design. Proximity snap only settles at a
                design's start when you're already near it. Desktop keeps one full-height
                two-column panel per design with a mandatory snap. */}
            <div
              ref={scrollRef}
              className="h-full snap-y snap-proximity overflow-y-auto overscroll-contain scrollbar-auto [scrollbar-color:#c9a84c_#ece5d8] sm:snap-mandatory [&::-webkit-scrollbar]:w-2.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#c9a84c] [&::-webkit-scrollbar-track]:bg-[#ece5d8]"
            >
              <div ref={(el) => { if (el) blockRefs.current.set(product.id, el); }} data-design-id={product.id} className="flex min-h-full snap-start flex-col sm:h-full sm:snap-always">
                <ProductBlock product={product} primaryAction={primaryAction} tryOnBack={tryOnBack} onZoom={setZoom} />
              </div>

              {similar.length > 0 ? (
                <div className="border-t border-[#d8c8aa]/55 bg-[#f3ece0] px-4 py-2.5 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8a6a2e] sm:hidden">
                  Similar designs
                </div>
              ) : null}

              {similar.map((candidate) => (
                <div key={candidate.id} ref={(el) => { if (el) blockRefs.current.set(candidate.id, el); }} data-design-id={candidate.id} className="flex min-h-full snap-start flex-col border-t border-[#d8c8aa]/55 sm:h-full sm:snap-always">
                  <ProductBlock product={candidate} primaryAction={primaryAction} tryOnBack={tryOnBack} onZoom={setZoom} />
                </div>
              ))}
            </div>
          </div>

          {/* Horizontal thumbnail strip — a second, quick way to jump straight
              to any similar design, alongside (not instead of) the vertical
              scroll-snap stack above. Tapping a thumbnail smooth-scrolls the
              box above to that design. */}
          {similar.length > 0 ? (
            <div className="w-full shrink-0 bg-[#211b16] px-2.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5 shadow-[0_18px_50px_rgba(0,0,0,0.3)] backdrop-blur-md sm:rounded-2xl sm:border sm:border-white/50 sm:bg-[#211b16]/90 sm:p-3">
              <div className="mb-1 flex items-center justify-between px-0.5 sm:mb-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#f0d99a]">Similar designs</span>
                <span className="flex items-center gap-1 text-[10px] text-white/60"><ArrowLeftRight className="h-3 w-3" /> Scroll for more</span>
              </div>
              <div className="relative">
                <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-[#211b16] to-transparent" />
                <div className="flex gap-2 overflow-x-auto pb-1 snap-x snap-mandatory no-scrollbar">
                  {[product, ...similar].map((candidate) => {
                    const img = candidate.images.find((i) => i.isPrimary) ?? candidate.images[0];
                    const active = candidate.id === activeId;
                    return (
                      <button
                        key={candidate.id}
                        ref={(el) => { if (el) thumbRefs.current.set(candidate.id, el); else thumbRefs.current.delete(candidate.id); }}
                        type="button"
                        onClick={() => jumpTo(candidate.id)}
                        aria-label={`Scroll to ${candidate.designNumber}`}
                        aria-current={active || undefined}
                        className={`w-14 shrink-0 snap-start overflow-hidden rounded-xl border-2 text-left transition-all sm:w-20 ${active ? 'border-[#e2bd62] bg-[#f6e3b0] shadow-[0_0_0_3px_rgba(226,189,98,0.35)]' : 'border-transparent bg-white opacity-75 hover:border-[#c9a84c] hover:opacity-100'}`}
                      >
                        <div className="relative aspect-square bg-[#ece5da]">
                          {img ? (
                            <Image src={img.secureUrl} alt={candidate.designNumber} fill sizes="80px" className="object-cover" />
                          ) : <div className="flex h-full items-center justify-center text-muted-foreground/40"><Gem className="h-4 w-4" /></div>}
                        </div>
                        <p className={`truncate px-1 py-0.5 text-[10px] sm:py-1 ${active ? 'font-bold text-[#5c3f0c]' : 'font-medium text-[#3d3529]'}`}>{candidate.designNumber}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {zoom ? (
        <ImageZoomViewer
          images={zoom.images}
          index={zoom.index}
          onIndexChange={(index) => setZoom({ ...zoom, index })}
          onClose={() => setZoom(null)}
        />
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
  onZoom: (zoom: ZoomState) => void;
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

  const specs: { label: string; value: string; wide?: boolean }[] = [];
  if (product.purity) specs.push({ label: 'Purity', value: product.purity });
  if (studded) {
    if (formattedGross) specs.push({ label: 'Gross Weight', value: formattedGross });
    if (formattedNet) specs.push({ label: 'Net Weight', value: formattedNet });
  } else if (formattedWeight) {
    specs.push({ label: 'Weight', value: formattedWeight });
  }
  if (product.size) specs.push({ label: 'Size', value: product.size });
  // Odd count → the last half-width spec spans the row so the grid has no hole.
  if (specs.length % 2 === 1) specs[specs.length - 1]!.wide = true;
  if (product.expectedDate) specs.push({ label: 'Estimated Order Time', value: product.expectedDate, wide: true });

  // Full taxonomy path — Category › Sub-category › Sub-category 2.
  const categoryPath = [product.category, product.subCategory, product.subCategory2].filter((part): part is string => Boolean(part && part.trim()));
  const categoryRows = [
    { label: 'Category', value: product.category },
    { label: 'Sub-category', value: product.subCategory },
    { label: 'Type', value: product.subCategory2 },
  ].filter((row): row is { label: string; value: string } => Boolean(row.value && row.value.trim()));

  const openZoom = () => onZoom({ images: product.images.map((image) => image.secureUrl), index: Math.max(0, product.images.indexOf(selectedImage!)) });

  return (
    <article className="flex flex-1 flex-col bg-[#fdfcf9] sm:grid sm:h-full sm:min-h-0 sm:grid-cols-2 md:grid-cols-[1.15fr_0.85fr]">
      <div className="flex shrink-0 flex-col bg-[#ede5d8] sm:h-full sm:min-h-0 sm:border-r sm:border-[#d8c8aa]/55 sm:p-3.5 lg:p-4">
        {/* Mobile: edge-to-edge photo, as tall as the screen width (capped at 65%
            of the screen height) — a square catalogue photo fills the full width.
            object-contain everywhere, so the design is never cropped. */}
        <div className="flex h-[min(100vw,65dvh)] items-center justify-center sm:h-auto sm:min-h-0 sm:flex-1">
          <div className="relative h-full w-full overflow-hidden sm:aspect-square sm:w-auto sm:max-w-full sm:rounded-[1.1rem]">
            {selectedImage ? (
              <button type="button" onClick={openZoom} aria-label="Open zoom view" className="group absolute inset-0 cursor-zoom-in">
                <Image src={selectedImage.secureUrl} alt={product.designNumber} fill sizes="(min-width: 640px) 560px, 100vw" className="object-contain transition duration-500 group-hover:scale-[1.015]" />
                <span className="pointer-events-none absolute bottom-2.5 left-2.5 flex items-center gap-1.5 rounded-full border border-white/40 bg-white/85 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6f5731] shadow-sm backdrop-blur-md">
                  <Maximize2 className="h-3 w-3" />Tap to zoom
                </span>
              </button>
            ) : <div className="flex h-full items-center justify-center text-muted-foreground/40"><Gem className="h-10 w-10" /></div>}
          </div>
        </div>
        {product.images.length > 1 ? (
          <div className="flex shrink-0 justify-center gap-2 overflow-x-auto px-2 py-2 sm:mt-2 sm:px-0 sm:pb-0.5 sm:pt-0">
            {product.images.map((image, index) => (
              <button key={image.secureUrl} type="button" onClick={() => setImageIndex(index)} aria-label={`View image ${index + 1}`} className={`relative h-11 w-11 flex-shrink-0 overflow-hidden rounded-lg border-2 bg-white transition-colors sm:h-12 sm:w-12 ${index === imageIndex ? 'border-primary' : 'border-transparent hover:border-primary/40'}`}>
                <Image src={image.secureUrl} alt="" fill sizes="48px" className="object-cover" />
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col bg-[#fdfcf9] sm:h-full sm:min-h-0">
        <div className="flex-1 px-4 pb-4 pt-4 sm:min-h-0 sm:overflow-y-auto sm:px-5 sm:pb-5 sm:pt-6 md:px-6 lg:px-8 lg:pt-8">
          <div className="pr-10">
            <p className="text-[11px] font-semibold uppercase leading-relaxed tracking-[0.18em] text-[#b48228] sm:text-xs">
              {categoryPath.length ? categoryPath.join(' · ') : 'Jewellery'}
            </p>
            <h2 className="mt-1 font-display text-2xl font-medium leading-tight text-[#211b16] md:text-3xl lg:text-4xl">Design {product.designNumber}</h2>
          </div>

          {specs.length > 0 ? (
            <div className="mt-3 grid grid-cols-2 overflow-hidden rounded-xl border border-[#ded3c3] bg-white text-sm shadow-[0_5px_22px_rgba(75,54,28,0.04)] sm:mt-4">
              {specs.map((spec) => (
                <Spec key={spec.label} label={spec.label} value={spec.value} wide={spec.wide} />
              ))}
            </div>
          ) : null}

          {categoryRows.length > 0 ? (
            <dl className="mt-3 divide-y divide-[#ece4d7] overflow-hidden rounded-xl border border-[#ded3c3] bg-white text-sm shadow-[0_5px_22px_rgba(75,54,28,0.04)]">
              {categoryRows.map((row) => (
                <div key={row.label} className="flex items-baseline justify-between gap-4 px-3.5 py-2.5 lg:px-4">
                  <dt className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#978b7f]">{row.label}</dt>
                  <dd className="min-w-0 break-words text-right font-medium text-[#29231e]">{row.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}

          {product.description && product.description.trim().length >= 4 ? <p className="mt-3 text-sm leading-6 text-[#6f665e] sm:mt-4 lg:text-base lg:leading-7">{product.description}</p> : null}
        </div>

        {/* Sticky on mobile so Add stays reachable while the whole card scrolls. */}
        <footer className="sticky bottom-0 z-10 shrink-0 border-t border-[#e7dfd3] bg-[#fdfcf9]/95 px-3 py-2 shadow-[0_-10px_28px_rgba(73,52,26,0.06)] backdrop-blur sm:static sm:px-5 sm:py-3 md:px-6 lg:px-8">
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
    <div className={`min-w-0 border-b border-r border-[#e7dfd3] px-3.5 py-2.5 lg:px-4 lg:py-3 ${wide ? 'col-span-2' : ''}`}>
      <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-[#978b7f]">{label}</span>
      <span className="mt-1 block break-words text-[15px] font-medium leading-snug text-[#29231e]">{value}</span>
    </div>
  );
}

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const DOUBLE_TAP_SCALE = 2.5;

/** Full-screen image viewer: pinch / wheel / +− / double-tap zoom, drag to pan,
 *  swipe or arrows between a design's photos. No external gesture library. */
function ImageZoomViewer({
  images,
  index,
  onIndexChange,
  onClose,
}: {
  images: string[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });
  const [gesturing, setGesturing] = useState(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ startDist: number; startScale: number; lastMid: { x: number; y: number }; startX: number; startY: number; moved: boolean; startedAt: number } | null>(null);
  const lastTap = useRef(0);

  const clampView = useCallback((scale: number, x: number, y: number) => {
    const s = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect || s === 1) return { scale: s, x: 0, y: 0 };
    const maxX = ((s - 1) * rect.width) / 2;
    const maxY = ((s - 1) * rect.height) / 2;
    return { scale: s, x: Math.min(maxX, Math.max(-maxX, x)), y: Math.min(maxY, Math.max(-maxY, y)) };
  }, []);

  const zoomBy = useCallback((factor: number) => {
    setView((v) => clampView(v.scale * factor, v.x * factor, v.y * factor));
  }, [clampView]);

  const go = useCallback((delta: number) => {
    if (images.length < 2) return;
    onIndexChange((index + delta + images.length) % images.length);
  }, [images.length, index, onIndexChange]);

  // Fresh photo → fresh zoom.
  useEffect(() => setView({ scale: 1, x: 0, y: 0 }), [index]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') go(1);
      else if (event.key === 'ArrowLeft') go(-1);
      else if (event.key === '+' || event.key === '=') zoomBy(1.4);
      else if (event.key === '-') zoomBy(1 / 1.4);
      else if (event.key === '0') setView({ scale: 1, x: 0, y: 0 });
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [go, zoomBy]);

  // Wheel needs a non-passive listener to stop the page from scrolling.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const factor = Math.exp(-event.deltaY * 0.0018);
      setView((v) => clampView(v.scale * factor, v.x * factor, v.y * factor));
    };
    stage.addEventListener('wheel', onWheel, { passive: false });
    return () => stage.removeEventListener('wheel', onWheel);
  }, [clampView]);

  const midpoint = () => {
    const pts = [...pointers.current.values()];
    return { x: (pts[0]!.x + pts[1]!.x) / 2, y: (pts[0]!.y + pts[1]!.y) / 2, dist: Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y) };
  };

  const onPointerDown = (event: React.PointerEvent) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    setGesturing(true);
    if (pointers.current.size === 2) {
      const mid = midpoint();
      gesture.current = { startDist: mid.dist, startScale: view.scale, lastMid: mid, startX: mid.x, startY: mid.y, moved: true, startedAt: Date.now() };
    } else if (pointers.current.size === 1) {
      gesture.current = { startDist: 0, startScale: view.scale, lastMid: { x: event.clientX, y: event.clientY }, startX: event.clientX, startY: event.clientY, moved: false, startedAt: Date.now() };
    }
  };

  const onPointerMove = (event: React.PointerEvent) => {
    if (!pointers.current.has(event.pointerId) || !gesture.current) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const g = gesture.current;
    if (pointers.current.size >= 2) {
      const mid = midpoint();
      const dx = mid.x - g.lastMid.x;
      const dy = mid.y - g.lastMid.y;
      g.lastMid = mid;
      setView((v) => {
        const nextScale = g.startDist > 0 ? g.startScale * (mid.dist / g.startDist) : v.scale;
        const ratio = nextScale / v.scale;
        return clampView(nextScale, v.x * ratio + dx, v.y * ratio + dy);
      });
      return;
    }
    const dx = event.clientX - g.lastMid.x;
    const dy = event.clientY - g.lastMid.y;
    g.lastMid = { x: event.clientX, y: event.clientY };
    if (Math.hypot(event.clientX - g.startX, event.clientY - g.startY) > 8) g.moved = true;
    if (view.scale > 1) setView((v) => clampView(v.scale, v.x + dx, v.y + dy));
  };

  const onPointerUp = (event: React.PointerEvent) => {
    const g = gesture.current;
    pointers.current.delete(event.pointerId);
    if (pointers.current.size > 0) {
      // One finger lifted mid-pinch — continue as a pan from the remaining finger.
      const [remaining] = [...pointers.current.values()];
      if (g && remaining) { g.lastMid = remaining; g.startDist = 0; }
      return;
    }
    setGesturing(false);
    gesture.current = null;
    if (!g) return;

    const swipeX = event.clientX - g.startX;
    const swipeY = event.clientY - g.startY;
    if (view.scale === 1 && g.moved && Math.abs(swipeX) > 60 && Math.abs(swipeX) > Math.abs(swipeY)) {
      go(swipeX < 0 ? 1 : -1);
      return;
    }
    if (g.moved || Date.now() - g.startedAt > 300) return;

    // Double tap / double click toggles zoom, centred on the tapped point.
    const now = Date.now();
    if (now - lastTap.current < 300) {
      lastTap.current = 0;
      const rect = stageRef.current?.getBoundingClientRect();
      if (view.scale > 1 || !rect) setView({ scale: 1, x: 0, y: 0 });
      else {
        const offX = event.clientX - (rect.left + rect.width / 2);
        const offY = event.clientY - (rect.top + rect.height / 2);
        setView(clampView(DOUBLE_TAP_SCALE, -offX * (DOUBLE_TAP_SCALE - 1), -offY * (DOUBLE_TAP_SCALE - 1)));
      }
    } else {
      lastTap.current = now;
    }
  };

  const src = images[index];
  const zoomed = view.scale > 1;
  const iconButton = 'flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-md transition hover:bg-white/25 disabled:opacity-35 disabled:hover:bg-white/15';

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black/95" role="dialog" aria-modal="true" aria-label="Zoomed product image" onClick={onClose}>
      <div className="flex shrink-0 items-center justify-between px-3 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-5" onClick={(event) => event.stopPropagation()}>
        <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold tabular-nums text-white/85">
          {images.length > 1 ? `${index + 1} / ${images.length}` : `${Math.round(view.scale * 100)}%`}
        </span>
        <button type="button" onClick={onClose} aria-label="Close zoom view" className={iconButton}><X className="h-5 w-5" /></button>
      </div>

      <div className="relative min-h-0 flex-1 px-2 sm:px-16">
        <div
          ref={stageRef}
          className={`relative h-full w-full touch-none select-none overflow-hidden ${zoomed ? 'cursor-grab active:cursor-grabbing' : 'cursor-zoom-in'}`}
          onClick={(event) => event.stopPropagation()}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {src ? (
            <div
              className={`absolute inset-0 ${gesturing ? '' : 'transition-transform duration-200 ease-out'}`}
              style={{ transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.scale})` }}
            >
              {/* unoptimized: load the original file so detail stays sharp when zoomed in. */}
              <Image src={src} alt="" fill unoptimized draggable={false} className="pointer-events-none object-contain" />
            </div>
          ) : null}
        </div>

        {images.length > 1 ? (
          <>
            <button type="button" onClick={(event) => { event.stopPropagation(); go(-1); }} aria-label="Previous image" className={`${iconButton} absolute left-2 top-1/2 hidden -translate-y-1/2 sm:flex`}><ChevronLeft className="h-6 w-6" /></button>
            <button type="button" onClick={(event) => { event.stopPropagation(); go(1); }} aria-label="Next image" className={`${iconButton} absolute right-2 top-1/2 hidden -translate-y-1/2 sm:flex`}><ChevronRight className="h-6 w-6" /></button>
          </>
        ) : null}
      </div>

      <div className="flex shrink-0 flex-col items-center gap-2 px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center gap-2">
          {images.length > 1 ? <button type="button" onClick={() => go(-1)} aria-label="Previous image" className={`${iconButton} sm:hidden`}><ChevronLeft className="h-5 w-5" /></button> : null}
          <button type="button" onClick={() => zoomBy(1 / 1.4)} disabled={view.scale <= MIN_SCALE} aria-label="Zoom out" className={iconButton}><ZoomOut className="h-5 w-5" /></button>
          <button type="button" onClick={() => setView({ scale: 1, x: 0, y: 0 })} disabled={!zoomed} aria-label="Reset zoom" className={iconButton}><RotateCcw className="h-5 w-5" /></button>
          <button type="button" onClick={() => zoomBy(1.4)} disabled={view.scale >= MAX_SCALE} aria-label="Zoom in" className={iconButton}><ZoomIn className="h-5 w-5" /></button>
          {images.length > 1 ? <button type="button" onClick={() => go(1)} aria-label="Next image" className={`${iconButton} sm:hidden`}><ChevronRight className="h-5 w-5" /></button> : null}
        </div>
        <p className="text-center text-[11px] text-white/55">
          <span className="sm:hidden">Pinch or double-tap to zoom · drag to move{images.length > 1 ? ' · swipe for next photo' : ''}</span>
          <span className="hidden sm:inline">Scroll or double-click to zoom · drag to move{images.length > 1 ? ' · ← → for next photo' : ''}</span>
        </p>
      </div>
    </div>
  );
}
