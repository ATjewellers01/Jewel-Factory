'use client';

import { CheckCircle2 } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { CatalogOrderPanel } from '../CatalogOrderPanel';

export default function StoreManagerKioskPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [placed, setPlaced] = useState<string | null>(null);
  const openCart = searchParams.get('cart') === 'open';

  useEffect(() => {
    if (openCart) router.replace('/store-manager/kiosk', { scroll: false });
  }, [openCart, router]);

  if (placed) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center py-20 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-700"><CheckCircle2 className="h-7 w-7" /></div>
        <h1 className="mt-4 font-display text-2xl font-medium">Order sent</h1>
        <p className="mt-2 text-sm text-muted-foreground">Order <span className="font-mono">{placed}</span> was sent to Head Office for approval.</p>
        <Button className="mt-6 metal-sheen text-[#17120b] font-semibold" onClick={() => setPlaced(null)}>New order</Button>
      </div>
    );
  }

  return (
    <CatalogOrderPanel
      title="Kiosk"
      subtitle="Browse with the customer and place their order. It goes to Head Office for approval."
      placeEndpoint="/api/branch-manager/kiosk-orders"
      notePlaceholder="Customer's requirement, e.g. size, engraving, timeline…"
      onPlaced={(o) => setPlaced(o.orderNumber ?? 'placed')}
      openCartOnMount={openCart}
    />
  );
}
