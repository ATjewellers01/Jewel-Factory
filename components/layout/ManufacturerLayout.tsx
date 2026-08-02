'use client';

import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  PencilLine,
  Store as StoreIcon,
  ClipboardCheck,
  BarChart3,
} from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';

import { PortalShell } from '@/components/layout/PortalShell';
import { useDocumentIdentity } from '@/hooks/use-document-identity';

// Manufacturer-portal display text only: "Purchase manager"/"Retailer" reads as
// "Customer" here. Routes, API paths, and every other portal are unchanged.
const NAV = [
  { label: 'Dashboard', href: '/manufacturer/dashboard', icon: LayoutDashboard, section: 'Overview' },
  { label: 'Intelligence', href: '/manufacturer/intelligence', icon: BarChart3, section: 'Overview' },
  { label: 'Catalogue', href: '/manufacturer/catalog', icon: Package, section: 'Catalogue & orders' },
  { label: 'Catalogue Orders', href: '/manufacturer/orders', icon: ShoppingBag, section: 'Catalogue & orders' },
  { label: 'Customised Orders', href: '/manufacturer/custom-designs', icon: PencilLine, section: 'Catalogue & orders' },
  { label: 'Customers', href: '/manufacturer/stores', icon: StoreIcon, section: 'Customer network' },
  { label: 'Customer Registrations', href: '/manufacturer/store-registrations', icon: ClipboardCheck, section: 'Customer network' },
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
