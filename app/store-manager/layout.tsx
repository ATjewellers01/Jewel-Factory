'use client';

import {
  Award,
  Camera,
  ChevronDown,
  ClipboardList,
  Home,
  LayoutGrid,
  LogOut,
  Menu,
  Package,
  PencilRuler,
  ScanSearch,
  Shield,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useApi, apiPost } from '@/hooks/use-api';
import { useDocumentIdentity } from '@/hooks/use-document-identity';
import { StoreManagerProvider, type StoreManagerMe } from './store-manager-context';

// Fallback store logo (gold medallion) when a retailer has no logoUrl set.
const FALLBACK_STORE_LOGO = '/storeRe-logo.avif';

// Browser-tab label per store-manager route (title becomes "<label> | <Store>").
const PAGE_LABELS: Record<string, string> = {
  '/store-manager': 'Home',
  '/store-manager/kiosk': 'Catalog',
  '/store-manager/search': 'Search by Photo',
  '/store-manager/custom-design': 'Custom Design',
  '/store-manager/try-on': 'Try-On',
  '/store-manager/restock': 'Restock',
  '/store-manager/my-orders': 'My Orders',
};

function pageLabelFor(pathname: string): string {
  if (PAGE_LABELS[pathname]) return PAGE_LABELS[pathname];
  const match = Object.entries(PAGE_LABELS).find(([href]) => href !== '/store-manager' && pathname.startsWith(href));
  return match ? match[1] : 'Home';
}

const nav = [
  { href: '/store-manager/kiosk', label: 'Catalog', icon: LayoutGrid },
  { href: '/store-manager/search', label: 'Photo Search', icon: ScanSearch },
  { href: '/store-manager/custom-design', label: 'Custom Design', icon: PencilRuler },
  { href: '/store-manager/my-orders', label: 'My Orders', icon: ClipboardList },
];

const mobileNav = [
  { href: '/store-manager', label: 'Storefront Home', icon: Home, exact: true },
  ...nav,
  { href: '/store-manager/try-on', label: 'Virtual Try-On', icon: Sparkles },
];

function isActiveRoute(pathname: string, href: string, exact = false) {
  return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

export default function StoreManagerLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === '/store-manager/login') return <>{children}</>;
  return <Shell>{children}</Shell>;
}

