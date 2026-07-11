'use client';

import { Loader2, Sparkles } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';

import type { ARViewportHandle } from '@/components/ar/ARViewport';
import type { JewelleryType, Calibration } from '@/lib/ar-engine';

// AR viewport pulls in Three.js + MediaPipe — load client-only, no SSR.
const ARViewport = dynamic(() => import('@/components/ar/ARViewport').then((m) => m.ARViewport), {
  ssr: false,
  loading: () => <div className="flex aspect-[3/4] items-center justify-center rounded-xl bg-[#211711] text-white/60"><Loader2 className="h-6 w-6 animate-spin" /></div>,
});

type TryonProduct = {
  id: string;
  designNumber: string;
  name: string;
  primaryImageUrl: string | null;
  asset: {
    assetUrl: string;
    jewelleryType: JewelleryType;
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
  const preselect = useSearchParams().get('product');
  const viewportRef = useRef<ARViewportHandle>(null);
  const [products, setProducts] = useState<TryonProduct[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/kiosk/tryon-products', { cache: 'no-store' });
      const json = (await res.json()) as { data?: TryonProduct[] };
      const list = (json.data ?? []).filter((p) => p.asset);
      setProducts(list);
    })();
  }, []);

  async function select(p: TryonProduct) {
    if (!p.asset) return;
    setActiveId(p.id);
    await viewportRef.current?.setProduct(p.asset.assetUrl, p.asset.jewelleryType, calibrationFrom(p.asset));
  }

  // Auto-select from ?product= once products load.
  useEffect(() => {
    if (preselect && products) {
      const p = products.find((x) => x.id === preselect);
      if (p) void select(p);
    }
  }, [preselect, products]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <main className="mx-auto max-w-5xl px-3 py-6 sm:px-4 sm:py-8">
      <div className="mb-4 flex items-center gap-2 text-primary"><Sparkles className="h-5 w-5" /><span className="text-xs font-semibold uppercase tracking-widest">Virtual Try-On</span></div>
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-[2fr_1fr]">
        <ARViewport ref={viewportRef} />
        <div>
          <p className="mb-3 text-sm font-medium">Choose a piece</p>
          {!products && <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>}
          {products && products.length === 0 && <p className="text-sm text-muted-foreground">No try-on pieces available yet.</p>}
          {products && products.length > 0 && (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-2 lg:max-h-[420px] lg:overflow-y-auto lg:pr-1">
              {products.map((p) => (
                <button key={p.id} onClick={() => select(p)} className={`overflow-hidden rounded-lg border-2 transition-colors ${activeId === p.id ? 'border-primary' : 'border-transparent hover:border-primary/40'}`}>
                  <div className="aspect-square bg-[#ece5da]">
                    {p.primaryImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.primaryImageUrl} alt={p.name} className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <p className="truncate p-1 text-[10px]">{p.name}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

export default function TryOnPage() {
  return <Suspense fallback={<div className="py-16 text-center text-muted-foreground">Loading…</div>}><TryOnInner /></Suspense>;
}
