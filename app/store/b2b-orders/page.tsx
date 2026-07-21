'use client';

import { Loader2, Package, Plus, ChevronDown, ChevronUp } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { ImageZoomModal } from '@/components/orders/ImageZoomModal';
import { OrderFilters } from '@/components/orders/OrderFilters';
import { Button } from '@/components/ui/button';
import { useApi } from '@/hooks/use-api';
import { KIOSK_B2B_STATUS_OPTIONS, matchOrder, uniqueBranchOptions } from '@/lib/order-filters';

type Item = { id: string; productNameSnapshot: string | null; productImageSnapshot: string | null; productDesignSnapshot: string | null; quantity: number };
type Order = {
  id: string; orderNumber: string; status: string; totalItems: number;
  branchNameSnapshot: string | null;
  pendingManagerApproval: boolean; trackingNumber: string | null; createdAt: string; items: Item[];
};

const STATUS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800', CONFIRMED: 'bg-blue-100 text-blue-800',
  PACKED: 'bg-purple-100 text-purple-800', SHIPPED: 'bg-indigo-100 text-indigo-800',
  DELIVERED: 'bg-green-100 text-green-800', CANCELLED: 'bg-red-100 text-red-700',
};

export default function StoreB2bOrdersPage() {
  const { data, error, loading } = useApi<Order[]>('/api/store/b2b-orders', '/store/login');
  const [open, setOpen] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [branch, setBranch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [zoomItem, setZoomItem] = useState<Item | null>(null);

  const branchOptions = useMemo(() => uniqueBranchOptions((data ?? []).map((o) => o.branchNameSnapshot)), [data]);
  const filtered = useMemo(
    () => (data ?? []).filter((o) => matchOrder(o, { search, status, branch, branchName: o.branchNameSnapshot, from, to })),
    [data, search, status, branch, from, to],
  );

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-medium tracking-tight">B2B Orders</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Restock orders you placed from the manufacturer catalog.</p>
        </div>
        <Link href="/store/manufacturer-catalog"><Button className="metal-sheen text-[#17120b] font-semibold"><Plus className="mr-1.5 h-4 w-4" />New Order</Button></Link>
      </div>
      {data && data.length > 0 && (
        <OrderFilters
          search={search} onSearch={setSearch}
          status={status} onStatus={setStatus} statusOptions={KIOSK_B2B_STATUS_OPTIONS}
          group={branch} onGroup={setBranch} groupOptions={branchOptions} groupAllLabel="All stores" groupLabel="Store"
          from={from} to={to} onFrom={setFrom} onTo={setTo}
        />
      )}
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {loading && <div className="flex items-center gap-2 py-12 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>}
      {data && data.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
          <Package className="h-10 w-10 text-muted-foreground/40" /><p className="text-sm text-muted-foreground">No B2B orders yet.</p>
        </div>
      )}
      {data && data.length > 0 && filtered.length === 0 && (
        <p className="py-12 text-center text-sm text-muted-foreground">No orders match your filters.</p>
      )}
      {filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map((o) => (
            <div key={o.id} className="rounded-xl border bg-card overflow-hidden">
              <button type="button" onClick={() => setOpen(open === o.id ? null : o.id)} className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/30">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{o.orderNumber}{o.branchNameSnapshot ? <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">{o.branchNameSnapshot}</span> : null}</p>
                  <p className="text-xs text-muted-foreground">{o.totalItems} item(s){o.trackingNumber ? ` · Tracking: ${o.trackingNumber}` : ''}</p>
                </div>
                <div className="flex items-center gap-2">
                  {o.pendingManagerApproval && <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] font-semibold text-yellow-800">Needs approval</span>}
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS[o.status] ?? ''}`}>{o.status.toLowerCase()}</span>
                  {open === o.id ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </div>
              </button>
              {open === o.id && (
                <div className="border-t bg-muted/10 px-4 pb-4 pt-3">
                  <p className="mb-1.5 text-xs uppercase tracking-wider text-muted-foreground">Items</p>
                  <div className="space-y-2">
                    {o.items.map((it) => (
                      <div key={it.id} className="flex items-center gap-3">
                        {it.productImageSnapshot ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={it.productImageSnapshot}
                            alt={it.productNameSnapshot ?? ''}
                            className="h-20 w-20 flex-shrink-0 rounded-lg border bg-white object-contain p-1 cursor-pointer hover:shadow-md transition-shadow"
                            onClick={() => setZoomItem(it)}
                          />
                        ) : <div className="h-20 w-20 flex-shrink-0 rounded-lg border bg-muted" />}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{it.productNameSnapshot ?? 'Product'}</p>
                          {it.productDesignSnapshot && <p className="text-xs text-muted-foreground">{it.productDesignSnapshot}</p>}
                        </div>
                        <span className="text-sm tabular-nums text-muted-foreground">× {it.quantity}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {zoomItem?.productImageSnapshot && (
        <ImageZoomModal
          isOpen={!!zoomItem}
          images={[zoomItem.productImageSnapshot]}
          productName={zoomItem.productNameSnapshot ?? undefined}
          designNumber={zoomItem.productDesignSnapshot ?? undefined}
          onClose={() => setZoomItem(null)}
        />
      )}
    </div>
  );
}
