'use client';

import type { LucideIcon } from 'lucide-react';
import { LogOut, Menu, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';

import { SUPPORT_EMAIL, SUPPORT_EMAIL_HREF, SUPPORT_PHONE, SUPPORT_PHONE_HREF } from '@/lib/support';

export type PortalNavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  section?: string;
};

type PortalShellProps = {
  brandName: string;
  brandLogo: string;
  fallbackLogo: string;
  portalLabel: string;
  roleLabel: string;
  pageLabel: string;
  nav: PortalNavItem[];
  onSignOut: () => void | Promise<void>;
  children: ReactNode;
};

export function PortalShell({
  brandName,
  brandLogo,
  fallbackLogo,
  portalLabel,
  roleLabel,
  pageLabel,
  nav,
  onSignOut,
  children,
}: PortalShellProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [open]);

  const sections = Array.from(new Set(nav.map((item) => item.section).filter(Boolean))) as string[];
  const grouped = sections.length > 0;

  return (
    <div className="min-h-screen bg-[#f8f7f3] text-[#26221e]">
      <title>{`${pageLabel} | ${brandName}`}</title>
      <link rel="icon" href={brandLogo || fallbackLogo} />
      <aside className={`fixed inset-y-0 left-0 z-50 w-[248px] border-r border-[#e8e3da] bg-[#fffdfa] transition-transform duration-200 lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-full flex-col">
          <div className="flex h-[78px] items-center gap-3 border-b border-[#eee9e1] px-5">
            <BrandLogo src={brandLogo} fallback={fallbackLogo} name={brandName} />
            <div className="min-w-0">
              <p className="text-[9px] font-bold uppercase tracking-[0.17em] text-[#9b8f82]">{portalLabel}</p>
              <p className="mt-0.5 truncate text-sm font-semibold text-[#26221e]">{brandName}</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="ml-auto rounded-lg p-2 text-[#746b62] hover:bg-[#f2eee7] lg:hidden" aria-label="Close navigation">
              <X className="h-4 w-4" />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label={`${portalLabel} navigation`}>
            {grouped ? sections.map((section) => (
              <div key={section} className="mb-5 last:mb-0">
                <p className="mb-1.5 px-3 text-[9px] font-bold uppercase tracking-[0.16em] text-[#aaa096]">{section}</p>
                <NavItems items={nav.filter((item) => item.section === section)} pathname={pathname} />
              </div>
            )) : <NavItems items={nav} pathname={pathname} />}
          </nav>

          <div className="border-t border-[#eee9e1] p-3">
            <button type="button" onClick={onSignOut} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-[#9f4037] transition-colors hover:bg-[#fff1ef]">
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        </div>
      </aside>

      {open ? <button type="button" className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px] lg:hidden" onClick={() => setOpen(false)} aria-label="Close navigation" /> : null}

      <div className="flex min-h-screen flex-col lg:ml-[248px]">
        <header className="sticky top-0 z-30 flex h-[66px] items-center gap-3 border-b border-[#e8e3da] bg-white/90 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
          <button type="button" className="rounded-lg border border-[#e3ddd3] bg-white p-2 text-[#554e47] shadow-sm lg:hidden" onClick={() => setOpen(true)} aria-label="Open navigation">
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <p className="truncate text-[11px] font-medium text-[#8d8379]">{brandName}</p>
            <p className="truncate text-sm font-semibold text-[#26221e]">{pageLabel}</p>
          </div>
          <span className="ml-auto rounded-full border border-[#eadfca] bg-[#fbf6ea] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.11em] text-[#9a7229]">
            {roleLabel}
          </span>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>

        {/* flex-wrap + centred on mobile so the support contact can drop to its
            own line instead of squeezing the other two items. */}
        <footer className="flex flex-col items-center justify-between gap-2 border-t border-[#e8e3da] bg-white px-4 py-4 text-[11px] text-[#8d8379] sm:flex-row sm:flex-wrap sm:px-6 lg:px-8">
          <span>{brandName} · {portalLabel}</span>
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
      </div>
    </div>
  );
}

function NavItems({ items, pathname }: { items: PortalNavItem[]; pathname: string }) {
  return (
    <div className="space-y-1">
      {items.map(({ label, href, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link key={href} href={href} aria-current={active ? 'page' : undefined} className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-colors ${active ? 'bg-[#c99d37] text-white shadow-[0_5px_16px_rgba(174,127,30,0.18)]' : 'text-[#5f5750] hover:bg-[#f3efe8] hover:text-[#26221e]'}`}>
            <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-white' : 'text-[#756d65] group-hover:text-[#a77d31]'}`} />
            <span className="truncate">{label}</span>
          </Link>
        );
      })}
    </div>
  );
}

function BrandLogo({ src, fallback, name }: { src: string; fallback: string; name: string }) {
  return (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#eadfca] bg-[#fbf6ea] p-1.5 shadow-sm">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src || fallback} alt={`${name} logo`} className="h-full w-full object-contain" onError={(event) => { event.currentTarget.src = fallback; }} />
    </span>
  );
}
