'use client';

import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  Users,
  PencilLine,
  Store as StoreIcon,
  ClipboardCheck,
  BarChart3,
} from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';

import { PortalShell } from '@/components/layout/PortalShell';
import { useDocumentIdentity } from '@/hooks/use-document-identity';

const NAV = [
  { label: 'Dashboard', href: '/manufacturer/dashboard', icon: LayoutDashboard, section: 'Overview' },
  { label: 'Intelligence', href: '/manufacturer/intelligence', icon: BarChart3, section: 'Overview' },
  { label: 'Catalog', href: '/manufacturer/catalog', icon: Package, section: 'Catalog & orders' },
  { label: 'B2B Orders', href: '/manufacturer/orders', icon: ShoppingBag, section: 'Catalog & orders' },
  { label: 'Kiosk Orders', href: '/manufacturer/kiosk-orders', icon: Users, section: 'Catalog & orders' },
  { label: 'Custom Designs', href: '/manufacturer/custom-designs', icon: PencilLine, section: 'Catalog & orders' },
  { label: 'Retailers', href: '/manufacturer/stores', icon: StoreIcon, section: 'Retailer network' },
  { label: 'Retailer Registrations', href: '/manufacturer/store-registrations', icon: ClipboardCheck, section: 'Retailer network' },
];

export default function ManufacturerLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const pageLabel = NAV.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))?.label ?? 'Dashboard';

  useDocumentIdentity(pageLabel);

  async function signOut() {
    await fetch('/api/manufacturer/logout', { method: 'POST' });
    router.push('/manufacturer/login');
  }

  return (
    <PortalShell
      brandName="Jewel Factory"
      brandLogo="/JF.avif"
      fallbackLogo="/logo-icon.png"
      portalLabel="Manufacturer portal"
      roleLabel="Manufacturer"
      pageLabel={pageLabel}
      nav={NAV}
      onSignOut={signOut}
    >
      {children}
    </PortalShell>
  );
}
