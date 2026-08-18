'use client';

import { ArrowLeft, Camera, ChevronDown, ChevronUp, Loader2, RotateCcw, Sparkles, X } from 'lucide-react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import type { ARViewportHandle } from '@/components/ar/ARViewport';
import type { JewelleryType, Calibration } from '@/lib/ar-engine';

const ARViewport = dynamic(() => import('@/components/ar/ARViewport').then((m) => m.ARViewport), {
  ssr: false,
  loading: () => <div className="flex h-full w-full items-center justify-center bg-black text-white/60"><Loader2 className="h-6 w-6 animate-spin" /></div>,
});

type TryonProduct = {
  id: string; designNumber: string; name?: string | null; primaryImageUrl: string | null;
  asset: {
    assetUrl: string; jewelleryType: JewelleryType;
    pivotX: number; pivotY: number; xOffset: number; yOffset: number;
    scaleMultiplier: number; rotationOffsetDeg: number;
  } | null;
};

function calibrationFrom(a: NonNullable<TryonProduct['asset']>): Calibration {
  return {
    pivot_x: Number(a.pivotX), pivot_y: Number(a.pivotY),
    x_offset: Number(a.xOffset), y_offset: Number(a.yOffset),
    scale_multiplier: Number(a.scaleMultiplier), rotation_offset_deg: Number(a.rotationOffsetDeg),
  };
}

