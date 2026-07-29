'use client';

import { Loader2, ShoppingBag, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { OrderFilters } from '@/components/orders/OrderFilters';
import { useApi } from '@/hooks/use-api';
import { KIOSK_B2B_STATUS_OPTIONS, matchOrder, uniqueBranchOptions } from '@/lib/order-filters';

type Order = { id: string; orderNumber: string; status: string; totalItems: number; createdAt: string; storeName: string | null; storeCity: string | null };

const STATUS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800', CONFIRMED: 'bg-blue-100 text-blue-800',
  PACKED: 'bg-purple-100 text-purple-800', SHIPPED: 'bg-indigo-100 text-indigo-800',
  DELIVERED: 'bg-green-100 text-green-800', CANCELLED: 'bg-red-100 text-red-700',
};

export default function ManufacturerOrdersPage() {
  const { data, error, loading } = useApi<Order[]>('/api/manufacturer/orders', '/manufacturer/login');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [retailer, setRetailer] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const retailerOptions = useMemo(() => uniqueBranchOptions((data ?? []).map((o) => o.storeName)), [data]);
  const filtered = useMemo(
    () => (data ?? []).filter((o) => matchOrder(o, { search, status, branch: retailer, branchName: o.storeName, from, to })),
    [data, search, status, retailer, from, to],
  );

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4">
      <div>
        <h1 className="text-2xl font-medium tracking-tight">Catalog Orders</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Restock orders placed by stores from your catalog.</p>
      </div>
      {data && data.length > 0 && (
        <OrderFilters
          search={search} onSearch={setSearch}
          status={status} onStatus={setStatus} statusOptions={KIOSK_B2B_STATUS_OPTIONS}
          group={retailer} onGroup={setRetailer} groupOptions={retailerOptions} groupAllLabel="All purchase managers" groupLabel="Purchase manager"
          from={from} to={to} onFrom={setFrom} onTo={setTo}
        />
      )}
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {loading && <div className="flex items-center gap-2 py-12 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>}
      {data && data.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
          <ShoppingBag className="h-10 w-10 text-muted-foreground/40" /><p className="text-sm text-muted-foreground">No orders yet.</p>
        </div>
      )}
      {data && data.length > 0 && filtered.length === 0 && (
        <p className="py-12 text-center text-sm text-muted-foreground">No orders match your filters.</p>
      )}
      {filtered.length > 0 && (
        <div className="rounded-xl border bg-card overflow-hidden divide-y">
          {filtered.map((o) => (
            <Link key={o.id} href={`/manufacturer/orders/${o.id}`}>
              <div className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/30">
                <div className="grid flex-1 grid-cols-2 gap-x-4 sm:grid-cols-4">
                  <div><p className="text-xs text-muted-foreground">Order</p><p className="text-sm font-medium">{o.orderNumber}</p></div>
                  <div><p className="text-xs text-muted-foreground">Store</p><p className="text-sm font-medium text-primary truncate">{o.storeName ?? '—'}</p>{o.storeCity && <p className="text-xs text-muted-foreground">{o.storeCity}</p>}</div>
                  <div><p className="text-xs text-muted-foreground">Items</p><p className="text-sm tabular-nums">{o.totalItems}</p></div>
                  <div className="flex items-start"><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS[o.status] ?? ''}`}>{o.status.toLowerCase()}</span></div>
                </div>
                <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