function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { data, loading } = useApi<StoreManagerMe>('/api/branch-manager/me', '/store-manager/login');
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => setMobileOpen(false), [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [mobileOpen]);

  // Tab title "<Page> | <Store Name>" + the store's logo as favicon (falls back
  // to the store medallion when the retailer has no logo set).
  useDocumentIdentity(pageLabelFor(pathname), {
    storeName: data?.retailer.name,
    logoUrl: data?.retailer.logoUrl,
  });

  if (loading || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fbf9f5] text-[#8d8174]">
        <span className="h-7 w-7 animate-spin rounded-full border-2 border-[#c9a84c]/30 border-t-[#c9a84c]" />
      </div>
    );
  }

  async function logout() {
    try { await apiPost('/api/branch-manager/logout'); } catch { /* ignore */ }
    window.location.assign('/store-manager/login');
  }

  const managerInitials = data.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  return (
    <StoreManagerProvider value={data}>
      <title>{`${pageLabelFor(pathname)} | ${data.retailer.name}`}</title>
      <link rel="icon" href={data.retailer.logoUrl || FALLBACK_STORE_LOGO} />
      <div className="min-h-screen bg-[#fbf9f5] text-[#211c17]">
        <header className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${scrolled ? 'shadow-[0_8px_30px_rgba(40,30,20,0.08)]' : ''}`}>
          <div className="flex h-7 items-center justify-between gap-3 bg-[#191511] px-3 text-[10px] tracking-[0.08em] md:px-6 lg:px-12">
            <span className="flex min-w-0 items-center gap-2 text-[#d5c8a4]">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#c9a84c] shadow-[0_0_8px_rgba(201,168,76,0.7)]" />
              <span className="truncate uppercase">{data.branch.name}</span>
              {data.retailer.city ? <span className="hidden text-[#887b62] sm:inline">· {data.retailer.city}</span> : null}
            </span>
            <span className="flex shrink-0 items-center gap-2 text-[#887b62]">
              <span className="hidden normal-case tracking-normal md:inline">Welcome, {data.name.split(' ')[0]}</span>
              <span className="hidden md:inline">·</span>
              <span>Powered by Jewel Factory</span>
            </span>
          </div>

          <div className="border-b border-black/10 bg-[#fbf8f1]/95 backdrop-blur-xl">
            <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between gap-3 px-3 sm:px-4 md:px-6 lg:px-8 xl:px-12">
              <Link href="/store-manager" className="group flex min-w-0 shrink items-center gap-2.5 lg:max-w-[190px] xl:max-w-[230px]" aria-label={`${data.retailer.name} — home`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={data.retailer.logoUrl || FALLBACK_STORE_LOGO} alt={data.retailer.name} className="h-9 w-9 shrink-0 rounded-full object-contain ring-1 ring-[#c9a84c]/30 transition-shadow group-hover:ring-[#c9a84c]/60" />
                <span className="min-w-0">
                  <span className="block truncate font-display text-[17px] font-medium leading-tight tracking-[0.02em] text-[#211c17] sm:text-lg">
                    {data.retailer.name}
                  </span>
                  <span className="mt-0.5 hidden truncate text-[9px] font-semibold uppercase tracking-[0.16em] text-[#9b7a3c] sm:block">
                    {data.branch.name}
                  </span>
                </span>
              </Link>

              <nav className="hidden items-center rounded-full border border-black/[0.06] bg-white/55 p-1 shadow-[0_2px_12px_rgba(49,38,24,0.035)] lg:flex" aria-label="Storefront navigation">
                {nav.map((item) => {
                  const active = isActiveRoute(pathname, item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      className={`relative rounded-full px-3 py-2 text-xs font-semibold transition-all xl:px-4 ${active ? 'bg-[#211c17] text-[#fffaf0] shadow-sm' : 'text-[#746b62] hover:bg-[#f1ece2] hover:text-[#211c17]'}`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>

              <div className="flex shrink-0 items-center gap-1.5">
                <Link href="/store-manager/try-on" className="metal-sheen hidden items-center gap-1.5 rounded-full px-4 py-2.5 text-xs font-semibold text-[#17120b] shadow-sm transition-transform hover:scale-[1.02] sm:flex">
                  <Sparkles className="h-3.5 w-3.5" /> Try On
                </Link>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="hidden items-center gap-2 rounded-full border border-black/10 bg-white/60 py-1.5 pl-1.5 pr-2 text-left transition-colors hover:border-[#c9a84c]/50 hover:bg-white lg:flex" aria-label="Open staff menu">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#211c17] text-[10px] font-bold tracking-wide text-[#efd489]">{managerInitials}</span>
                      <span className="hidden max-w-[82px] truncate text-xs font-semibold text-[#4f463d] xl:block">{data.name}</span>
                      <ChevronDown className="h-3.5 w-3.5 text-[#8d8174]" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" sideOffset={10} className="w-64 rounded-xl border-black/10 bg-[#fffdf8] p-2 shadow-[0_16px_50px_rgba(31,24,17,0.16)]">
                    <DropdownMenuLabel className="px-3 py-2.5 font-normal">
                      <span className="block truncate text-sm font-semibold text-[#211c17]">{data.name}</span>
                      <span className="mt-0.5 block truncate text-xs text-[#80756a]">{data.branch.name}</span>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-black/10" />
                    <DropdownMenuItem asChild className="cursor-pointer rounded-lg px-3 py-2.5 focus:bg-[#f2ece0] focus:text-[#211c17]">
                      <Link href="/store-manager/restock"><Package /> Restock inventory</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={logout} className="cursor-pointer rounded-lg px-3 py-2.5 text-[#765147] focus:bg-[#f5eae7] focus:text-[#8e3127]">
                      <LogOut /> Logout
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <button onClick={() => setMobileOpen(true)} className="rounded-full border border-black/10 bg-white/60 p-2.5 text-[#211c17] transition-colors hover:border-[#c9a84c]/50 hover:bg-white lg:hidden" aria-label="Open menu">
                  <Menu className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="min-h-screen pt-[92px]">{children}</main>

        <footer className="bg-[#191511] text-white">
          <div className="border-b border-white/10">
            <div className="grid grid-cols-2 md:grid-cols-4">
              {[
                { icon: Shield, label: 'BIS Hallmarked' },
                { icon: Award, label: 'Certified Designs' },
                { icon: Camera, label: 'Virtual Try-On' },
                { icon: Users, label: 'Staff Assisted' },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-3 border-white/10 px-4 py-5 md:border-r md:last:border-r-0 sm:px-6 lg:px-10">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.07]"><Icon className="h-4 w-4 text-[#c9a84c]" /></span>
                  <span className="text-xs font-medium text-white/65 sm:text-sm">{label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mx-auto max-w-[1400px] px-5 py-12 sm:px-6 lg:px-10 xl:px-12">
            <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
              <div>
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={data.retailer.logoUrl || FALLBACK_STORE_LOGO} alt="" className="h-11 w-11 rounded-full object-contain ring-1 ring-[#c9a84c]/30" />
                  <div>
                    <p className="font-display text-lg text-white/90">{data.retailer.name}</p>
                    <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.17em] text-[#c9a84c]">{data.branch.name}</p>
                  </div>
                </div>
                <p className="mt-4 max-w-sm text-sm leading-6 text-white/45">Explore the retailer&apos;s collection with assisted discovery, custom design requests, and virtual try-on.</p>
                {data.retailer.city ? <p className="mt-3 text-xs text-white/35">Visit us in {data.retailer.city}</p> : null}
              </div>
              <FooterColumn title="Discover" links={[
                ['/store-manager/kiosk', 'Catalog'],
                ['/store-manager/search', 'Search by Photo'],
                ['/store-manager/try-on', 'Virtual Try-On'],
              ]} />
              <FooterColumn title="Requests" links={[
                ['/store-manager/custom-design', 'Custom Design'],
                ['/store-manager/my-orders', 'My Orders'],
              ]} />
              <FooterColumn title="Store Operations" links={[
                ['/store-manager/restock', 'Restock'],
                ['/store-manager', 'Storefront Home'],
              ]} />
            </div>
            <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-5 text-[10px] text-white/35 sm:flex-row">
              <span>© {new Date().getFullYear()} {data.retailer.name}. In-store customer experience.</span>
              <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-end">
                <Sparkles className="h-3.5 w-3.5 text-[#c9a84c]" />
                <span>Powered by Jewel Factory</span>
                <button onClick={logout} className="ml-2 inline-flex items-center gap-1 transition-colors hover:text-white"><LogOut className="h-3 w-3" /> Logout</button>
              </div>
            </div>
          </div>
        </footer>

        {mobileOpen ? (
          <div className="fixed inset-0 z-[60] lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation menu">
            <button className="absolute inset-0 animate-in bg-black/45 backdrop-blur-sm duration-200 fade-in" onClick={() => setMobileOpen(false)} aria-label="Close menu" />
            <aside className="absolute right-0 top-0 flex h-full w-[min(90vw,380px)] animate-in flex-col bg-[#fbf8f1] shadow-2xl duration-300 slide-in-from-right">
              <div className="flex items-center justify-between border-b border-black/10 px-5 py-5">
                <div className="flex min-w-0 items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={data.retailer.logoUrl || FALLBACK_STORE_LOGO} alt="" className="h-10 w-10 shrink-0 rounded-full object-contain ring-1 ring-[#c9a84c]/30" />
                  <div className="min-w-0"><p className="truncate font-display text-lg">{data.retailer.name}</p><p className="mt-0.5 truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9b7a3c]">{data.branch.name}</p></div>
                </div>
                <button onClick={() => setMobileOpen(false)} className="ml-3 rounded-full border border-black/10 bg-white/60 p-2 hover:bg-white" aria-label="Close menu"><X className="h-5 w-5" /></button>
              </div>
              <nav className="space-y-1 overflow-y-auto px-4 py-5" aria-label="Mobile storefront navigation">
                <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[#9a8f83]">Storefront</p>
                {mobileNav.map((item) => {
                  const active = isActiveRoute(pathname, item.href, 'exact' in item && item.exact);
                  const Icon = item.icon;
                  return (
                    <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition-colors ${active ? 'bg-[#211c17] text-[#fffaf0] shadow-sm' : 'text-[#544b43] hover:bg-black/5'}`}>
                      <span className={`flex h-8 w-8 items-center justify-center rounded-full ${active ? 'bg-white/10 text-[#efd489]' : 'bg-[#eee7da] text-[#a77d31]'}`}><Icon className="h-4 w-4" /></span>
                      {item.label}
                      {active ? <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#d5ae56]" /> : null}
                    </Link>
                  );
                })}
                <div className="my-4 border-t border-black/10" />
                <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[#9a8f83]">Store operations</p>
                <Link href="/store-manager/restock" className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-[#544b43] hover:bg-black/5"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#eee7da] text-[#a77d31]"><Package className="h-4 w-4" /></span> Restock inventory</Link>
              </nav>
              <div className="mt-auto border-t border-black/10 bg-white/45 p-4">
                <div className="mb-3 flex items-center gap-3 px-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#211c17] text-[10px] font-bold tracking-wide text-[#efd489]">{managerInitials}</span>
                  <div className="min-w-0"><p className="truncate text-sm font-semibold">{data.name}</p><p className="truncate text-xs text-[#80756a]">Store manager</p></div>
                </div>
                <button onClick={logout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-[#765147] hover:bg-[#f5eae7] hover:text-[#8e3127]"><LogOut className="h-4 w-4" /> Logout</button>
              </div>
            </aside>
          </div>
        ) : null}
      </div>
    </StoreManagerProvider>
  );
}

function FooterColumn({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">{title}</p>
      <ul className="space-y-2.5">
        {links.map(([href, label]) => <li key={href}><Link href={href} className="text-sm text-white/55 transition-colors hover:text-white">{label}</Link></li>)}
      </ul>
    </div>
  );
}