function TryOnInner() {
  const viewportRef = useRef<ARViewportHandle>(null);
  const cameraAreaRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [products, setProducts] = useState<TryonProduct[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [capture, setCapture] = useState<string | null>(null);
  const [stripOpen, setStripOpen] = useState(true);
  const [cameraAspectRatio, setCameraAspectRatio] = useState(16 / 9);
  const [cameraFrame, setCameraFrame] = useState({ width: 0, height: 0 });
  const params = useSearchParams();
  const wantId = params.get('product'); // came from a detail modal's "Try On" button
  const backHref = params.get('back') || '/store-manager/kiosk';
  const autoSelected = useRef(false);

  const updateCameraAspectRatio = useCallback((ratio: number) => {
    if (!Number.isFinite(ratio) || ratio < 0.5 || ratio > 3) return;
    setCameraAspectRatio((current) => Math.abs(current - ratio) < 0.001 ? current : ratio);
  }, []);

  useLayoutEffect(() => {
    const area = cameraAreaRef.current;
    if (!area) return;

    const fitCameraFrame = () => {
      const bounds = area.getBoundingClientRect();
      const styles = window.getComputedStyle(area);
      const availableWidth = Math.max(0, bounds.width - parseFloat(styles.paddingLeft) - parseFloat(styles.paddingRight));
      const availableHeight = Math.max(0, bounds.height - parseFloat(styles.paddingTop) - parseFloat(styles.paddingBottom));

      let width = availableWidth;
      let height = width / cameraAspectRatio;
      if (height > availableHeight) {
        height = availableHeight;
        width = height * cameraAspectRatio;
      }

      setCameraFrame({ width: Math.floor(width), height: Math.floor(height) });
    };

    const observer = new ResizeObserver(fitCameraFrame);
    observer.observe(area);
    fitCameraFrame();
    return () => observer.disconnect();
    // stripOpen changes the area's available height — re-fit when it toggles.
  }, [cameraAspectRatio, stripOpen]);

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/branch-manager/tryon-products', { cache: 'no-store', credentials: 'same-origin' });
      if (res.status === 401) { window.location.assign('/store-manager/login'); return; }
      const json = (await res.json()) as { data?: TryonProduct[] };
      setProducts((json.data ?? []).filter((p) => p.asset));
    })();
  }, []);

  // Auto-select the product passed via ?product=<id> once the list has loaded.
  useEffect(() => {
    if (autoSelected.current || !wantId || !products) return;
    const match = products.find((p) => p.id === wantId);
    if (match) { autoSelected.current = true; void select(match); }
    // select is stable within this component; products changes once after load
  }, [wantId, products]);

  async function select(p: TryonProduct) {
    if (!p.asset) return;
    setActiveId(p.id);
    await viewportRef.current?.setProduct(p.asset.assetUrl, p.asset.jewelleryType, calibrationFrom(p.asset));
  }

  async function onCapture() {
    const blob = await viewportRef.current?.capture();
    if (blob) setCapture(URL.createObjectURL(blob));
  }

  const active = products?.find((p) => p.id === activeId);

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-[#0f0d0b]">
      {/* Top bar — compact so the camera gets the space */}
      <header className="flex flex-shrink-0 items-center justify-between gap-3 px-3 py-2.5 sm:px-4">
        <button onClick={() => router.push(backHref)} aria-label="Back" className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-2 text-sm text-white transition-colors hover:bg-white/20">
          <ArrowLeft className="h-4 w-4" /> <span className="hidden sm:inline">Back</span>
        </button>
        <div className="flex items-center gap-2 text-[#e4cf8f] max-[430px]:hidden">
          <Sparkles className="h-3.5 w-3.5" />
          <span className="text-xs font-semibold uppercase tracking-[0.2em]">Virtual Try-On</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setActiveId(null)} aria-label="Reset" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20">
            <RotateCcw className="h-4 w-4" />
          </button>
          <button onClick={onCapture} disabled={!activeId} className="metal-sheen inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-[#17120b] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 sm:px-4">
            <Camera className="h-4 w-4" /> <span className="max-[380px]:hidden">Capture</span>
          </button>
        </div>
      </header>

      {/* The frame keeps the camera stream's native ratio. Window resizing only
          scales this rectangle, so the visible camera area never gets re-cropped. */}
      <div ref={cameraAreaRef} className="relative flex min-h-0 flex-1 items-center justify-center px-2 pb-2 sm:px-3">
        <div
          className="relative shrink-0 overflow-hidden rounded-xl bg-black shadow-[0_24px_80px_rgba(0,0,0,0.35)] sm:rounded-2xl"
          style={cameraFrame.width > 0 ? cameraFrame : { width: '100%', aspectRatio: cameraAspectRatio }}
        >
          <ARViewport ref={viewportRef} fill className="h-full w-full" onCameraAspectRatioChange={updateCameraAspectRatio} />
          {active && (
            <div className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/55 px-3 py-1.5 text-xs text-white backdrop-blur-md">
              {active.designNumber}
            </div>
          )}
        </div>
      </div>

      {/* Bottom product strip — collapsible so the camera can use the full height */}
      <div className="flex-shrink-0 px-3 pb-3 pt-1.5 sm:px-4">
        <button
          onClick={() => setStripOpen((v) => !v)}
          aria-expanded={stripOpen}
          className="mb-2 flex w-full items-center gap-2 text-left"
        >
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45">Choose a piece</span>
          {products ? <span className="rounded-full bg-[#c9a84c]/20 px-2 py-0.5 text-[10px] font-medium text-[#e4cf8f]">{products.length}</span> : null}
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-medium text-white/80 transition-colors hover:bg-white/20">
            {stripOpen ? <><ChevronDown className="h-3 w-3" /> Hide</> : <><ChevronUp className="h-3 w-3" /> Show</>}
          </span>
        </button>
        <div className={`flex gap-2 overflow-x-auto pb-1 ${stripOpen ? '' : 'hidden'}`}>
          {products === null && <div className="flex items-center gap-2 py-4 text-xs text-white/60"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>}
          {products && products.length === 0 && <div className="py-4 text-xs text-white/60">No try-on pieces available yet.</div>}
          {products?.map((p) => (
            <button
              key={p.id}
              onClick={() => void select(p)}
              className={`flex w-[68px] flex-shrink-0 flex-col items-center gap-1 rounded-xl border p-1.5 text-left transition sm:w-20 ${activeId === p.id ? 'border-[#c9a84c] bg-white/10' : 'border-white/10 bg-white/5 hover:border-white/30'}`}
              title={p.designNumber}
            >
              <div className="relative h-12 w-full overflow-hidden rounded-md bg-black/40 sm:h-14">
                {p.primaryImageUrl ? (
                  <Image src={p.primaryImageUrl} alt={p.designNumber} fill className="object-cover" />
                ) : null}
              </div>
              <span className="w-full truncate text-[9px] leading-tight text-white/85">{p.designNumber}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Capture preview */}
      {capture && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/85 p-6" role="dialog" aria-modal="true">
          <div className="flex w-full max-w-md flex-col gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={capture} alt="Captured look" className="w-full rounded-xl" />
            <div className="flex justify-end gap-2">
              <a href={capture} download="jewel-factory-try-on.png" className="metal-sheen rounded-full px-5 py-2.5 text-sm font-semibold text-[#17120b]">Save</a>
              <button onClick={() => setCapture(null)} className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-5 py-2.5 text-sm font-medium text-white hover:bg-white/20"><X className="h-4 w-4" /> Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function StoreManagerTryOnPage() {
  return <Suspense fallback={<div className="fixed inset-0 flex items-center justify-center bg-[#0f0d0b] text-white/60"><Loader2 className="h-5 w-5 animate-spin" /></div>}><TryOnInner /></Suspense>;
}
