'use client';

import { ArrowRight, Gem, Sparkles, ShieldCheck, Building2, Search, X, Award, Camera } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { motion } from 'motion/react';
import { useEffect, useState } from 'react';

import { PublicFooter } from '@/components/landing/PublicFooter';
import { PublicNav } from '@/components/landing/PublicNav';
import { useDocumentIdentity } from '@/hooks/use-document-identity';
import { titleCaseName, formatWeight } from '@/lib/format';

const LoginModal = dynamic(
  () => import('@/components/landing/LoginModal').then((module) => module.LoginModal),
  { ssr: false },
);
const RegisterPromptModal = dynamic(
  () => import('@/components/landing/RegisterPromptModal').then((module) => module.RegisterPromptModal),
  { ssr: false },
);

type ShowcaseProduct = {
  id: string; designNumber?: string; name: string;
  category: string | null; subCategory?: string | null;
  purity?: string | null; weightGrams?: string | null; description?: string | null;
  hasTryon: boolean;
  images: { secureUrl: string; isPrimary: boolean }[];
};

const FEATURES = [
  { icon: Gem, title: 'Gold-only catalog', desc: 'One manufacturer catalog, auto design numbers, no price clutter — quotes stay with the store.' },
  { icon: Sparkles, title: 'AR virtual try-on', desc: 'Customers see how a piece looks on them, right at the store kiosk.' },
  { icon: Search, title: 'Similar-design search', desc: 'Upload a photo and instantly find matching designs in the catalog by visual similarity.' },
  { icon: ShieldCheck, title: 'Customer privacy', desc: 'Walk-in customer details never leave the store — the manufacturer only sees products.' },
  { icon: Building2, title: 'Multi-store ready', desc: 'One retailer, many stores — approvals, restock and orders tracked end to end.' },
];

const TRUST = [
  { icon: ShieldCheck, label: 'BIS Hallmarked' },
  { icon: Award, label: 'Certified Jewellers' },
  { icon: Camera, label: 'Virtual Try-On' },
  { icon: Search, label: 'Similar-design search' },
];

const primaryImg = (p: ShowcaseProduct) => (p.images.find((i) => i.isPrimary) ?? p.images[0])?.secureUrl;

