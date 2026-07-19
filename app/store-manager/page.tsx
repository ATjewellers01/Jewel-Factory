'use client';

import { ArrowRight, Sparkles, Camera, X, Award } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'motion/react';
import { useEffect, useState } from 'react';

import { titleCaseName, productMetaLine } from '@/lib/format';
import { useStoreManager } from './layout';

type Img = { secureUrl: string; isPrimary: boolean };
type Product = { id: string; designNumber: string; name: string; category: string | null; subCategory: string | null; purity: string | null; weightGrams: string | null; hasTryon: boolean; images: Img[] };

const primary = (p: Product) => (p.images.find((i) => i.isPrimary) ?? p.images[0])?.secureUrl;

export default function StoreManagerHome() {
  const me = useStoreManager();
  const [products, setProducts] = useState<Product[]>([]);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/branch-manager/catalog', { cache: 'no-store', credentials: 'same-origin' });
        if (res.status === 401) { window.location.assign('/store-manager/login'); return; }
        const json = (await res.json()) as { data?: Product[] };
        const list = (json.data ?? []).filter((p) => primary(p));
        // Shuffle once (Fisher–Yates) so sections show fresh, varied products each visit.
        for (let i = list.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [list[i], list[j]] = [list[j]!, list[i]!];
        }
        setProducts(list);
      } catch { /* ignore */ }
    })();
  }, []);

  const floats = products.slice(0, 3);
  const featured = products[0];

  // "Popular now" and "More to explore" show DIFFERENT random products when there
  // are enough; with a small catalog they overlap so both sections stay full.
  const enough = products.length >= 8;
  const popular = products.slice(0, 4);
  const more = enough ? products.slice(4, 12) : products.slice(0, 8);

  return (
    <div className="space-y-14 pb-4">
      {/* ── Storefront hero ────────────────────────────────────────────────── */}
      <section className="relative w-full min-h-[calc(100svh-160px)] overflow-hidden bg-[#211711]">
        {/* Faded showroom backdrop */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://images.unsplash.com/photo-1599643478524-fb66f7ca2b6e?w=1800&q=90"
          alt="Premium jewellery showroom"
          className="absolute inset-0 h-full w-full object-cover opacity-[0.18]"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(20,14,10,0.86)_0%,rgba(20,14,10,0.60)_42%,rgba(20,14,10,0.22)_72%,rgba(20,14,10,0.46)_100%)]" />

        {/* Real catalog products, floating (desktop) */}
        <div className="pointer-events-none absolute right-[-1%] top-[8%] hidden h-[80%] w-[48%] md:block">
          {floats[0] && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={primary(floats[0])} alt="" aria-hidden className="absolute right-[2%] top-0 h-[46%] w-auto rounded-2xl object-cover opacity-95 shadow-[0_38px_72px_rgba(0,0,0,0.55)]" />
          )}
          {floats[1] && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={primary(floats[1])} alt="" aria-hidden className="absolute bottom-[6%] right-[34%] h-[30%] w-auto rotate-[-8deg] rounded-2xl object-cover opacity-90 shadow-[0_28px_50px_rgba(0,0,0,0.48)]" />
          )}
          {floats[2] && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={primary(floats[2])} alt="" aria-hidden className="absolute bottom-[18%] right-[2%] h-[32%] w-auto rotate-[8deg] rounded-2xl object-cover opacity-90 shadow-[0_28px_50px_rgba(0,0,0,0.48)]" />
          )}
        </div>

        {/* Copy */}
        <div className="relative mx-auto flex min-h-[calc(100svh-160px)] max-w-[1400px] items-center px-6 py-16 lg:px-10">
          <div className="max-w-2xl">
            <p className="mb-5 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.28em] text-[#e4cf8f]">
              <Sparkles className="h-3.5 w-3.5" /> AI jewellery showroom
            </p>
            <h1 className="font-display max-w-2xl break-words text-3xl font-normal leading-[1.05] text-white sm:text-5xl sm:leading-[0.98] md:text-7xl">
              {me.retailer.name}
            </h1>
            <p className="mt-5 max-w-md text-lg leading-7 text-white/78">
              {me.branch.name} · Browse the live catalogue with the customer, preview pieces with virtual try-on, and place their order.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/store-manager/kiosk" className="metal-sheen inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-[#17120b] shadow-lg shadow-black/20 transition-transform hover:scale-[1.02]">
                Explore Catalogue <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/store-manager/try-on" className="inline-flex items-center gap-2 rounded-full border border-white/35 bg-white/[0.08] px-6 py-3 text-sm font-semibold text-white backdrop-blur-md transition-colors hover:bg-white/[0.14]">
                <Camera className="h-4 w-4" /> Try On
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Featured piece — floating dismissible card (real data) */}
      {featured && !dismissed && (
        <motion.aside
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18, duration: 0.45 }}
          className="fixed bottom-5 right-5 z-40 hidden w-[340px] rounded-xl border border-black/10 bg-[#fbf8f1]/95 p-3 text-left shadow-[0_20px_60px_rgba(0,0,0,0.24)] ring-1 ring-black/5 backdrop-blur-xl md:block"
        >
          <div className="mb-3 flex items-center justify-between gap-3 border-b border-black/10 pb-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#9b762f]">Featured piece</span>
            <button type="button" onClick={() => setDismissed(true)} className="flex h-7 w-7 items-center justify-center rounded-full text-[#5f574f] transition-colors hover:bg-black/5 hover:text-[#1f1a14]" aria-label="Dismiss">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <Link href="/store-manager/kiosk" className="group flex w-full items-center gap-4 text-left">
            <span className="h-20 w-16 shrink-0 overflow-hidden rounded-lg bg-[#e9e2d7] ring-1 ring-black/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={primary(featured)} alt={featured.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
            </span>
            <span className="min-w-0">
              <span className="line-clamp-1 text-sm font-semibold text-[#1f1a14]">{titleCaseName(featured.name)}</span>
              <span className="mt-1 block text-xs text-[#6f675e]">{featured.category ?? 'Jewellery'} · {featured.designNumber}</span>
              <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#b68a3e]">Open catalogue <ArrowRight className="h-3 w-3" /></span>
            </span>
          </Link>
        </motion.aside>
      )}

      {/* ── Popular now (dark section, top catalog products) ─────────────────── */}
      {products.length > 0 && (
        <section className="w-full bg-[#1b1612] py-14 text-white md:py-20">
          <div className="mx-auto max-w-[1400px] px-6 lg:px-10">
            <div className="mb-8 flex items-end justify-between gap-6">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-[#e4cf8f]">Popular now</p>
                <h2 className="font-display text-3xl font-normal md:text-5xl">Pieces drawing attention</h2>
              </div>
              <Link href="/store-manager/kiosk" className="luxury-link-underline hidden text-sm font-semibold text-white/65 hover:text-white sm:inline-flex">View catalogue</Link>
            </div>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6 xl:grid-cols-4">
              {popular.map((p) => <MiniCard key={p.id} p={p} dark />)}
            </div>
          </div>
        </section>
      )}

      {/* ── Virtual Try-On banner ───────────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-[1400px] px-6 lg:px-10">
        <div className="grid overflow-hidden rounded-2xl bg-[#211913] text-white md:grid-cols-[1.1fr_0.9fr]">
          <div className="px-6 py-10 md:px-10 md:py-14">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-[#e4cf8f]">Virtual try-on</p>
            <h2 className="font-display max-w-xl text-3xl font-normal leading-tight md:text-5xl">Bring the piece closer before you decide.</h2>
            <p className="mt-5 max-w-md text-sm leading-6 text-white/68">Preview necklaces, earrings, rings, and bangles live on the kiosk with the customer.</p>
            <Link href="/store-manager/try-on" className="metal-sheen mt-8 inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-[#17120b] transition-transform hover:scale-[1.02]">
              <Sparkles className="h-4 w-4" /> Open Try-On
            </Link>
          </div>
          <div className="relative aspect-[16/10] w-full overflow-hidden bg-[#2a1f15] sm:aspect-[16/9] md:aspect-auto md:h-full md:min-h-[300px]">
            {/* Gold-only business: show a real catalog piece (prefer a try-on one),
                falling back to a gold jewellery photo. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={(() => { const p = products.find((x) => x.hasTryon) ?? products[0]; return (p && primary(p)) || 'https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=900&q=85'; })()}
              alt="Gold jewellery"
              className="absolute inset-0 h-full w-full object-cover object-center"
            />
          </div>
        </div>
      </section>

      {/* ── More to explore ─────────────────────────────────────────────────── */}
      {more.length > 0 && (
        <section className="mx-auto w-full max-w-[1400px] px-6 lg:px-10">
          <div className="mb-8">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-primary">Discover</p>
            <h2 className="font-display text-3xl font-normal md:text-5xl">More to explore</h2>
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6 xl:grid-cols-4">
            {more.map((p) => <MiniCard key={p.id} p={p} />)}
          </div>
        </section>
      )}
    </div>
  );
}

