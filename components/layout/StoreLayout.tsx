'use client';

import {
  LayoutDashboard, Package, ShoppingBag, PencilLine, ClipboardCheck,
  Lightbulb, Store as StoreIcon, Settings, Gem, Building2, Search,
  Menu, X, LogOut,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';

import { useDocumentIdentity } from '@/hooks/use-document-identity';
import { SUPPORT_EMAIL, SUPPORT_EMAIL_HREF, SUPPORT_PHONE, SUPPORT_PHONE_HREF } from '@/lib/support';

const FALLBACK_STORE_LOGO = '/storeRe-logo.avif';

// Top navbar — the Retailer's day-to-day browsing/discovery actions, always visible.
const TOP_NAV = [
  { label: 'Manufacturer Catalog', href: '/store/manufacturer-catalog', icon: Gem },
  { label: 'Similar Design Search', href: '/store/similar-search', icon: Search },
];

// Dashboard drawer — operations/admin/account pages, opened via the "Dashboard" button.
const DRAWER_NAV = [
  { label: 'Dashboard', href: '/store/dashboard', icon: LayoutDashboard, section: 'Overview' },
  { label: 'Pending Approvals', href: '/store/pending-approvals', icon: ClipboardCheck, section: 'Operations' },
  { label: 'Catalog Orders', href: '/store/b2b-orders', icon: Package, section: 'Operations' },
  { label: 'Kiosk Orders', href: '/store/kiosk-orders', icon: ShoppingBag, section: 'Operations' },
  { label: 'Customised Designs', href: '/store/custom-designs', icon: PencilLine, section: 'Operations' },
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
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

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

  useEffect(() => { setDrawerOpen(false); setMobileNavOpen(false); }, [pathname]);

  useEffect(() => {
    if (!drawerOpen && !mobileNavOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [drawerOpen, mobileNavOpen]);

  async function signOut() {
    await fetch('/api/store/logout', { method: 'POST' });
    router.push('/');
  }

  const storeName = store.name || 'Your Store';
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const pageLabel = ALL_NAV.find((item) => isActive(item.href))?.label ?? 'Manufacturer Catalog';

  useDocumentIdentity(pageLabel, { storeName, logoUrl: store.logoUrl });

  const drawerSections = Array.from(new Set(DRAWER_NAV.map((item) => item.section)));

  return (
    <div className="flex min-h-screen flex-col bg-[#f8f7f3] text-[#26221e]">
      <title>{`${pageLabel} | ${storeName}`}</title>
      <link rel="icon" href={store.logoUrl || FALLBACK_STORE_LOGO} />

      <header className="sticky top-0 z-30 border-b border-[#e8e3da] bg-white/90 backdrop-blur-xl">
        <div className="flex h-[66px] items-center gap-3 px-4 sm:px-6 lg:px-8">
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

          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="ml-2 hidden shrink-0 items-center gap-2 rounded-full border border-[#e3ddd3] bg-white px-4 py-2 text-[13px] font-semibold text-[#554e47] shadow-sm transition-colors hover:border-[#c99d37]/50 hover:bg-[#fbf6ea] lg:flex"
          >
            <LayoutDashboard className="h-4 w-4" /> Dashboard
          </button>

          <nav className="ml-2 hidden items-center gap-1 lg:flex" aria-label="Primary navigation">
            {TOP_NAV.map(({ label, href, icon: Icon }) => {
              const active = isActive(href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={`flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-medium transition-colors ${active ? 'bg-[#c99d37] text-white shadow-[0_5px_16px_rgba(174,127,30,0.18)]' : 'text-[#5f5750] hover:bg-[#f3efe8] hover:text-[#26221e]'}`}
                >
                  <Icon className="h-4 w-4" /> {label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="rounded-lg border border-[#e3ddd3] bg-white p-2 text-[#554e47] shadow-sm lg:hidden"
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5" />
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

      {/* Mobile primary nav (top navbar items, since they're hidden below lg) */}
      {mobileNavOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <button type="button" className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={() => setMobileNavOpen(false)} aria-label="Close navigation" />
          <aside className="absolute left-0 top-0 flex h-full w-[min(90vw,280px)] flex-col bg-[#fffdfa] shadow-2xl">
            <div className="flex h-[66px] items-center justify-between border-b border-[#eee9e1] px-5">
              <p className="truncate text-sm font-semibold text-[#26221e]">{storeName}</p>
              <button type="button" onClick={() => setMobileNavOpen(false)} className="rounded-lg p-2 text-[#746b62] hover:bg-[#f2eee7]" aria-label="Close navigation"><X className="h-4 w-4" /></button>
            </div>
            <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Mobile navigation">
              <div className="space-y-1">
                {TOP_NAV.map(({ label, href, icon: Icon }) => {
                  const active = isActive(href);
                  return (
                    <Link key={href} href={href} aria-current={active ? 'page' : undefined} className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-colors ${active ? 'bg-[#c99d37] text-white shadow-[0_5px_16px_rgba(174,127,30,0.18)]' : 'text-[#5f5750] hover:bg-[#f3efe8] hover:text-[#26221e]'}`}>
                      <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-white' : 'text-[#756d65] group-hover:text-[#a77d31]'}`} />
                      <span className="truncate">{label}</span>
                    </Link>
                  );
                })}
              </div>
              <div className="my-4 border-t border-[#eee9e1]" />
              <button
                type="button"
                onClick={() => { setMobileNavOpen(false); setDrawerOpen(true); }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium text-[#5f5750] hover:bg-[#f3efe8] hover:text-[#26221e]"
              >
                <LayoutDashboard className="h-4 w-4 shrink-0 text-[#756d65]" /> Dashboard
              </button>
            </nav>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
