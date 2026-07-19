'use client';

import { ArrowRight, Gem, Sparkles, ShieldCheck, Building2, Search, Menu, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { LoginModal } from '@/components/landing/LoginModal';
import { RegisterPromptModal } from '@/components/landing/RegisterPromptModal';

type ShowcaseProduct = {
  id: string; name: string; category: string | null; hasTryon: boolean;
  images: { secureUrl: string; isPrimary: boolean }[];
};

const FEATURES = [
  { icon: Gem, title: 'Gold-only catalog', desc: 'One manufacturer catalog, auto design numbers, no price clutter — quotes stay with the store.' },
  { icon: Sparkles, title: 'AR virtual try-on', desc: 'Customers see how a piece looks on them, right at the store kiosk.' },
  { icon: Search, title: 'Similar-design search', desc: 'Upload a photo and instantly find matching designs in the catalog by visual similarity.' },
  { icon: ShieldCheck, title: 'Customer privacy', desc: 'Walk-in customer details never leave the store — the manufacturer only sees products.' },
  { icon: Building2, title: 'Multi-store ready', desc: 'One retailer, many stores — approvals, restock and orders tracked end to end.' },
];

export default function LandingPage() {
  const [showcase, setShowcase] = useState<ShowcaseProduct[] | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/kiosk/catalog', { cache: 'no-store' });
        const json = (await res.json()) as { data?: ShowcaseProduct[] };
        setShowcase((json.data ?? []).slice(0, 8));
      } catch { setShowcase([]); }
    })();
  }, []);

  return (
    <div className="min-h-screen">
      {/* Navbar */}
      <header className="sticky top-0 z-40 border-b border-black/5 bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-wordmark.png" alt="Jewel Factory" className="h-7 w-auto object-contain" />
          </Link>

          <nav className="hidden items-center gap-6 md:flex">
            <a href="#showcase" className="text-sm text-foreground/80 hover:text-foreground">Catalog</a>
            <Link href="/about" className="text-sm text-foreground/80 hover:text-foreground">About</Link>
            <button onClick={() => setShowLogin(true)} className="text-sm text-foreground/80 hover:text-foreground">Login</button>
            <Link href="/store/register" className="metal-sheen rounded-full px-4 py-2 text-sm font-semibold text-[#17120b]">
              Register here
            </Link>
          </nav>

          <button className="md:hidden" onClick={() => setMenuOpen((v) => !v)} aria-label="Menu">
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
        {menuOpen && (
          <div className="border-t border-black/5 bg-background px-4 py-3 md:hidden">
            <div className="flex flex-col gap-3">
              <a href="#showcase" onClick={() => setMenuOpen(false)} className="text-sm">Catalog</a>
              <Link href="/about" onClick={() => setMenuOpen(false)} className="text-sm">About</Link>
              <button onClick={() => { setMenuOpen(false); setShowLogin(true); }} className="text-left text-sm">Login</button>
              <Link href="/store/register" onClick={() => setMenuOpen(false)} className="metal-sheen inline-block rounded-full px-4 py-2 text-center text-sm font-semibold text-[#17120b]">
                Register here
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-6xl px-4 py-16 text-center sm:px-6 sm:py-28">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#a0824a]">
            Intelligent gold jewellery — made for you
          </p>
          <h1 className="mx-auto mt-4 max-w-3xl font-display text-4xl font-normal tracking-tight text-balance sm:text-6xl">
            Welcome to Jewel Factory
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground">
            The B2B platform that connects a gold-jewellery manufacturer to its
            retailer network and their in-store customers — catalog, AR try-on,
            orders and approvals, all in one place.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <button onClick={() => setShowLogin(true)} className="metal-sheen inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-[#17120b]">
              Login <ArrowRight className="h-4 w-4" />
            </button>
            <Link href="/store/register" className="inline-flex items-center gap-2 rounded-full border border-primary/40 px-6 py-3 text-sm font-semibold text-primary hover:bg-primary/5">
              Register here
            </Link>
          </div>
        </div>
      </section>

      {/* Featured showcase (real catalog, no price) */}
      <section id="showcase" className="border-t border-black/5 bg-[#fbf9f5]/60">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="mb-8 text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#a0824a]">Featured designs</p>
            <h2 className="mt-2 font-display text-3xl font-normal tracking-tight">A glimpse of the collection</h2>
            <p className="mt-2 text-sm text-muted-foreground">Register or sign in to browse the full catalog and place orders.</p>
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
              {showcase.map((p) => {
                const img = p.images.find((i) => i.isPrimary) ?? p.images[0];
                return (
                  <div key={p.id} className="group overflow-hidden rounded-xl border bg-card">
                    <div className="relative aspect-[3/4] bg-[#ece5da]">
                      {img ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={img.secureUrl} alt={p.name} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                      ) : <div className="flex h-full items-center justify-center text-muted-foreground/40"><Gem className="h-8 w-8" /></div>}
                      {p.hasTryon && (
                        <span className="metal-sheen absolute right-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold text-[#17120b]">
                          <Sparkles className="mr-0.5 inline h-2.5 w-2.5" />AR
                        </span>
                      )}
                    </div>
                    <div className="p-3">
                      <p className="truncate text-sm font-medium">{p.name}</p>
                      {p.category && <p className="truncate text-xs text-muted-foreground">{p.category}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-10 text-center">
            <Link href="/store/register" className="metal-sheen inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-[#17120b]">
              See the full catalog — Register <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Why Jewel Factory */}
      <section className="border-t border-black/5">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="mb-10 text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#a0824a]">Why Jewel Factory</p>
            <h2 className="mt-2 font-display text-3xl font-normal tracking-tight">Built for gold jewellery, end to end</h2>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="rounded-xl border bg-card p-5">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </span>
                <p className="mt-3 text-sm font-semibold">{title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 text-center">
            <Link href="/about" className="luxury-link-underline text-sm font-medium text-primary">Learn how it works →</Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-black/5 bg-[#fbf9f5]/60">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-4 py-8 text-center sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            <span className="text-[#C9A84C]">Jewel</span> Factory
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground">
            <Link href="/about" className="hover:text-foreground">About</Link>
            <button onClick={() => setShowLogin(true)} className="hover:text-foreground">Login</button>
            <Link href="/store/register" className="hover:text-foreground">Register</Link>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Powered by Jewel Factory</p>
        </div>
      </footer>

      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
      <RegisterPromptModal />
    </div>
  );
}
