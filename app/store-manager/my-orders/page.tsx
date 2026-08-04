'use client';

import { BranchOrderList } from '@/components/orders/BranchOrderList';

// Restock lives under its own PIN gate (/store-manager/restock) — its order
// history moved there too, so everything restock-related sits behind one PIN.
// Customised design requests are no longer raised by the Retailer User —
// only Kiosk orders are tracked here (see the 2026-08-04 punch list: item 1
// removed the Custom Design feature from this portal entirely).
export default function MyOrdersPage() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6">
      <div className="mb-4">
        <h1 className="font-display text-2xl font-medium tracking-tight">My Orders</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Orders you sent to Head Office — track status, message Head Office, and mark completed.</p>
      </div>
      <BranchOrderList kind="kiosk" endpoint="/api/branch-manager/my-orders/kiosk" />
    </div>
  );
}
