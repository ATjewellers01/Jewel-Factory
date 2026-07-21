'use client';

import { Camera, ImageIcon, Loader2, Plus, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useRef, useState } from 'react';

import { KioskProductCard } from '@/components/kiosk/KioskProductCard';
import { StoreManagerProductDetailModal } from '@/components/kiosk/StoreManagerProductDetailModal';
import { Button } from '@/components/ui/button';

type Img = { secureUrl: string; isPrimary: boolean };
type Product = { id: string; designNumber: string; name: string; category: string | null; subCategory: string | null; purity: string | null; weightGrams: string | null; description?: string | null; hasTryon: boolean; images: Img[] };

export default function StoreManagerSearchPage() {
  const cameraInput = useRef<HTMLInputElement>(null);
  const libraryInput = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [results, setResults] = useState<Product[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [detail, setDetail] = useState<Product | null>(null);

  async function onFile(file: File) {
    setError(null); setResults(null);
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      setPreview(dataUrl);
      setLoading(true);
      try {
        const res = await fetch('/api/branch-manager/search/image', {
          method: 'POST', credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: dataUrl }),
        });
        if (res.status === 401) { window.location.assign('/store-manager/login'); return; }
        const json = (await res.json()) as { data?: Product[]; error?: { message: string } };
        if (!res.ok || json.error) { setError(json.error?.message ?? 'Search failed'); return; }
        setResults(json.data!);
      } catch { setError('Network error'); } finally { setLoading(false); }
    };
    reader.readAsDataURL(file);
  }

  return (
    <main className="relative mx-auto min-h-[calc(100vh-8rem)] w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      {/* Soft gold glow */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-64 bg-[radial-gradient(46rem_20rem_at_50%_-20%,rgba(201,168,76,0.16),transparent_65%)]" />

      {/* Intro (light, integrated — no dark band) */}
      <div className="mx-auto max-w-2xl text-center">
        <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.24em] text-[#a0824a]">
          <Sparkles className="h-3.5 w-3.5" /> Visual search
        </p>
        <h1 className="mt-3 font-display text-3xl font-normal tracking-tight sm:text-4xl">Find a match by photo</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Upload a reference photo and discover visually similar pieces from this live catalogue.
        </p>
      </div>

      {/* Upload zone — the focal point */}
      <div className="mx-auto mt-8 max-w-2xl">
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) void onFile(f); }}
          className={`group flex flex-col items-center justify-center rounded-3xl border-2 border-dashed px-5 py-10 text-center transition-colors sm:px-6 sm:py-12 ${dragOver ? 'border-[#c9a84c] bg-[#c9a84c]/5' : 'border-[#c9a84c]/40 bg-[#fffdf8]'}`}
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="query" className="h-28 w-28 rounded-2xl border object-cover shadow-sm" />
          ) : (
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-transform group-hover:scale-105">
              <Camera className="h-7 w-7" />
            </span>
          )}
          <p className="mt-4 text-sm font-medium text-foreground">{preview ? 'Search another photo' : 'Take a photo or choose one from your device'}</p>
          <p className="mt-1 text-xs text-muted-foreground">Use a clear, front-facing image for the closest match.</p>
          <div className="mt-5 flex w-full max-w-md flex-col gap-3 sm:flex-row sm:justify-center">
            <Button type="button" disabled={loading} className="metal-sheen min-h-11 flex-1 rounded-full px-6 font-semibold text-[#17120b]" onClick={() => cameraInput.current?.click()}>
              <Camera className="mr-1.5 h-4 w-4" /> Take photo
            </Button>
            <Button type="button" disabled={loading} variant="outline" className="min-h-11 flex-1 rounded-full border-[#c9a84c]/50 bg-white px-6 font-semibold text-foreground hover:bg-[#c9a84c]/5" onClick={() => libraryInput.current?.click()}>
              <ImageIcon className="mr-1.5 h-4 w-4" /> Choose photo
            </Button>
          </div>
          <input ref={cameraInput} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { const file = e.target.files?.[0]; e.currentTarget.value = ''; if (file) void onFile(file); }} />
          <input ref={libraryInput} type="file" accept="image/*" hidden onChange={(e) => { const file = e.target.files?.[0]; e.currentTarget.value = ''; if (file) void onFile(file); }} />
        </div>
      </div>

      {loading && <div className="mt-8 flex items-center justify-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Searching…</div>}
      {error && <div className="mx-auto mt-6 max-w-2xl rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</div>}

      {results && results.length === 0 && !loading && (
        <div className="mt-14 flex flex-col items-center gap-3 text-center text-muted-foreground">
          <ImageIcon className="h-10 w-10 opacity-30" /><p className="text-sm">No similar pieces found. Try a different photo.</p>
        </div>
      )}

      {results && results.length > 0 && (
        <section className="mt-12">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#a0824a]">Results</p>
              <h2 className="mt-1 font-display text-2xl font-normal">{results.length} similar piece{results.length !== 1 ? 's' : ''}</h2>
            </div>
            <Link href="/store-manager/kiosk" className="metal-sheen inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-[#17120b]">Go to Catalog to order</Link>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {results.map((p, i) => (
              <KioskProductCard key={p.id} product={p} index={i} onOpen={(product) => setDetail(product)} tryOnBack="/store-manager/search" />
            ))}
          </div>
        </section>
      )}

      {detail ? (
        <StoreManagerProductDetailModal
          key={detail.id}
          product={detail}
          products={results ?? []}
          onClose={() => setDetail(null)}
          tryOnBack="/store-manager/search"
          primaryAction={() => (
            <Button asChild className="metal-sheen flex-1 font-semibold text-[#17120b]">
              <Link href="/store-manager/kiosk"><Plus className="mr-1.5 h-4 w-4" />Order from Catalog</Link>
            </Button>
          )}
        />
      ) : null}
    </main>
  );
}
