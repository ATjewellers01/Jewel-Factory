'use client';

import {
  ArrowLeftRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Gem,
  Maximize2,
  RotateCcw,
  Sparkles,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
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
  const [activeProduct, setActiveProduct] = useState<StoreManagerProduct>(product);
  const [imageIndex, setImageIndex] = useState(0);
  const [zoom, setZoom] = useState<ZoomState | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Sync active product when prop changes
  useEffect(() => {
    setActiveProduct(product);
    setImageIndex(0);
  }, [product]);

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

  const selectedImage = activeProduct.images[imageIndex] ?? activeProduct.images[0];

  const studded = Boolean(activeProduct.grossWeightGrams || activeProduct.netWeightGrams);
  const formattedWeight = formatWeight(activeProduct.weightGrams);
  const formattedGross = formatWeight(activeProduct.grossWeightGrams ?? null);
  const formattedNet = formatWeight(activeProduct.netWeightGrams ?? null);

  const specs: { label: string; value: string }[] = [];
  if (activeProduct.purity) specs.push({ label: 'Purity', value: activeProduct.purity });
  if (studded) {
    if (formattedGross) specs.push({ label: 'Gross Weight', value: formattedGross });
    if (formattedNet) specs.push({ label: 'Net Weight', value: formattedNet });
  } else if (formattedWeight) {
    specs.push({ label: 'Weight', value: formattedWeight });
  }
  if (activeProduct.size) specs.push({ label: 'Size', value: activeProduct.size });

  const rawExpectedDate = activeProduct.expectedDate?.trim();
  const formattedOrderTime = rawExpectedDate
    ? /days?/i.test(rawExpectedDate)
      ? rawExpectedDate.toUpperCase()
      : `${rawExpectedDate.toUpperCase()} DAYS`
    : null;

  // Full taxonomy path — Category · Sub-category · Sub-category 2.
  const categoryPath = [activeProduct.category, activeProduct.subCategory, activeProduct.subCategory2].filter(
    (part): part is string => Boolean(part && part.trim())
  );
  const categoryRows = [
    { label: 'Category', value: activeProduct.category },
    { label: 'Sub-category', value: activeProduct.subCategory },
    { label: 'Type', value: activeProduct.subCategory2 },
  ].filter((row): row is { label: string; value: string } => Boolean(row.value && row.value.trim()));

  const similar = products
    .filter(
      (candidate) =>
        candidate.id !== activeProduct.id &&
        ((activeProduct.subCategory && candidate.subCategory === activeProduct.subCategory) ||
          (activeProduct.category && candidate.category === activeProduct.category))
    )
    .sort((a, b) => {
      const aSub = activeProduct.subCategory && a.subCategory === activeProduct.subCategory ? 0 : 1;
      const bSub = activeProduct.subCategory && b.subCategory === activeProduct.subCategory ? 0 : 1;
      return aSub - bSub;
    })
    .slice(0, 10);

  const openZoom = () =>
    setZoom({
      images: activeProduct.images.map((img) => img.secureUrl),
      index: Math.max(0, activeProduct.images.indexOf(selectedImage!)),
    });

  const selectCandidate = (candidate: StoreManagerProduct) => {
    setActiveProduct(candidate);
    setImageIndex(0);
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-[#17130f]/75 p-2 backdrop-blur-[4px] sm:p-5"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-label={`${activeProduct.designNumber} details`}
      >
        <div
          className="relative flex h-[calc(100dvh-1rem)] w-full max-w-[28rem] flex-col overflow-hidden rounded-[1.3rem] border border-white/60 bg-[#fdfcf9] shadow-[0_30px_100px_rgba(0,0,0,0.42)] sm:h-[min(38rem,calc(100dvh-3rem))] sm:max-w-[54rem] sm:rounded-[1.6rem]"
          onClick={(event) => event.stopPropagation()}
        >
          {/* Close button - floating top-right */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close product details"
            className="absolute right-3 top-3 z-30 flex h-9 w-9 items-center justify-center rounded-full border border-white/30 bg-[#211b16]/75 text-white shadow-lg backdrop-blur-md transition hover:rotate-90 hover:bg-[#211b16] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d2a84a] sm:right-5 sm:top-5 sm:h-10 sm:w-10"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Main Content Area: Responsive Split (Desktop 2-col, Mobile unified vertical scroll) */}
          <div
            ref={scrollContainerRef}
            className="flex-1 min-h-0 overflow-y-auto overscroll-contain [scrollbar-color:#c9a84c_#ece5d8] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#c9a84c] [&::-webkit-scrollbar-track]:bg-[#ece5d8] sm:grid sm:grid-cols-[0.96fr_1.04fr] sm:overflow-hidden"
          >
            {/* ── 1. Full-Screen Image Section (Full View initially on mobile, Left column on desktop) ── */}
            <div className="relative flex h-[calc(100dvh-5.25rem)] min-h-[calc(100dvh-5.25rem)] w-full shrink-0 flex-col justify-between bg-[#f4eee5] p-2.5 sm:h-full sm:min-h-0 sm:border-r sm:border-[#d8c8aa]/55 sm:p-4">
              <div className="flex min-h-0 flex-1 w-full items-center justify-center p-1 sm:p-2">
                <div className="relative h-full w-full max-h-full max-w-full overflow-hidden rounded-[1.1rem]">
                  {selectedImage ? (
                    <button
                      type="button"
                      onClick={openZoom}
                      aria-label="Open zoom view"
                      className="group absolute inset-0 cursor-zoom-in"
                    >
                      <Image
                        src={selectedImage.secureUrl}
                        alt={activeProduct.designNumber}
                        fill
                        priority
                        sizes="(min-width: 640px) 420px, 95vw"
                        className="object-contain transition duration-500 group-hover:scale-[1.015]"
                      />
                      <span className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full border border-white/50 bg-white/90 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6f5731] shadow-sm backdrop-blur-md">
                        <Maximize2 className="h-3 w-3" />
                        Tap to zoom
                      </span>
                    </button>
                  ) : (
                    <div className="flex h-full items-center justify-center text-muted-foreground/40">
                      <Gem className="h-10 w-10" />
                    </div>
                  )}
                </div>
              </div>

              {/* Multiple photo selector */}
              {activeProduct.images.length > 1 ? (
                <div className="mt-1 flex shrink-0 justify-center gap-1.5 overflow-x-auto pb-0.5">
                  {activeProduct.images.map((image, index) => (
                    <button
                      key={image.secureUrl}
                      type="button"
                      onClick={() => setImageIndex(index)}
                      aria-label={`View image ${index + 1}`}
                      className={`relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg border-2 bg-white transition-colors sm:h-11 sm:w-11 ${
                        index === imageIndex ? 'border-[#b48228]' : 'border-transparent hover:border-[#b48228]/40'
                      }`}
                    >
                      <Image src={image.secureUrl} alt="" fill sizes="44px" className="object-cover" />
                    </button>
                  ))}
                </div>
              ) : null}

              {/* Mobile visual cue to scroll down for details */}
              <div className="mt-1 flex shrink-0 items-center justify-center gap-1.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#8a6a2e] sm:hidden animate-bounce">
                <span>Scroll for details</span>
                <ChevronDown className="h-3.5 w-3.5" />
              </div>
            </div>

            {/* ── 2 & 3. Product Details Section (Scroll-based: revealed when user scrolls down) ── */}
            <div className="flex flex-1 flex-col bg-[#fdfcf9] sm:h-full sm:min-h-0 sm:overflow-hidden">
              <div className="flex-1 px-4 pt-3.5 pb-28 sm:overflow-y-auto sm:px-5 sm:pt-5 sm:pb-4 md:px-6">
                {/* Header: Category, Design ID & Estimated Order Time */}
                <div className="border-b border-[#ece4d7] pb-2 pr-12 sm:pr-0">
                  <p className="truncate text-[9.5px] font-semibold uppercase tracking-[0.14em] text-[#b48228]">
                    {categoryPath.length ? categoryPath.join(' · ') : 'Jewellery'}
                  </p>
                  <h2 className="mt-0.5 font-display text-base font-bold leading-tight text-[#211b16] sm:text-lg">
                    Design {activeProduct.designNumber}
                  </h2>
                  {formattedOrderTime ? (
                    <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-md border border-[#e8dfd1] bg-[#fcfaf6] px-2 py-0.5 text-[10.5px] text-[#6b5836]">
                      <Clock className="h-3.5 w-3.5 shrink-0 text-[#b48228]" />
                      <span className="font-medium text-[#7c694a]">Estimated Order Time:</span>
                      <span className="font-bold uppercase tracking-wide text-[#8a6318]">
                        {formattedOrderTime}
                      </span>
                    </div>
                  ) : null}
                </div>

                {/* Compact Specs Grid (Purity, Gross Weight, Net Weight in a single sleek row) */}
                {specs.length > 0 ? (
                  <div
                    className={`mt-2 grid overflow-hidden rounded-xl border border-[#ded3c3] bg-white shadow-xs ${
                      specs.length === 1
                        ? 'grid-cols-1'
                        : specs.length === 2
                        ? 'grid-cols-2 divide-x divide-[#ece4d7]'
                        : specs.length === 3
                        ? 'grid-cols-3 divide-x divide-[#ece4d7]'
                        : 'grid-cols-4 divide-x divide-[#ece4d7]'
                    }`}
                  >
                    {specs.map((spec) => (
                      <div key={spec.label} className="min-w-0 px-2 py-1.5 text-center">
                        <span className="block truncate text-[8.5px] font-semibold uppercase tracking-[0.1em] text-[#978b7f]">
                          {spec.label}
                        </span>
                        <span className="mt-0.5 block truncate text-xs font-bold text-[#29231e] sm:text-[13px]">
                          {spec.value}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null}

                {/* Category / Sub-category / Type (Compact badges) */}
                {categoryRows.length > 0 ? (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {categoryRows.map((row) => (
                      <span
                        key={row.label}
                        className="inline-flex items-center gap-1 rounded-md border border-[#ded3c3]/70 bg-white/70 px-1.5 py-0.5 text-[9.5px] text-[#6f665e]"
                      >
                        <span className="font-semibold uppercase text-[#978b7f]">{row.label}:</span>
                        <span className="font-medium text-[#29231e]">{row.value}</span>
                      </span>
                    ))}
                  </div>
                ) : null}

                {/* Description */}
                {activeProduct.description && activeProduct.description.trim().length >= 4 ? (
                  <p className="mt-1.5 text-[11px] leading-relaxed text-[#6f665e]">
                    {activeProduct.description}
                  </p>
                ) : null}

                {/* ── 5. Similar Designs (Below product details, dark luxury styling) ── */}
                {similar.length > 0 ? (
                  <div className="mt-3.5 rounded-2xl border border-[#3d3327] bg-[#1a1511] p-2.5 text-white shadow-md sm:mt-4 sm:p-3">
                    <div className="mb-2 flex items-center justify-between px-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10.5px] font-bold uppercase tracking-[0.15em] text-[#edd592]">
                          Similar Designs
                        </span>
                        <span className="rounded-full bg-white/10 px-1.5 py-0.2 text-[8.5px] font-semibold text-[#edd592]">
                          {similar.length}
                        </span>
                      </div>
                      <span className="flex items-center gap-1 text-[9.5px] text-white/50">
                        <ArrowLeftRight className="h-3 w-3" /> Scroll for more
                      </span>
                    </div>

                    <div className="flex gap-2 overflow-x-auto pb-1 pt-0.5 no-scrollbar snap-x">
                      {similar.map((candidate) => {
                        const img = candidate.images.find((i) => i.isPrimary) ?? candidate.images[0];
                        return (
                          <button
                            key={candidate.id}
                            type="button"
                            onClick={() => selectCandidate(candidate)}
                            aria-label={`View ${candidate.designNumber}`}
                            className="group w-20 shrink-0 snap-start overflow-hidden rounded-xl border border-white/20 bg-white text-center shadow-xs transition hover:border-[#c9a84c] sm:w-22"
                          >
                            <div className="relative aspect-square bg-[#f3ede5] overflow-hidden">
                              {img ? (
                                <Image
                                  src={img.secureUrl}
                                  alt={candidate.designNumber}
                                  fill
                                  sizes="88px"
                                  className="object-cover transition duration-300 group-hover:scale-105"
                                />
                              ) : (
                                <div className="flex h-full items-center justify-center text-muted-foreground/40">
                                  <Gem className="h-4 w-4" />
                                </div>
                              )}
                            </div>
                            <div className="px-1 py-1 bg-white">
                              <p className="truncate text-[10px] font-bold text-[#211b16] group-hover:text-[#b48228]">
                                {candidate.designNumber}
                              </p>
                              <p className="truncate text-[9px] text-[#8a6a2e]">
                                {candidate.purity ?? (candidate.weightGrams ? `${candidate.weightGrams}g` : candidate.category)}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {/* Extra spacer on mobile so scrolling content never gets cut off by fixed Add button */}
                <div className="h-24 shrink-0 sm:hidden" />
              </div>

              {/* ── Desktop Pinned Footer (+ Add button pinned at bottom of details column) ── */}
              <footer className="hidden shrink-0 border-t border-[#e7dfd3] bg-[#fdfcf9]/95 px-5 py-3 shadow-[0_-8px_24px_rgba(73,52,26,0.08)] backdrop-blur-md sm:block md:px-6">
                <div className="flex flex-row gap-2 [&>*]:min-h-10">
                  {primaryAction(activeProduct)}
                  {activeProduct.hasTryon ? (
                    <Button asChild variant="outline" className="border-primary/40 text-primary">
                      <Link
                        href={`/store-manager/try-on?product=${activeProduct.id}&back=${encodeURIComponent(tryOnBack)}`}
                      >
                        <Sparkles className="mr-1.5 h-4 w-4" />
                        Try On
                      </Link>
                    </Button>
                  ) : null}
                </div>
              </footer>
            </div>
          </div>

          {/* ── Fixed Mobile Footer (+ Add button fixed at bottom of modal) ── */}
          <footer className="shrink-0 border-t border-[#e7dfd3] bg-[#fdfcf9]/95 px-3 py-2.5 shadow-[0_-8px_24px_rgba(73,52,26,0.08)] backdrop-blur-md sm:hidden">
            <div className="flex flex-col gap-1.5 [&>*]:min-h-11">
              {primaryAction(activeProduct)}
              {activeProduct.hasTryon ? (
                <Button asChild variant="outline" className="border-primary/40 text-primary">
                  <Link
                    href={`/store-manager/try-on?product=${activeProduct.id}&back=${encodeURIComponent(tryOnBack)}`}
                  >
                    <Sparkles className="mr-1.5 h-4 w-4" />
                    Try On
                  </Link>
                </Button>
              ) : null}
            </div>
          </footer>
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

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const DOUBLE_TAP_SCALE = 2.5;

/** Full-screen image viewer: pinch / wheel / +/- / double-tap zoom, drag to pan,
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
  const gesture = useRef<{
    startDist: number;
    startScale: number;
    lastMid: { x: number; y: number };
    startX: number;
    startY: number;
    moved: boolean;
    startedAt: number;
  } | null>(null);
  const lastTap = useRef(0);

  const clampView = useCallback((scale: number, x: number, y: number) => {
    const s = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect || s === 1) return { scale: s, x: 0, y: 0 };
    const maxX = ((s - 1) * rect.width) / 2;
    const maxY = ((s - 1) * rect.height) / 2;
    return { scale: s, x: Math.min(maxX, Math.max(-maxX, x)), y: Math.min(maxY, Math.max(-maxY, y)) };
  }, []);

  const zoomBy = useCallback(
    (factor: number) => {
      setView((v) => clampView(v.scale * factor, v.x * factor, v.y * factor));
    },
    [clampView]
  );

  const go = useCallback(
    (delta: number) => {
      if (images.length < 2) return;
      onIndexChange((index + delta + images.length) % images.length);
    },
    [images.length, index, onIndexChange]
  );

  // Fresh photo -> fresh zoom.
  useEffect(() => setView({ scale: 1, x: 0, y: 0 }), [index]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') go(1);
      else if (event.key === 'ArrowLeft') go(-1);
      else if (event.key === '+' || event.key === '=') zoomBy(1.3);
      else if (event.key === '-') zoomBy(1 / 1.3);
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
    return {
      x: (pts[0]!.x + pts[1]!.x) / 2,
      y: (pts[0]!.y + pts[1]!.y) / 2,
      dist: Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y),
    };
  };

  const onPointerDown = (event: React.PointerEvent) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    setGesturing(true);
    if (pointers.current.size === 2) {
      const mid = midpoint();
      gesture.current = {
        startDist: mid.dist,
        startScale: view.scale,
        lastMid: mid,
        startX: mid.x,
        startY: mid.y,
        moved: true,
        startedAt: Date.now(),
      };
    } else if (pointers.current.size === 1) {
      gesture.current = {
        startDist: 0,
        startScale: view.scale,
        lastMid: { x: event.clientX, y: event.clientY },
        startX: event.clientX,
        startY: event.clientY,
        moved: false,
        startedAt: Date.now(),
      };
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
      if (g && remaining) {
        g.lastMid = remaining;
        g.startDist = 0;
      }
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
  const iconButton =
    'flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-md transition hover:bg-white/25 disabled:opacity-35 disabled:hover:bg-white/15';

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-black/95"
      role="dialog"
      aria-modal="true"
      aria-label="Zoomed product image"
      onClick={onClose}
    >
      <div
        className="flex shrink-0 items-center justify-between px-3 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-5"
        onClick={(event) => event.stopPropagation()}
      >
        <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold tabular-nums text-white/85">
          {images.length > 1 ? `${index + 1} / ${images.length}` : `${Math.round(view.scale * 100)}%`}
        </span>
        <button type="button" onClick={onClose} aria-label="Close zoom view" className={iconButton}>
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="relative min-h-0 flex-1 px-2 sm:px-16">
        <div
          ref={stageRef}
          className={`relative h-full w-full touch-none select-none overflow-hidden ${
            zoomed ? 'cursor-grab active:cursor-grabbing' : 'cursor-zoom-in'
          }`}
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
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                go(-1);
              }}
              aria-label="Previous image"
              className={`${iconButton} absolute left-2 top-1/2 hidden -translate-y-1/2 sm:flex`}
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                go(1);
              }}
              aria-label="Next image"
              className={`${iconButton} absolute right-2 top-1/2 hidden -translate-y-1/2 sm:flex`}
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </>
        ) : null}
      </div>

      <div
        className="flex shrink-0 flex-col items-center gap-2 px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          {images.length > 1 ? (
            <button type="button" onClick={() => go(-1)} aria-label="Previous image" className={`${iconButton} sm:hidden`}>
              <ChevronLeft className="h-5 w-5" />
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => zoomBy(1 / 1.4)}
            disabled={view.scale <= MIN_SCALE}
            aria-label="Zoom out"
            className={iconButton}
          >
            <ZoomOut className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => setView({ scale: 1, x: 0, y: 0 })}
            disabled={!zoomed}
            aria-label="Reset zoom"
            className={iconButton}
          >
            <RotateCcw className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => zoomBy(1.4)}
            disabled={view.scale >= MAX_SCALE}
            aria-label="Zoom in"
            className={iconButton}
          >
            <ZoomIn className="h-5 w-5" />
          </button>
          {images.length > 1 ? (
            <button type="button" onClick={() => go(1)} aria-label="Next image" className={`${iconButton} sm:hidden`}>
              <ChevronRight className="h-5 w-5" />
            </button>
          ) : null}
        </div>
        <p className="text-center text-[11px] text-white/55">
          <span className="sm:hidden">
            Pinch or double-tap to zoom · drag to move{images.length > 1 ? ' · swipe for next photo' : ''}
          </span>
          <span className="hidden sm:inline">
            Scroll or double-click to zoom · drag to move{images.length > 1 ? ' · ← / → for next photo' : ''}
          </span>
        </p>
      </div>
    </div>
  );
}
