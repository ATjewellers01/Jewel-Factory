'use client';

import {
  LayoutDashboard, Package, ShoppingBag, PencilLine, ClipboardCheck,
  BarChart3, Lightbulb, Store as StoreIcon, UserCog, Settings, LogOut, Menu, X, Gem, Lock, Building2,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';

// ownerOnly items are hidden for managers.
const NAV = [
  { label: 'Dashboard', href: '/store/dashboard', icon: LayoutDashboard },
  { label: 'Pending Approvals', href: '/store/pending-approvals', icon: ClipboardCheck },
  { label: 'Manufacturer Catalog', href: '/store/manufacturer-catalog', icon: Gem, ownerOnly: true },
  { label: 'B2B Orders', href: '/store/b2b-orders', icon: Package },
  { label: 'Kiosk Orders', href: '/store/kiosk-orders', icon: ShoppingBag },
  { label: 'Custom Designs', href: '/store/custom-designs', icon: PencilLine },
  { label: 'Intelligence', href: '/store/intelligence', icon: Lightbulb },
  { label: 'Analytics', href: '/store/analytics', icon: BarChart3 },
  { label: 'Kiosk PIN', href: '/store/kiosk-pin', icon: Lock }, // owner + manager
  { label: 'Stores (Branches)', href: '/store/branches', icon: Building2, ownerOnly: true },
  { label: 'Store Profile', href: '/store/profile', icon: StoreIcon, ownerOnly: true },
  { label: 'Managers (HO)', href: '/store/managers', icon: UserCog, ownerOnly: true },
  { label: 'Settings', href: '/store/settings', icon: Settings, ownerOnly: true },
];

export default function StoreLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isOwner, setIsOwner] = useState<boolean | null>(null);
  const [storeName, setStoreName] = useState<string>('Your Store');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/manager/me', { cache: 'no-store', credentials: 'same-origin' });
        if (res.status === 401) { router.push('/store/manager/login'); return; }
        const json = (await res.json()) as { data?: { role: string; storeName?: string; name?: string } };
        if (json.data) {
          setIsOwner(json.data.role === 'owner');
          if (json.data.storeName) setStoreName(json.data.storeName);
        }
      } catch { /* ignore */ }
    })();
  }, [router]);

  async function signOut() {
    await Promise.all([
      fetch('/api/store/logout', { method: 'POST' }),
      fetch('/api/manager/logout', { method: 'POST' }),
    ]);
    router.push('/portal');
  }

  const items = NAV.filter((n) => !n.ownerOnly || isOwner);

  return (
    <div className="min-h-screen bg-background">
      <aside className={`fixed inset-y-0 left-0 z-50 w-60 border-r border-sidebar-border bg-sidebar transition-transform lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-full flex-col">
          <div className="flex items-center gap-2.5 px-4 py-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <StoreIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                {isOwner === false ? 'Manager Portal' : 'Store Portal'}
              </p>
              <p className="truncate text-sm font-semibold">{storeName}</p>
            </div>
          </div>
          <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
            {items.map(({ label, href, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href + '/');
              return (
                <Link key={href} href={href} onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors ${active ? 'bg-primary text-primary-foreground font-medium' : 'text-foreground/80 hover:bg-sidebar-accent'}`}>
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  {label}
                </Link>
              );
            })}
          </nav>
          <div className="border-t border-sidebar-border p-3">
            <button type="button" onClick={signOut} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-red-600 transition-colors hover:bg-red-50">
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        </div>
      </aside>

      {open && <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setOpen(false)} />}

      <div className="flex min-h-screen flex-col lg:ml-60">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-white/90 px-4 backdrop-blur">
          <button type="button" className="lg:hidden" onClick={() => setOpen(true)}>
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <span className="text-sm font-medium">{storeName}</span>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            {isOwner === false ? 'Manager' : 'Store Portal'}
          </span>
        </header>
        <main className="flex-1 p-3 sm:p-4 md:p-6">{children}</main>
        <footer className="mt-auto border-t px-4 py-4 text-center text-xs text-muted-foreground">
          Powered by Jewel Factory
        </footer>
      </div>
    </div>
  );
}
