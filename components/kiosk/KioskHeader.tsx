'use client';

import { Search, Sparkles, ShoppingBag, Menu, X, Gem, PencilLine, Home } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useKioskStore } from './StoreContext';
import { useGuestCart } from '@/hooks/use-guest-cart';

export function KioskHeader() {
  const store = useKioskStore();
  const cart = useGuestCart();
  const pathname = usePathname();
  const base = `/${store.slug}`;
  const [menuOpen, setMenuOpen] = useState(false);

  // Close the mobile menu on route change.
  useEffect(() => { setMenuOpen(false); }, [pathname]);

  const navLinks = [
    { href: base, label: 'Home', icon: Home },
    { href: `${base}/catalog`, label: 'Catalog', icon: Gem },
    { href: `${base}/custom-design`, label: 'Custom Design', icon: PencilLine },
    { href: `${base}/try-on`, label: 'Try-On', icon: Sparkles },
    { href: `${base}/search`, label: 'Search', icon: Search },
  ];

  return (
    <header className="fixed top-0 z-50 w-full">
      {/* Store branding strip */}
      <div className="flex items-center justify-between gap-2 bg-[#191511] px-3 py-1.5 text-[10px] sm:px-4 sm:text-[11px]">
        <div className="flex min-w-0 items-center gap-2 text-[#e4cf8f]">
          {store.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={store.logoUrl} alt={store.name} className="h-5 w-auto object-contain" />
          ) : null}
          <span className="truncate font-semibold text-[#f8e7af]">{store.name}</span>
          {store.city && <span className="hidden text-[#c9b98b] sm:inline">· {store.city}</span>}
        </div>
        <span className="flex-shrink-0 text-[#5a4f38]">Powered by Jewel Factory</span>
      </div>

      {/* Nav bar */}
      <div className="flex h-14 items-center justify-between border-b bg-[#fbf8f1]/90 px-3 backdrop-blur-lg sm:px-4">
        <div className="flex items-center gap-2">
          {/* Hamburger — mobile only */}
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="text-foreground/70 hover:text-foreground md:hidden"
            aria-label="Menu"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <Link href={base} className="truncate font-display text-base font-medium tracking-tight sm:text-lg">
            {store.name}
          </Link>
        </div>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-6 text-sm md:flex">
          <Link href={`${base}/catalog`} className="luxury-link-underline">Catalog</Link>
          <Link href={`${base}/custom-design`} className="luxury-link-underline">Custom Design</Link>
          <Link href={`${base}/try-on`} className="luxury-link-underline">Try-On</Link>
        </nav>

        <div className="flex items-center gap-3">
          <Link href={`${base}/search`} className="text-foreground/70 hover:text-foreground"><Search className="h-5 w-5" /></Link>
          <Link href={`${base}/checkout`} className="relative text-foreground/70 hover:text-foreground">
            <ShoppingBag className="h-5 w-5" />
            {cart.count > 0 && <span className="absolute -right-2 -top-2 rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">{cart.count}</span>}
          </Link>
          <Link href={`${base}/try-on`} className="metal-sheen hidden rounded-full px-3 py-1.5 text-xs font-semibold text-[#17120b] sm:inline-flex sm:items-center">
            <Sparkles className="mr-1 h-3.5 w-3.5" />Try On
          </Link>
        </div>
      </div>

      {/* Mobile drawer */}
      {menuOpen && (
        <>
          <div className="fixed inset-0 top-[calc(1.5rem+3.5rem)] z-40 bg-black/40 md:hidden" onClick={() => setMenuOpen(false)} />
          <nav className="absolute left-0 right-0 z-50 border-b bg-[#fbf8f1] shadow-lg md:hidden">
            {navLinks.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-3 border-b border-[#eee] px-4 py-3 text-sm hover:bg-[#f5ede0]"
              >
                <Icon className="h-4 w-4 text-primary" />
                {label}
              </Link>
            ))}
          </nav>
        </>
      )}
    </header>
  );
}
