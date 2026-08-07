'use client';

import {
  LayoutDashboard, Package, PencilLine, ClipboardCheck,
  Lightbulb, Store as StoreIcon, Settings, Building2, Search,
  Home, X, LogOut, Heart, ShoppingCart,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';

import { useDocumentIdentity } from '@/hooks/use-document-identity';
import { useB2bCart } from '@/hooks/use-b2b-cart';
import { useFavorites } from '@/hooks/use-favorites';
import { SUPPORT_EMAIL, SUPPORT_EMAIL_HREF, SUPPORT_PHONE, SUPPORT_PHONE_HREF } from '@/lib/support';

const FALLBACK_STORE_LOGO = '/storeRe-logo.avif';

// Top navbar — the Retailer's day-to-day browsing/discovery actions, always
// visible. The full label always shows, at every screen width (no shortLabel
// abbreviation) — new users need the whole name to know what an icon does.
// mobileBreakLines: below `sm`, the label renders as these lines stacked
// (falls back to the single `label` string above `sm`) — an explicit break
// point instead of a guessed max-width, so "Search Similar Design" always
// wraps as "Search" / "Similar Design", never a 3rd line.
const TOP_NAV = [
  { label: 'Home', href: '/store/home', icon: Home, mobileBreakLines: undefined as string[] | undefined },
  { label: 'Search Similar Design', href: '/store/similar-search', icon: Search, mobileBreakLines: ['Search', 'Similar Design'] },
];

// Dashboard drawer — operations/admin/account pages, opened via the "Dashboard" button.
const DRAWER_NAV = [
  { label: 'Dashboard', href: '/store/dashboard', icon: LayoutDashboard, section: 'Overview' },
  // Operations runs in the order the work actually flows: browse the orders that
  // came in, then the bespoke ones, then what still needs signing off. Kiosk
  // Orders is gone — it is merged into Order History (same as the
  // manufacturer portal), since both are orders from this retailer's stores.
  { label: 'Order History', href: '/store/b2b-orders', icon: Package, section: 'Operations' },
  { label: 'Customised Order', href: '/store/custom-designs/new', icon: PencilLine, section: 'Operations' },
  { label: 'Pending Approvals', href: '/store/pending-approvals', icon: ClipboardCheck, section: 'Operations' },
  { label: 'Intelligence', href: '/store/intelligence', icon: Lightbulb, section: 'Insights' },
  // Kiosk PIN is managed per-Store on the Stores (Branches) page.
  { label: 'Stores (Branches)', href: '/store/branches', icon: Building2, section: 'Account' },
  { label: 'Retailer Admin Profile', href: '/store/profile', icon: StoreIcon, section: 'Account' },
  { label: 'Settings', href: '/store/settings', icon: Settings, section: 'Account' },
];

const ALL_NAV = [...TOP_NAV, ...DRAWER_NAV];

type StoreMe = { name?: string; slug?: string; city?: string | null; logoUrl?: string | null };

export default function StoreLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [store, setStore] = useState<StoreMe>({ name: 'Your Store' });
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Header-level shortcuts to the catalogue's cart/favorites, visible on
  // every /store/* page (not just the catalogue itself) — clicking jumps to
  // the catalogue with the matching panel open (?open=cart|favorites).
  const cart = useB2bCart();
  const favorites = useFavorites('/api/store/favorites');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/store/me', { cache: 'no-store', credentials: 'same-origin' });
        if (res.status === 401) { router.push('/store/login'); return; }
        const json = (await res.json()) as { data?: StoreMe };
        if (json.data) setStore(json.data);
      } catch { /* ignore */ }
    })();
  }, [router]);

  useEffect(() => { setDrawerOpen(false); }, [pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [drawerOpen]);

  async function signOut() {
    await fetch('/api/store/logout', { method: 'POST' });
    router.push('/');
  }

  const storeName = store.name || 'Your Store';
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const pageLabel = ALL_NAV.find((item) => isActive(item.href))?.label ?? 'Product Catalogue';

  useDocumentIdentity(pageLabel, { storeName, logoUrl: store.logoUrl });

  const drawerSections = Array.from(new Set(DRAWER_NAV.map((item) => item.section)));

  return (
    <div className="flex min-h-screen flex-col bg-[#f8f7f3] text-[#26221e]">
      <title>{`${pageLabel} | ${storeName}`}</title>
      <link rel="icon" href={store.logoUrl || FALLBACK_STORE_LOGO} />

      <header className="sticky top-0 z-30 border-b border-[#e8e3da] bg-white/90 backdrop-blur-xl">
        <div className="flex h-[66px] items-center gap-1.5 px-2.5 sm:gap-3 sm:px-6 lg:px-8">
          <Link href="/store/manufacturer-catalog" className="flex min-w-0 shrink-0 items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={store.logoUrl || FALLBACK_STORE_LOGO}
              alt={storeName}
              className="h-9 w-9 shrink-0 rounded-lg border border-[#eadfca] bg-[#fbf6ea] object-contain p-1"
              onError={(e) => { e.currentTarget.src = FALLBACK_STORE_LOGO; }}
            />
            <span className="hidden min-w-0 sm:block">
              <span className="block truncate text-sm font-semibold text-[#26221e]">{storeName}</span>
              <span className="block text-[9px] font-bold uppercase tracking-[0.14em] text-[#9b8f82]">Retailer Admin portal</span>
            </span>
          </Link>

          {/* Browsing pages sit next to the logo — the full label is always
              visible at every screen width so new users can tell what each
              icon does; the bar scrolls horizontally on the narrowest phones
              rather than clipping or abbreviating a label. */}
          <nav className="ml-1 flex min-w-0 flex-1 items-center gap-1 overflow-x-auto sm:ml-2 sm:flex-initial" aria-label="Primary navigation">
            {TOP_NAV.map(({ label, href, icon: Icon, mobileBreakLines }) => {
              const active = isActive(href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={`flex h-9 shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-full px-2 text-[12px] font-medium transition-colors sm:h-10 sm:gap-2 sm:px-2.5 sm:text-[13px] lg:px-4 ${active ? 'bg-[#c99d37] text-white shadow-[0_5px_16px_rgba(174,127,30,0.18)]' : 'text-[#5f5750] hover:bg-[#f3efe8] hover:text-[#26221e]'}`}
                >
                  <Icon className="h-4 w-4 shrink-0 lg:h-4 lg:w-4" />
                  {mobileBreakLines ? (
                    // Explicit break point (not a guessed max-width) so
                    // "Search Similar Design" always wraps as exactly two
                    // lines — "Search" / "Similar Design" — below `sm`,
                    // and as one line above it.
                    <span className="text-center leading-tight sm:hidden">
                      {mobileBreakLines.map((line, i) => <span key={i} className="block">{line}</span>)}
                    </span>
                  ) : null}
                  <span className={mobileBreakLines ? 'hidden sm:inline' : undefined}>{label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Dashboard lives on the far right at every width. Favorites/Cart
              sit just before it — shortcuts to the catalogue's panels from
              anywhere in the portal, not only from the catalogue page itself. */}
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <Link
              href="/store/manufacturer-catalog?open=favorites"
              className="flex h-9 shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-full border border-[#e3ddd3] bg-white px-2 text-[12px] font-semibold text-[#554e47] shadow-sm transition-colors hover:border-[#c99d37]/50 hover:bg-[#fbf6ea] sm:h-10 sm:gap-2 sm:px-2.5 sm:text-[13px] lg:px-4"
            >
              <Heart className="h-4 w-4 shrink-0 lg:h-4 lg:w-4" />
              <span>Favorites ({favorites.count})</span>
            </Link>
            <Link
              href="/store/manufacturer-catalog?open=cart"
              className="flex h-9 shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-full border border-[#e3ddd3] bg-white px-2 text-[12px] font-semibold text-[#554e47] shadow-sm transition-colors hover:border-[#c99d37]/50 hover:bg-[#fbf6ea] sm:h-10 sm:gap-2 sm:px-2.5 sm:text-[13px] lg:px-4"
            >
              <ShoppingCart className="h-4 w-4 shrink-0 lg:h-4 lg:w-4" />
              <span>Cart ({cart.count})</span>
            </Link>
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={drawerOpen}
              className="flex h-9 shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-full border border-[#e3ddd3] bg-white px-2 text-[12px] font-semibold text-[#554e47] shadow-sm transition-colors hover:border-[#c99d37]/50 hover:bg-[#fbf6ea] sm:h-10 sm:gap-2 sm:px-2.5 sm:text-[13px] lg:px-4"
            >
              <LayoutDashboard className="h-4 w-4 shrink-0 lg:h-4 lg:w-4" />
              <span>Dashboard</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>

      <footer className="flex flex-col items-center justify-between gap-2 border-t border-[#e8e3da] bg-white px-4 py-4 text-[11px] text-[#8d8379] sm:flex-row sm:flex-wrap sm:px-6 lg:px-8">
        <span>{storeName} · Retailer Admin portal</span>
        <span className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center">
          <span>
            Facing an issue?{' '}
            <a href={SUPPORT_EMAIL_HREF} className="break-all font-medium text-[#96702a] hover:underline">{SUPPORT_EMAIL}</a>
            {' · '}
            <a href={SUPPORT_PHONE_HREF} className="whitespace-nowrap font-medium text-[#96702a] hover:underline">{SUPPORT_PHONE}</a>
          </span>
          <span>Powered by Jewel Factory</span>
        </span>
      </footer>

      {/* Dashboard drawer — operations/admin pages, toggled via the Dashboard button */}
      {drawerOpen ? (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Dashboard">
          <button type="button" className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={() => setDrawerOpen(false)} aria-label="Close dashboard" />
          <aside className="absolute right-0 top-0 flex h-full w-[min(90vw,320px)] flex-col bg-[#fffdfa] shadow-2xl">
            <div className="flex h-[66px] items-center justify-between border-b border-[#eee9e1] px-5">
              <p className="text-sm font-semibold text-[#26221e]">Dashboard</p>
              <button type="button" onClick={() => setDrawerOpen(false)} className="rounded-lg p-2 text-[#746b62] hover:bg-[#f2eee7]" aria-label="Close dashboard"><X className="h-4 w-4" /></button>
            </div>
            <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Dashboard navigation">
              {drawerSections.map((section) => (
                <div key={section} className="mb-5 last:mb-0">
                  <p className="mb-1.5 px-3 text-[9px] font-bold uppercase tracking-[0.16em] text-[#aaa096]">{section}</p>
                  <div className="space-y-1">
                    {DRAWER_NAV.filter((item) => item.section === section).map(({ label, href, icon: Icon }) => {
                      const active = isActive(href);
                      return (
                        <Link
                          key={href}
                          href={href}
                          aria-current={active ? 'page' : undefined}
                          className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-colors ${active ? 'bg-[#c99d37] text-white shadow-[0_5px_16px_rgba(174,127,30,0.18)]' : 'text-[#5f5750] hover:bg-[#f3efe8] hover:text-[#26221e]'}`}
                        >
                          <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-white' : 'text-[#756d65] group-hover:text-[#a77d31]'}`} />
                          <span className="truncate">{label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>
            <div className="border-t border-[#eee9e1] p-3">
              <button type="button" onClick={signOut} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-[#9f4037] transition-colors hover:bg-[#fff1ef]">
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </div>
          </aside>
        </div>
      ) : null}

    </div>
  );
}
