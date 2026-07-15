'use client';

import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  Users,
  PencilLine,
  Store as StoreIcon,
  ClipboardCheck,
  LogOut,
  Menu,
  X,
  Factory,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';

const NAV = [
  { label: 'Dashboard', href: '/manufacturer/dashboard', icon: LayoutDashboard },
  { label: 'Catalog', href: '/manufacturer/catalog', icon: Package },
  { label: 'B2B Orders', href: '/manufacturer/orders', icon: ShoppingBag },
  { label: 'Kiosk Orders', href: '/manufacturer/kiosk-orders', icon: Users },
  { label: 'Custom Designs', href: '/manufacturer/custom-designs', icon: PencilLine },
  { label: 'Stores', href: '/manufacturer/stores', icon: StoreIcon },
  { label: 'Store Registrations', href: '/manufacturer/store-registrations', icon: ClipboardCheck },
];

export default function ManufacturerLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function signOut() {
    await fetch('/api/manufacturer/logout', { method: 'POST' });
    router.push('/manufacturer/login');
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-60 border-r border-sidebar-border bg-sidebar transition-transform lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center gap-2.5 px-4 py-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Factory className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Manufacturer Portal
              </p>
              <p className="truncate text-sm font-semibold">Jewel Factory</p>
            </div>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
            {NAV.map(({ label, href, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href + '/');
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors ${
                    active
                      ? 'bg-primary text-primary-foreground font-medium'
                      : 'text-foreground/80 hover:bg-sidebar-accent'
                  }`}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  {label}
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-sidebar-border p-3">
            <button
              type="button"
              onClick={signOut}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-red-600 transition-colors hover:bg-red-50"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setOpen(false)} />
      )}

      {/* Main */}
      <div className="flex min-h-screen flex-col lg:ml-60">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-white/90 px-4 backdrop-blur">
          <button type="button" className="lg:hidden" onClick={() => setOpen(true)}>
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <span className="text-sm font-medium">Manufacturer Portal</span>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            Jewel Factory
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