function MiniCard({ p, dark }: { p: Product; dark?: boolean }) {
  const img = primary(p);
  return (
    <Link href="/store-manager/kiosk" className="group block overflow-hidden rounded-lg bg-[#FBF9F5] ring-1 ring-black/5 transition-all hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(31,24,15,0.16)]">
      <div className="relative aspect-[3/4] overflow-hidden bg-[#ece5da]">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt={p.name} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
        ) : null}
        {p.hasTryon && <span className="metal-sheen absolute right-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold text-[#17120b]"><Sparkles className="mr-0.5 inline h-2.5 w-2.5" />AR</span>}
        <span className="absolute bottom-2 right-2 inline-flex items-center gap-0.5 rounded-full bg-[#f7fff8]/90 px-1.5 py-0.5 text-[9px] font-semibold text-[#15803D]"><Award className="h-2.5 w-2.5" />BIS</span>
      </div>
      <div className="p-3">
        <p className="truncate text-sm font-semibold text-[#1f1a14] group-hover:text-primary">{titleCaseName(p.name)}</p>
        <p className="truncate text-xs text-[#6f675e]">{productMetaLine({ category: p.category, subCategory: p.subCategory, purity: p.purity, weight: p.weightGrams })}</p>
      </div>
    </Link>
  );
}
