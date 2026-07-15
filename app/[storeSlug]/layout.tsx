import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

import { prisma } from '@/lib/prisma';
import { StoreProvider, type KioskStore } from '@/components/kiosk/StoreContext';
import { KioskHeader } from '@/components/kiosk/KioskHeader';
import { KioskGate } from '@/components/kiosk/KioskGate';

async function resolveStore(slug: string): Promise<KioskStore | null> {
  const store = await prisma.store.findFirst({
    where: { slug, isActive: true, registrationStatus: 'APPROVED' },
    select: { id: true, name: true, slug: true, city: true, logoUrl: true, tagline: true },
  });
  return store;
}

export default async function KioskLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ storeSlug: string }>;
}) {
  const { storeSlug } = await params;
  const store = await resolveStore(storeSlug);
  if (!store) notFound();

  return (
    <StoreProvider store={store}>
      <div className="flex min-h-screen flex-col">
        <KioskHeader />
        <div className="flex-1 pt-[88px]">
          <KioskGate>{children}</KioskGate>
        </div>
        <footer className="mt-auto border-t bg-[#1A1A1A] py-8 text-center text-white/70">
          <p className="font-display text-lg">{store.name}</p>
          {store.tagline && <p className="mt-1 text-sm text-white/50">{store.tagline}</p>}
          <p className="mt-3 text-xs text-white/40">Powered by Jewel Factory</p>
        </footer>
      </div>
    </StoreProvider>
  );
}
