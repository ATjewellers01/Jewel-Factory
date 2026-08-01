'use client';

import { ArrowRight, Award, Camera, Sparkles, X } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';

import { productMetaParts } from '@/lib/format';
import { useStoreManager } from './store-manager-context';

type Img = { secureUrl: string; isPrimary: boolean };
type Product = {
  id: string;
  designNumber: string;
  name?: string | null;
  category: string | null;
  subCategory: string | null;
  purity: string | null;
  weightGrams: string | null;
  hasTryon: boolean;
  images: Img[];
};

const primary = (product: Product) => (product.images.find((image) => image.isPrimary) ?? product.images[0])?.secureUrl;

export default function StoreManagerHome() {
  const manager = useStoreManager();
  const [products, setProducts] = useState<Product[]>([]);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch('/api/branch-manager/catalog', { cache: 'no-store', credentials: 'same-origin' });
        if (response.status === 401) { window.location.assign('/store-manager/login'); return; }
        const json = (await response.json()) as { data?: Product[] };
        const list = (json.data ?? []).filter((product) => primary(product));
        for (let index = list.length - 1; index > 0; index--) {
          const randomIndex = Math.floor(Math.random() * (index + 1));
          [list[index], list[randomIndex]] = [list[randomIndex]!, list[index]!];
        }
        if (!cancelled) setProducts(list);
      } catch { /* Keep the storefront usable even if the catalogue is warming up. */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const featured = products[0];
  const popular = products.slice(0, 4);
  // Keep the two editorial grids distinct. When the catalog is still small we
  // prefer omitting this section to showing the same four pieces twice.
  const more = products.slice(4, 12);
  const collections = useMemo(() => {
    const seen = new Set<string>();
    return products.filter((product) => {
      if (!product.category || seen.has(product.category)) return false;
      seen.add(product.category);
      return true;
    }).slice(0, 3);
  }, [products]);

  return (
    <div className="min-h-screen overflow-hidden">
      <section className="relative overflow-hidden bg-[#211711]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="https://images.unsplash.com/photo-1599643478524-fb66f7ca2b6e?w=1800&q=90" alt="Premium jewellery showroom" className="absolute inset-0 h-full w-full object-cover object-center opacity-[0.2]" />
        {/* Copy-side scrim: vertical on small screens (text sits below the image),
            horizontal from lg up (text sits beside it). */}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(20,14,10,0.35)_0%,rgba(20,14,10,0.85)_58%,rgba(20,14,10,0.95)_100%)] lg:bg-[linear-gradient(90deg,rgba(20,14,10,0.94)_0%,rgba(20,14,10,0.76)_48%,rgba(20,14,10,0.28)_78%,rgba(20,14,10,0.5)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#fbf9f5]/45 via-[#fbf9f5]/10 to-transparent" />

        {/* Content-driven height — no forced svh rows, so the section can never
            clip its own copy on short/landscape viewports. */}
        <div className="relative mx-auto grid max-w-[1400px] gap-8 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-center lg:gap-12 lg:px-12 lg:py-20">
          {featured ? <HeroProduct product={featured} /> : null}

          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="relative z-10 lg:order-1">
            <p className="mb-4 inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-[#e4cf8f] sm:mb-5 sm:text-xs sm:tracking-[0.28em]"><Sparkles className="h-3.5 w-3.5" /> AI jewellery showroom</p>
            {/* min(...) on the fluid step stops long retailer names overflowing
                narrow phones, where 12vw alone was too aggressive. */}
            <h1 className="font-display max-w-2xl text-balance break-words text-[clamp(2.25rem,9vw,4rem)] font-normal leading-[1.02] text-white sm:text-[clamp(3.25rem,6vw,5.5rem)] sm:leading-[0.95]">{manager.retailer.name}</h1>
            <p className="mt-4 max-w-md text-base leading-7 text-white/75 sm:mt-5 sm:text-lg">Browse the live catalogue at {manager.branch.name}, find similar designs, and preview favourites with virtual try-on.</p>
            <div className="mt-7 flex flex-wrap items-center gap-3 sm:mt-8">
              <Link href="/store-manager/kiosk" className="metal-sheen inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold text-[#17120b] shadow-lg shadow-black/20 transition-transform hover:scale-[1.02] max-[359px]:w-full sm:px-6">Explore Catalogue <ArrowRight className="h-4 w-4" /></Link>
              <Link href="/store-manager/try-on" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/35 bg-white/[0.08] px-5 py-3 text-sm font-semibold text-white backdrop-blur-md transition-colors hover:bg-white/[0.14] max-[359px]:w-full sm:px-6"><Camera className="h-4 w-4" /> Try On</Link>
            </div>
          </motion.div>
        </div>
      </section>

      {featured && !dismissed ? (
        <motion.aside initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18, duration: 0.45 }} className="fixed bottom-5 right-5 z-40 hidden w-[350px] rounded-xl border border-black/10 bg-[#fbf8f1]/95 p-3 shadow-[0_20px_60px_rgba(0,0,0,0.24)] ring-1 ring-black/5 backdrop-blur-xl md:block">
          <div className="mb-3 flex items-center justify-between gap-3 border-b border-black/10 pb-2"><span className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#9b762f]">Featured piece</span><button onClick={() => setDismissed(true)} className="flex h-7 w-7 items-center justify-center rounded-full text-[#5f574f] hover:bg-black/5" aria-label="Dismiss featured piece"><X className="h-3.5 w-3.5" /></button></div>
          <Link href="/store-manager/kiosk" className="group flex items-center gap-4">
            <span className="h-20 w-16 shrink-0 overflow-hidden rounded-lg bg-[#e9e2d7] ring-1 ring-black/10"><ProductImage product={featured} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" /></span>
            <span className="min-w-0"><span className="line-clamp-1 text-sm font-semibold text-[#1f1a14]">{featured.designNumber}</span><span className="mt-1 block text-xs text-[#6f675e]">{featured.category ?? 'Jewellery'}</span><span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#b68a3e]">View in catalogue <ArrowRight className="h-3 w-3" /></span></span>
          </Link>
        </motion.aside>
      ) : null}

      {collections.length > 0 ? (
        <section className="mx-auto max-w-[1400px] px-4 py-14 md:px-6 md:py-20 lg:px-12">
          <SectionHeading eyebrow="Explore" title="Curated collections" action="View all jewellery" href="/store-manager/kiosk" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-5 md:gap-5">
            <CollectionTile product={collections[0]!} large index={0} />
            <div className="grid gap-4 md:col-span-2 md:gap-5">{collections.slice(1, 3).map((product, index) => <CollectionTile key={product.category} product={product} index={index + 1} />)}</div>
          </div>
        </section>
      ) : null}

      <section className="bg-[#1b1612] py-14 text-white md:py-20">
        <div className="mx-auto max-w-[1400px] px-4 md:px-6 lg:px-12">
          <SectionHeading eyebrow="Popular now" title="Pieces drawing attention" action="View catalogue" href="/store-manager/kiosk" dark />
          {popular.length > 0 ? <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6 xl:grid-cols-4">{popular.map((product, index) => <ProductCard key={product.id} product={product} index={index} dark />)}</div> : <LoadingGrid />}
        </div>
      </section>

      <section className="mx-auto max-w-[1400px] px-4 py-14 md:px-6 md:py-20 lg:px-12">
        <div className="mb-8"><p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-[#b68a3e]">Ways to discover</p><h2 className="font-display text-3xl font-normal md:text-5xl">Find the right piece</h2></div>
        <div className="no-scrollbar flex snap-x gap-4 overflow-x-auto pb-2">
          {[
            { title: 'Search by Photo', href: '/store-manager/search', image: products[3] ?? products[0], label: 'Visual match' },
            { title: 'Virtual Try-On', href: '/store-manager/try-on', image: products.find((product) => product.hasTryon) ?? products[1], label: 'Live preview' },
            { title: 'Custom Design', href: '/store-manager/custom-design', image: products[5] ?? products[2], label: 'Made to request' },
          ].map((item, index) => item.image ? (
            <motion.div key={item.title} initial={{ opacity: 0, x: 16 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.06 }} className="group relative h-[250px] w-[210px] shrink-0 snap-start overflow-hidden rounded-lg sm:w-[250px]">
              <ProductImage product={item.image} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
              <Link href={item.href} className="absolute inset-0 flex flex-col justify-end p-5"><span className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#e4cf8f]">{item.label}</span><span className="font-display text-2xl text-white">{item.title}</span></Link>
            </motion.div>
          ) : null)}
        </div>
      </section>

      <section className="mx-auto max-w-[1400px] px-4 pb-8 md:px-6 lg:px-12">
        <div className="grid overflow-hidden rounded-lg bg-[#211913] text-white md:grid-cols-[1.1fr_0.9fr]">
          <div className="px-6 py-10 md:px-10 md:py-14"><p className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-[#e4cf8f]">Virtual try-on</p><h2 className="font-display max-w-xl text-3xl font-normal leading-tight md:text-5xl">Bring the piece closer before you decide.</h2><p className="mt-5 max-w-md text-sm leading-6 text-white/68">Preview eligible pieces live on the kiosk, then add the chosen design to the customer order.</p><Link href="/store-manager/try-on" className="metal-sheen mt-8 inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-[#17120b] transition-transform hover:scale-[1.02]"><Sparkles className="h-4 w-4" /> Open Try-On</Link></div>
          <div className="relative aspect-[16/10] overflow-hidden sm:aspect-[16/9] md:aspect-auto md:min-h-[320px]">{(products.find((product) => product.hasTryon) ?? products[0]) ? <ProductImage product={(products.find((product) => product.hasTryon) ?? products[0])!} className="absolute inset-0 h-full w-full object-cover" /> : <div className="h-full min-h-72 bg-[#2a1f15]" />}</div>
        </div>
      </section>

      {more.length > 0 ? (
        <section className="mx-auto max-w-[1400px] px-4 py-14 md:px-6 md:py-20 lg:px-12"><SectionHeading eyebrow="Discover" title="More to explore" /><div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6 xl:grid-cols-4">{more.map((product, index) => <ProductCard key={product.id} product={product} index={index} />)}</div></section>
      ) : null}
    </div>
  );
}

function SectionHeading({ eyebrow, title, action, href, dark }: { eyebrow: string; title: string; action?: string; href?: string; dark?: boolean }) {
  return <div className="mb-8 flex items-end justify-between gap-6"><div><p className={`mb-2 text-xs font-semibold uppercase tracking-[0.24em] ${dark ? 'text-[#e4cf8f]' : 'text-[#b68a3e]'}`}>{eyebrow}</p><h2 className="font-display text-3xl font-normal md:text-5xl">{title}</h2></div>{action && href ? <Link href={href} className={`luxury-link-underline hidden text-sm font-semibold sm:inline-flex ${dark ? 'text-white/65 hover:text-white' : 'text-[#746b62] hover:text-[#211c17]'}`}>{action}</Link> : null}</div>;
}

function CollectionTile({ product, large, index }: { product: Product; large?: boolean; index: number }) {
  return <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-80px' }} transition={{ delay: index * 0.08, duration: 0.5 }} className={`group relative cursor-pointer overflow-hidden rounded-lg ${large ? 'min-h-[420px] md:col-span-3' : 'min-h-[200px]'}`}><ProductImage product={product} className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" /><div className="absolute inset-0 bg-black/40" /><Link href={`/store-manager/kiosk?category=${encodeURIComponent(product.category ?? '')}`} className="absolute inset-0 flex flex-col justify-end p-6 md:p-8"><span className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-[#e4cf8f]">{large ? 'Featured' : 'Collection'}</span><span className={`font-display font-normal text-white ${large ? 'text-3xl md:text-4xl' : 'text-2xl'}`}>{product.category}</span><span className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-[#e4cf8f] opacity-0 transition-all group-hover:translate-x-1 group-hover:opacity-100">Explore <ArrowRight className="h-3 w-3" /></span></Link></motion.div>;
}

function ProductCard({ product, index, dark }: { product: Product; index: number; dark?: boolean }) {
  return <motion.article initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }} transition={{ delay: index * 0.04, duration: 0.4 }} className="group"><Link href="/store-manager/kiosk" className="block"><div className="relative aspect-[3/4] overflow-hidden rounded-lg bg-[#ece5da] shadow-[0_1px_0_rgba(25,21,17,0.08)] ring-1 ring-black/5 transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-[0_18px_40px_rgba(31,24,15,0.16)]"><ProductImage product={product} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" /><div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/50 to-transparent" />{product.hasTryon ? <span className="metal-sheen absolute right-3 top-3 rounded-full px-2 py-0.5 text-[10px] font-semibold text-[#1a1208]">AR</span> : null}<span className="absolute bottom-3 right-3 flex items-center gap-1 rounded-full bg-[#f7fff8]/90 px-1.5 py-0.5 text-[9px] font-semibold text-[#15803d]"><Award className="h-2.5 w-2.5" /> BIS</span></div><div className="mt-3 space-y-1"><p className={`line-clamp-1 text-sm font-semibold ${dark ? 'text-white' : 'text-[#211c17]'}`}>{product.designNumber}</p>{(() => { const meta = productMetaParts({ category: product.category, subCategory: product.subCategory, purity: product.purity, weight: product.weightGrams }); return (<><p className={`truncate text-xs ${dark ? 'text-white/60' : 'text-[#746b62]'}`}>{meta.descriptor}</p>{meta.weight ? <p className={`text-xs font-medium ${dark ? 'text-white/70' : 'text-[#746b62]'}`}>{meta.weight}</p> : null}</>); })()}</div></Link></motion.article>;
}