export default function LandingPage() {
  const [showcase, setShowcase] = useState<ShowcaseProduct[] | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [detail, setDetail] = useState<ShowcaseProduct | null>(null);
  const [detailImg, setDetailImg] = useState(0);
  const [zoom, setZoom] = useState<string | null>(null);

  useDocumentIdentity('Home');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/kiosk/catalog', { cache: 'no-store' });
        const json = (await res.json()) as { data?: ShowcaseProduct[] };
        setShowcase((json.data ?? []).slice(0, 8));
      } catch { setShowcase([]); }
    })();
  }, []);

  // A few real catalog pieces to "float" in the hero (desktop only).
  const floats = (showcase ?? []).filter(primaryImg).slice(0, 3);

  return (
    <div className="min-h-screen">
      {/* ── Navbar (shared public nav) ────────────────────────────────────── */}
      <PublicNav catalogHref="#showcase" />

      {/* ── Hero (light & elegant: gold glow + monogram accent + floating pieces) ── */}
      <section className="relative overflow-hidden">
        {/* Soft gold radial glow */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60rem_40rem_at_15%_-10%,rgba(201,168,76,0.16),transparent_60%),radial-gradient(50rem_30rem_at_100%_10%,rgba(201,168,76,0.10),transparent_55%)]" />
        {/* Faint JF monogram watermark (desktop) */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/JF.avif" alt="" aria-hidden className="pointer-events-none absolute right-[-4%] top-[6%] -z-10 hidden w-[38rem] max-w-none opacity-[0.05] lg:block" />

        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[1.05fr_0.95fr] lg:py-28">
          {/* Copy */}
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="text-center lg:text-left">
            <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.28em] text-[#a0824a]">
              <Sparkles className="h-3.5 w-3.5" /> Intelligent gold jewellery
            </p>
            <h1 className="mx-auto mt-4 max-w-xl font-display text-4xl font-normal leading-[1.05] tracking-tight text-balance sm:text-5xl md:text-6xl lg:mx-0">
              Welcome to <span className="text-[#c9a84c]">Jewel Factory</span>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-muted-foreground lg:mx-0">
              The B2B platform connecting a gold-jewellery manufacturer to its retailer
              network and their in-store customers — catalog, AR try-on, orders and
              approvals, all in one place.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
              <button onClick={() => setShowLogin(true)} className="metal-sheen inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-[#17120b] shadow-lg shadow-black/10 transition-transform hover:scale-[1.02]">
                Login <ArrowRight className="h-4 w-4" />
              </button>
              <Link href="/store/register" className="inline-flex items-center gap-2 rounded-full border border-primary/40 px-6 py-3 text-sm font-semibold text-primary transition-colors hover:bg-primary/5">
                Register here
              </Link>
            </div>
            {/* Trust chips */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground lg:justify-start">
              {TRUST.map(({ icon: Icon, label }) => (
                <span key={label} className="inline-flex items-center gap-1.5"><Icon className="h-3.5 w-3.5 text-[#b68a3e]" />{label}</span>
              ))}
            </div>
          </motion.div>

          {/* Visual — floating real catalog pieces (desktop), stacked collage (mobile) */}
          <div className="relative hidden h-[26rem] lg:block">
            {floats[0] && (
              <motion.button
                initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.5 }}
                onClick={() => { setDetail(floats[0]!); setDetailImg(0); }}
                className="group absolute left-[6%] top-0 h-[62%] w-[46%] overflow-hidden rounded-2xl bg-[#ece5da] shadow-[0_34px_70px_rgba(31,24,15,0.28)] ring-1 ring-black/5"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={primaryImg(floats[0])} alt={floats[0].name} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
              </motion.button>
            )}
            {floats[1] && (
              <motion.button
                initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.5 }}
                onClick={() => { setDetail(floats[1]!); setDetailImg(0); }}
                className="group absolute right-[4%] top-[14%] h-[52%] w-[40%] overflow-hidden rounded-2xl bg-[#ece5da] shadow-[0_28px_56px_rgba(31,24,15,0.24)] ring-1 ring-black/5"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={primaryImg(floats[1])} alt={floats[1].name} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
              </motion.button>
            )}
            {floats[2] && (
              <motion.button
                initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.5 }}
                onClick={() => { setDetail(floats[2]!); setDetailImg(0); }}
                className="group absolute bottom-0 left-[26%] h-[46%] w-[44%] overflow-hidden rounded-2xl bg-[#ece5da] shadow-[0_28px_56px_rgba(31,24,15,0.24)] ring-1 ring-black/5"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={primaryImg(floats[2])} alt={floats[2].name} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
              </motion.button>
            )}
            {floats.length === 0 && (
              <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-primary/20 text-primary/30">
                <Gem className="h-16 w-16" />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Features Demo: Similar Search + Try-On (Left/Right Animation) ── */}
      <section className="border-t border-black/5 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.5 }} className="mb-12 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#a0824a]">Discover & Try</p>
            <h2 className="mt-2 font-display text-3xl font-normal tracking-tight sm:text-4xl">Find similar designs. See before you buy.</h2>
          </motion.div>

          <div className="grid gap-8 lg:grid-cols-2">
            {/* LEFT: Similar Image Search */}
            <motion.div initial={{ opacity: 0, x: -24 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.6 }} className="rounded-2xl border bg-gradient-to-br from-[#fdf9f5] to-[#ede7dd] p-8">
              <div className="mb-6">
                <p className="text-sm font-semibold text-primary">Similar Design Search</p>
                <h3 className="mt-1 text-xl font-medium">Upload a photo</h3>
              </div>

              {/* Upload + Search Progress Animation */}
              <div className="mb-6 space-y-3">
                {/* Step 1: Upload Box */}
                <motion.div
                  initial={{ opacity: 1 }} animate={{ opacity: [1, 1, 0] }} transition={{ duration: 4, repeat: Infinity, times: [0, 0.6, 1] }}
                  className="rounded-xl border-2 border-dashed border-primary/30 bg-white/60 p-8 text-center"
                >
                  <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 1.5, repeat: Infinity }} className="inline-block">
                    <Search className="mx-auto h-8 w-8 text-primary" />
                  </motion.div>
                  <p className="mt-3 text-sm text-muted-foreground">Upload jewelry image</p>
                </motion.div>

                {/* Step 2: Searching */}
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 1, 0] }} transition={{ duration: 4, repeat: Infinity, times: [0, 0.4, 0.7, 1] }}
                  className="rounded-xl border-2 border-primary/20 bg-primary/5 p-6 text-center"
                >
                  <div className="flex items-center justify-center gap-2">
                    <motion.div animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 0.8, repeat: Infinity }} className="h-2.5 w-2.5 rounded-full bg-primary" />
                    <motion.div animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 0.8, delay: 0.2, repeat: Infinity }} className="h-2.5 w-2.5 rounded-full bg-primary" />
                    <motion.div animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 0.8, delay: 0.4, repeat: Infinity }} className="h-2.5 w-2.5 rounded-full bg-primary" />
                  </div>
                  <p className="mt-3 text-sm text-primary font-medium">Searching similar designs…</p>
                </motion.div>
              </div>

              {/* Results Animation */}
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Similar matches found</p>
                <div className="grid grid-cols-2 gap-3">
                  {showcase && showcase.slice(0, 4).map((p, i) => {
                    const img = primaryImg(p);
                    return (
                      <motion.div
                        key={p.id}
                        initial={{ opacity: 0, scale: 0.8, y: 12 }} whileInView={{ opacity: 1, scale: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 2.5 + i * 0.15, duration: 0.5 }}
                        className="overflow-hidden rounded-lg border bg-[#ece5da] ring-2 ring-offset-2 ring-primary/30"
                      >
                        {img ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={img} alt={p.name} className="aspect-square h-full w-full object-cover" />
                        ) : <div className="aspect-square flex items-center justify-center"><Gem className="h-5 w-5 text-muted-foreground/30" /></div>}
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </motion.div>

            {/* RIGHT: AR Try-On */}
            <motion.div initial={{ opacity: 0, x: 24 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.6 }} className="rounded-2xl border bg-gradient-to-br from-[#f5fdf9] to-[#ddeee7] p-8">
              <div className="mb-6">
                <p className="text-sm font-semibold text-primary">AR Virtual Try-On</p>
                <h3 className="mt-1 text-xl font-medium">See it on you</h3>
              </div>

              {/* Person + Animated Jewelry Try-On */}
              <div className="mb-6 flex items-center justify-center rounded-xl bg-white/60 py-12">
                <div className="relative w-40 h-56">
                  {/* Person Silhouette */}
                  <svg viewBox="0 0 100 140" className="w-full h-full">
                    {/* Head */}
                    <circle cx="50" cy="20" r="12" fill="#d4a574" />
                    {/* Neck */}
                    <rect x="46" y="32" width="8" height="6" fill="#d4a574" />
                    {/* Shoulders + Body */}
                    <ellipse cx="50" cy="60" rx="20" ry="25" fill="#e8d5c4" />
                    {/* Arms */}
                    <rect x="20" y="50" width="30" height="6" rx="3" fill="#d4a574" />
                    <rect x="50" y="50" width="30" height="6" rx="3" fill="#d4a574" />
                  </svg>

                  {/* Animated Jewelry Overlay */}
                  {showcase && showcase.filter(p => p.hasTryon).slice(0, 3).map((p, i) => {
                    const img = primaryImg(p);
                    const jewelryTypes = ['necklace', 'bracelet', 'ring'];
                    const jewelryType = jewelryTypes[i % jewelryTypes.length];

                    return (
                      <motion.div
                        key={p.id}
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: [0, 1, 1, 0], scale: [0.3, 1, 1, 0.3] }}
                        transition={{
                          duration: 4,
                          repeat: Infinity,
                          times: [0, 0.3, 0.7, 1],
                          delay: i * 1.3,
                        }}
                        className={`absolute ${
                          jewelryType === 'necklace' ? 'top-16 left-1/2 -translate-x-1/2' :
                          jewelryType === 'bracelet' ? 'top-24 left-2' :
                          'top-28 right-4'
                        }`}
                      >
                        {img ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={img} alt="jewelry" className="h-12 w-12 object-contain drop-shadow-lg" />
                        ) : (
                          <Sparkles className="h-10 w-10 text-[#c9a84c]" />
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              </div>

              {/* Jewelry Try-On Steps */}
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Try different styles</p>
                <div className="space-y-1.5">
                  {['Necklace', 'Bracelet', 'Ring'].map((type, i) => (
                    <motion.div
                      key={type}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: [0, 1, 1, 0], x: [−8, 0, 0, −8] }}
                      transition={{
                        duration: 4,
                        repeat: Infinity,
                        times: [0, 0.3, 0.7, 1],
                        delay: i * 1.3,
                      }}
                      className="text-sm font-medium text-primary bg-primary/10 px-3 py-1.5 rounded-lg"
                    >
                      ✓ {type} fitted
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Featured showcase (real catalog, no price) ────────────────────── */}
      <section id="showcase" className="scroll-mt-20 border-t border-black/5 bg-[#fbf9f5]/70">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="mb-10 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#a0824a]">Featured designs</p>
            <h2 className="mt-2 font-display text-3xl font-normal tracking-tight sm:text-4xl">A glimpse of the collection</h2>
            <p className="mt-3 text-sm text-muted-foreground">Register or sign in to browse the full catalog and place orders.</p>
          </div>

          {showcase === null ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="aspect-[3/4] animate-pulse rounded-xl bg-[#ece5da]" />
              ))}
            </div>
          ) : showcase.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground">Catalog coming soon.</p>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {showcase.map((p, i) => {
                const img = primaryImg(p);
                return (
                  <motion.button
                    key={p.id} type="button"
                    initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ delay: (i % 4) * 0.05, duration: 0.4 }}
                    onClick={() => { setDetail(p); setDetailImg(0); }}
                    className="group overflow-hidden rounded-xl border bg-card text-left shadow-sm transition-all hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(31,24,15,0.16)]"
                    title="View details"
                  >
                    <div className="relative aspect-[3/4] overflow-hidden bg-[#ece5da]">
                      {img ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={img} alt={p.name} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
                      ) : <div className="flex h-full items-center justify-center text-muted-foreground/40"><Gem className="h-8 w-8" /></div>}
                      {p.hasTryon && (
                        <span className="metal-sheen absolute right-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold text-[#17120b]">
                          <Sparkles className="mr-0.5 inline h-2.5 w-2.5" />AR
                        </span>
                      )}
                    </div>
                    <div className="p-3">
                      <p className="truncate text-sm font-medium group-hover:text-primary">{titleCaseName(p.name)}</p>
                      {p.category && <p className="truncate text-xs text-muted-foreground">{p.category}</p>}
                    </div>
                  </motion.button>
                );
              })}
            </div>
          )}

          <div className="mt-12 text-center">
            <Link href="/store/register" className="metal-sheen inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-[#17120b] shadow-sm transition-transform hover:scale-[1.02]">
              See the full catalog — Register <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Why Jewel Factory ─────────────────────────────────────────────── */}
      <section className="border-t border-black/5">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="mb-12 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#a0824a]">Why Jewel Factory</p>
            <h2 className="mt-2 font-display text-3xl font-normal tracking-tight sm:text-4xl">Built for gold jewellery, end to end</h2>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, desc }, i) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ delay: (i % 3) * 0.06, duration: 0.4 }}
                className="rounded-2xl border bg-card p-6 shadow-sm transition-shadow hover:shadow-md"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </span>
                <p className="mt-4 text-base font-semibold">{title}</p>
                <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{desc}</p>
              </motion.div>
            ))}
          </div>
          <div className="mt-12 text-center">
            <Link href="/about" className="luxury-link-underline text-sm font-medium text-primary">Learn how it works →</Link>
          </div>
        </div>
      </section>

      {/* ── Footer (shared platform footer) ───────────────────────────────── */}
      <PublicFooter onLogin={() => setShowLogin(true)} />

      {/* ── Product detail modal (public — ends with a Register/Login CTA) ── */}
      {detail && (
        <div className="fixed inset-0 z-50 flex min-h-full items-center justify-center overflow-y-auto bg-black/50 p-4 py-8" onClick={() => setDetail(null)}>
          <div className="relative w-full max-w-3xl rounded-2xl bg-card shadow-xl" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setDetail(null)} aria-label="Close" className="absolute right-3 top-3 z-20 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80"><X className="h-4 w-4" /></button>
            <div className="grid md:grid-cols-2">
              {/* Gallery */}
              <div className="bg-[#ece5da] p-4 md:rounded-l-2xl">
                <div className="aspect-square overflow-hidden rounded-xl bg-white">
                  {detail.images[detailImg] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={detail.images[detailImg].secureUrl} alt={detail.name} onClick={() => setZoom(detail.images[detailImg].secureUrl)} className="h-full w-full cursor-zoom-in object-contain" title="Click to enlarge" />
                  ) : <div className="flex h-full items-center justify-center text-muted-foreground/40"><Gem className="h-10 w-10" /></div>}
                </div>
                {detail.images.length > 1 && (
                  <div className="mt-3 flex gap-2 overflow-x-auto">
                    {detail.images.map((im, i) => (
                      <button key={i} onClick={() => setDetailImg(i)} className={`h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg border-2 ${i === detailImg ? 'border-primary' : 'border-transparent'}`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={im.secureUrl} alt="" className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {/* Info */}
              <div className="space-y-4 p-6">
                <div className="pr-8">
                  <p className="text-xs font-semibold uppercase tracking-widest text-primary">{detail.category ?? 'Jewellery'}{detail.subCategory ? ` · ${detail.subCategory}` : ''}</p>
                  <h2 className="mt-1 font-display text-2xl font-medium">{titleCaseName(detail.name)}</h2>
                  {detail.designNumber && <p className="mt-0.5 text-sm text-muted-foreground">Design {detail.designNumber}</p>}
                </div>
                <div className="overflow-hidden rounded-xl border text-sm">
                  <div className="flex justify-between px-4 py-2.5"><span className="text-muted-foreground">Metal</span><span className="font-medium">Gold</span></div>
                  {detail.purity && <div className="flex justify-between bg-muted/40 px-4 py-2.5"><span className="text-muted-foreground">Purity</span><span className="font-medium">{detail.purity}</span></div>}
                  {formatWeight(detail.weightGrams) && <div className="flex justify-between px-4 py-2.5"><span className="text-muted-foreground">Weight</span><span className="font-medium">{formatWeight(detail.weightGrams)}</span></div>}
                  <div className="flex justify-between bg-muted/40 px-4 py-2.5"><span className="text-muted-foreground">Category</span><span className="font-medium">{detail.category ?? '—'}{detail.subCategory ? ` › ${detail.subCategory}` : ''}</span></div>
                </div>
                {detail.description && detail.description.trim().length >= 4 && (
                  <p className="text-sm leading-relaxed text-muted-foreground">{detail.description}</p>
                )}
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-center">
                  <p className="text-sm text-muted-foreground">Register or sign in to order this design and browse the full catalog.</p>
                  <div className="mt-3 flex flex-wrap justify-center gap-2">
                    <Link href="/store/register" className="metal-sheen inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-[#17120b]">Register here</Link>
                    <button onClick={() => { setDetail(null); setShowLogin(true); }} className="inline-flex items-center gap-2 rounded-full border border-primary/40 px-5 py-2.5 text-sm font-semibold text-primary hover:bg-primary/5">Login</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Full-screen image zoom */}
      {zoom && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-6" onClick={() => setZoom(null)} role="dialog" aria-modal="true">
          <button type="button" onClick={() => setZoom(null)} aria-label="Close" className="absolute right-4 top-4 rounded-full bg-white/15 p-2 text-white hover:bg-white/25"><X className="h-5 w-5" /></button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoom} alt="preview" onClick={(e) => e.stopPropagation()} className="max-h-[85vh] max-w-[85vw] rounded-lg object-contain" />
        </div>
      )}

      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
      <RegisterPromptModal />
    </div>
  );
}
