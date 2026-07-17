'use client';

import { Gem, PencilLine, Package, ArrowRight, Sparkles, Search, ShieldCheck, Camera, X } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'motion/react';
import { useEffect, useState } from 'react';

import { titleCaseName } from '@/lib/format';
import { useStoreManager } from './layout';

type Img = { secureUrl: string; isPrimary: boolean };
type Product = { id: string; designNumber: string; name: string; category: string | null; images: Img[] };

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
        setProducts((json.data ?? []).filter((p) => primary(p)));
      } catch { /* ignore */ }
    })();
  }, []);

  const floats = products.slice(0, 3);
  const featured = products[0];

  return (
    <div className="space-y-10">
      {/* ── LuxeMatch-style hero ───────────────────────────────────────────── */}
      <section className="relative -mx-4 min-h-[calc(100svh-160px)] overflow-hidden bg-[#211711]">
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
            <h1 className="font-display max-w-2xl text-5xl font-normal leading-[0.98] text-white sm:text-6xl md:text-7xl">
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

      {/* Quick actions (unchanged Jewel Factory look) */}
      <section className="mx-auto w-full max-w-4xl">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card href="/store-manager/kiosk" icon={Gem} title="Catalog" desc="Browse with the customer & place their order." />
          <Card href="/store-manager/search" icon={Search} title="Search by Photo" desc="Find a matching design from a photo." />
          <Card href="/store-manager/try-on" icon={Sparkles} title="Virtual Try-On" desc="Let the customer try pieces on with AR." />
          <Card href="/store-manager/custom-design" icon={PencilLine} title="Custom Design" desc="Capture a custom requirement for HO." />
          <Card href="/store-manager/restock" icon={Package} title="Restock" desc="Order stock for this store." locked={me.branch.hasRestockPin} />
        </div>
      </section>
    </div>
  );
}

function Card({ href, icon: Icon, title, desc, locked }: { href: string; icon: React.ComponentType<{ className?: string }>; title: string; desc: string; locked?: boolean }) {
  return (
    <Link href={href} className="group flex flex-col rounded-2xl border border-[#e4d8c6] bg-[#FBF9F5] p-6 transition-shadow hover:shadow-md">
      <div className="flex items-center gap-2">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div>
        {locked && <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800"><ShieldCheck className="h-3 w-3" />PIN</span>}
      </div>
      <h2 className="mt-3 font-medium">{title}</h2>
      <p className="mt-1 flex-1 text-sm text-muted-foreground">{desc}</p>
      <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary">Open<ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" /></span>
    </Link>
  );
}