function ProductImage({ product, className }: { product: Product; className: string }) {
  const source = primary(product);
  return source ? <img src={source} alt={product.designNumber} className={className} /> : null; // eslint-disable-line @next/next/no-img-element
}

function HeroProduct({ product }: { product: Product }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97, x: 20 }}
      animate={{ opacity: 1, scale: 1, x: 0 }}
      transition={{ delay: 0.08, duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
      /* A fixed aspect ratio (rather than a tall min-height + object-cover) keeps
         the piece centred and fully framed at every width — the old box left the
         jewellery floating high with dead space beneath it on laptop screens. */
      className="pointer-events-none relative aspect-[4/3] w-full overflow-hidden rounded-2xl shadow-[0_24px_60px_rgba(0,0,0,0.4)] sm:aspect-[16/10] lg:order-2 lg:aspect-[4/5] lg:max-h-[560px] lg:max-w-[520px] lg:justify-self-end lg:rounded-[2rem] lg:shadow-[0_38px_90px_rgba(0,0,0,0.48)]"
      aria-hidden="true"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(201,168,76,0.22),transparent_68%)] blur-2xl" />
      <ProductImage
        product={product}
        className="absolute inset-0 h-full w-full object-cover object-center opacity-90 lg:opacity-95"
      />
      {/* Soft edge blend into the section background, direction-aware per breakpoint. */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#211711]/10 via-transparent to-[#211711]/45 lg:bg-gradient-to-r lg:from-[#211711]/28 lg:via-transparent lg:to-transparent" />
    </motion.div>
  );
}

function LoadingGrid() {
  return <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="aspect-[3/4] animate-pulse rounded-lg bg-white/10" />)}</div>;
}
