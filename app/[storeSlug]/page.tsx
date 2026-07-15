'use client';

import { Sparkles, Search, ArrowRight } from 'lucide-react';
import Link from 'next/link';

import { useKioskStore } from '@/components/kiosk/StoreContext';

export default function KioskHomePage() {
  const store = useKioskStore();
  const base = `/${store.slug}`;

  return (
    <main>
      {/* Hero */}
      <section className="relative flex min-h-[60vh] flex-col justify-center overflow-hidden bg-[#211711] px-5 py-16 text-white sm:min-h-[70vh] sm:px-6 sm:py-20">
        <div className="mx-auto w-full max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#e4cf8f]">AI Jewellery Showroom</p>
          <h1 className="mt-3 font-display text-4xl font-normal leading-tight break-words sm:text-5xl md:text-6xl">{store.name}</h1>
          {store.tagline && <p className="mt-3 max-w-lg text-lg text-white/70">{store.tagline}</p>}
          <p className="mt-2 max-w-lg text-white/60">
            Explore our full collection, try pieces on with AR, or find a match with a photo.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={`${base}/catalog`} className="metal-sheen inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-[#17120b]">
              Explore Catalogue <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href={`${base}/try-on`} className="inline-flex items-center gap-2 rounded-full border border-white/35 bg-white/[0.08] px-6 py-3 text-sm font-medium text-white hover:bg-white/[0.14]">
              <Sparkles className="h-4 w-4" /> Virtual Try-On
            </Link>
          </div>
        </div>
      </section>

      {/* Quick actions */}
      <section className="mx-auto max-w-4xl px-6 py-12">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card href={`${base}/catalog`} icon={ArrowRight} title="Browse Catalog" desc="Explore all designs" />
          <Card href={`${base}/search`} icon={Search} title="Search by Photo" desc="Find a matching piece" />
          <Card href={`${base}/custom-design`} icon={Sparkles} title="Custom Design" desc="Request a bespoke piece" />
        </div>
      </section>
    </main>
  );
}

function Card({ href, icon: Icon, title, desc }: { href: string; icon: typeof Search; title: string; desc: string }) {
  return (
    <Link href={href}>
      <div className="group rounded-2xl border border-[#e4d8c6] bg-[#FBF9F5] p-6 transition-shadow hover:shadow-md">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div>
        <p className="mt-3 font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{desc}</p>
      </div>
    </Link>
  );
}
