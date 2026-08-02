'use client';

import { ArrowRight, Gem, Info, LogIn, Menu, ShieldCheck, Sparkles, X } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Wordmark } from '@/components/landing/Wordmark';

const LoginModal = dynamic(
  () => import('@/components/landing/LoginModal').then((module) => module.LoginModal),
  { ssr: false },
);

/**
 * Shared public-site navbar — used on the landing page, About and Register so
 * they all share the same header (wordmark + Catalogue · About · Login · Register).
 * Scroll-aware, with its own Login popup. `catalogHref` lets the landing page
 * scroll to its in-page showcase ("#showcase") while other pages link to "/#showcase".
 */
export function PublicNav({ catalogHref = '/#showcase' }: { catalogHref?: string }) {
  const pathname = usePathname();
  const [showLogin, setShowLogin] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [menuOpen]);

  const aboutActive = pathname === '/about';

  return (
    <>
      <header
        className={`sticky top-0 z-40 transition-all duration-300 ${
          scrolled
            ? 'shadow-[0_8px_30px_rgba(40,30,20,0.08)]'
            : ''
        }`}
      >
        <div className="flex h-7 items-center justify-between bg-[#191511] px-4 text-[10px] tracking-[0.08em] text-[#887b62] sm:px-6 lg:px-10">
          <span className="flex items-center gap-2 uppercase text-[#d5c8a4]"><ShieldCheck className="h-3 w-3 text-[#c9a84c]" /> Retailer-first jewellery network</span>
          <span className="hidden sm:inline">Private catalogue · Assisted discovery</span>
        </div>
        <div className={`border-b border-black/10 transition-colors ${scrolled ? 'bg-[#fbf8f1]/95 backdrop-blur-xl' : 'bg-[#fbf8f1]/85 backdrop-blur-md'}`}>
          <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-10 xl:px-12">
            <Wordmark href="/" size="md" />

            <nav className="hidden items-center rounded-full border border-black/[0.06] bg-white/55 p-1 shadow-[0_2px_12px_rgba(49,38,24,0.035)] md:flex" aria-label="Main navigation">
              {catalogHref.startsWith('/#') ? (
                <Link href={catalogHref} className="rounded-full px-4 py-2 text-xs font-semibold text-[#746b62] transition-colors hover:bg-[#f1ece2] hover:text-[#211c17]">Catalogue</Link>
              ) : (
                <a href={catalogHref} className="rounded-full px-4 py-2 text-xs font-semibold text-[#746b62] transition-colors hover:bg-[#f1ece2] hover:text-[#211c17]">Catalogue</a>
              )}
              <Link href="/about" aria-current={aboutActive ? 'page' : undefined} className={`rounded-full px-4 py-2 text-xs font-semibold transition-colors ${aboutActive ? 'bg-[#211c17] text-[#fffaf0]' : 'text-[#746b62] hover:bg-[#f1ece2] hover:text-[#211c17]'}`}>About</Link>
            </nav>

            <div className="flex items-center gap-1.5">
              <button onClick={() => setShowLogin(true)} className="hidden rounded-full px-3 py-2 text-xs font-semibold text-[#62584f] transition-colors hover:bg-black/5 sm:block">Login</button>
              <Link href="/store/register" className="metal-sheen hidden items-center gap-1.5 rounded-full px-4 py-2.5 text-xs font-semibold text-[#17120b] shadow-sm transition-transform hover:scale-[1.02] sm:flex">New User? Sign Up <ArrowRight className="h-3.5 w-3.5" /></Link>
              <button className="rounded-full border border-black/10 bg-white/60 p-2.5 text-foreground hover:border-[#c9a84c]/50 hover:bg-white md:hidden" onClick={() => setMenuOpen(true)} aria-label="Open menu"><Menu className="h-5 w-5" /></button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile slide-in drawer (from the right) */}
      <div className={`fixed inset-0 z-50 md:hidden ${menuOpen ? '' : 'pointer-events-none'}`} aria-hidden={!menuOpen}>
        {/* Scrim */}
        <div
          className={`absolute inset-0 bg-black/45 backdrop-blur-sm transition-opacity duration-300 ${menuOpen ? 'opacity-100' : 'opacity-0'}`}
          onClick={() => setMenuOpen(false)}
        />
        {/* Panel */}
        <aside
          className={`absolute right-0 top-0 flex h-full w-[min(90vw,380px)] flex-col bg-[#fbf8f1] shadow-2xl transition-transform duration-300 ${menuOpen ? 'translate-x-0' : 'translate-x-full'}`}
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
        >
          <div className="flex items-center justify-between border-b border-black/10 px-5 py-5">
            <Wordmark href="/" size="sm" />
            <button onClick={() => setMenuOpen(false)} className="rounded-full p-2 text-foreground hover:bg-black/5" aria-label="Close menu">
              <X className="h-5 w-5" />
            </button>
          </div>
          <nav className="flex flex-1 flex-col gap-1 px-4 py-5">
            <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[#9a8f83]">Explore</p>
            {catalogHref.startsWith('/#') ? (
              <Link href={catalogHref} onClick={() => setMenuOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-[#544b43] hover:bg-black/5"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#eee7da] text-[#a77d31]"><Gem className="h-4 w-4" /></span> Catalogue</Link>
            ) : (
              <a href={catalogHref} onClick={() => setMenuOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-[#544b43] hover:bg-black/5"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#eee7da] text-[#a77d31]"><Gem className="h-4 w-4" /></span> Catalogue</a>
            )}
            <Link href="/about" onClick={() => setMenuOpen(false)} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold ${aboutActive ? 'bg-[#211c17] text-[#fffaf0]' : 'text-[#544b43] hover:bg-black/5'}`}><span className={`flex h-8 w-8 items-center justify-center rounded-full ${aboutActive ? 'bg-white/10 text-[#efd489]' : 'bg-[#eee7da] text-[#a77d31]'}`}><Info className="h-4 w-4" /></span> About</Link>
            <button onClick={() => { setMenuOpen(false); setShowLogin(true); }} className="flex items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-[#544b43] hover:bg-black/5"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#eee7da] text-[#a77d31]"><LogIn className="h-4 w-4" /></span> Login</button>
          </nav>
          <div className="border-t border-black/10 bg-white/45 p-4">
            <p className="mb-3 flex items-center gap-2 px-2 text-xs text-[#80756a]"><Sparkles className="h-3.5 w-3.5 text-[#b68a3e]" /> Built for independent retailers</p>
            <Link href="/store/register" onClick={() => setMenuOpen(false)} className="metal-sheen block rounded-full px-4 py-3 text-center text-sm font-semibold text-[#17120b]">
              New User? Sign Up
            </Link>
          </div>
        </aside>
      </div>

      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
    </>
  );
}
