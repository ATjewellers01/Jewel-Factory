'use client';

import {
  LayoutDashboard, Package, ShoppingBag, PencilLine, ClipboardCheck,
  Lightbulb, Store as StoreIcon, Settings, Gem, Building2, Search,
} from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';

import { PortalShell } from '@/components/layout/PortalShell';
import { useDocumentIdentity } from '@/hooks/use-document-identity';

const FALLBACK_STORE_LOGO = '/storeRe-logo.avif';

// The Retailer (store owner) is the only account that logs into this portal and
// does everything (own tasks + all order/custom/restock approvals + chat).
const NAV = [
  { label: 'Dashboard', href: '/store/dashboard', icon: LayoutDashboard, section: 'Overview' },
  { label: 'Pending Approvals', href: '/store/pending-approvals', icon: ClipboardCheck, section: 'Operations' },
  { label: 'Manufacturer Catalog', href: '/store/manufacturer-catalog', icon: Gem, section: 'Operations' },
  { label: 'Similar Design Search', href: '/store/similar-search', icon: Search, section: 'Operations' },
  { label: 'B2B Orders', href: '/store/b2b-orders', icon: Package, section: 'Operations' },
  { label: 'Kiosk Orders', href: '/store/kiosk-orders', icon: ShoppingBag, section: 'Operations' },
  { label: 'Custom Designs', href: '/store/custom-designs', icon: PencilLine, section: 'Operations' },
  { label: 'Intelligence', href: '/store/intelligence', icon: Lightbulb, section: 'Insights' },
  // Kiosk PIN is managed per-Store on the Stores (Branches) page.
  { label: 'Stores (Branches)', href: '/store/branches', icon: Building2, section: 'Account' },
  { label: 'Retailer Profile', href: '/store/profile', icon: StoreIcon, section: 'Account' },
  { label: 'Settings', href: '/store/settings', icon: Settings, section: 'Account' },
];

type StoreMe = { name?: string; slug?: string; city?: string | null; logoUrl?: string | null };

export default function StoreLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [store, setStore] = useState<StoreMe>({ name: 'Your Store' });

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

  async function signOut() {
    await fetch('/api/store/logout', { method: 'POST' });
    router.push('/');
  }

  const storeName = store.name || 'Your Store';
  const pageLabel = NAV.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))?.label ?? 'Dashboard';

  useDocumentIdentity(pageLabel, { storeName, logoUrl: store.logoUrl });

  return (
    <PortalShell
      brandName={storeName}
      brandLogo={store.logoUrl || FALLBACK_STORE_LOGO}
      fallbackLogo={FALLBACK_STORE_LOGO}
      portalLabel="Retailer portal"
      roleLabel="Retailer"
      pageLabel={pageLabel}
      nav={NAV}
      onSignOut={signOut}
    >
      {children}
    </PortalShell>
  );
}
