'use client';

import { Loader2, PencilLine, ChevronDown, ChevronUp } from 'lucide-react';
import { useMemo, useState } from 'react';

import { ImageZoomModal } from '@/components/orders/ImageZoomModal';
import { OrderFilters } from '@/components/orders/OrderFilters';
import { Button } from '@/components/ui/button';
import { useApi, apiSend } from '@/hooks/use-api';
import { CUSTOM_ORDER_STATUS_OPTIONS, matchOrder, uniqueBranchOptions } from '@/lib/order-filters';

type Order = {
  id: string; orderNumber: string; storeNameSnapshot: string; storeAddressSnapshot: string;
  category: string; weightGrams: string | null; purity: string | null;
  referenceImageUrl: string | null; designNotes: string | null;
  status: string; trackingNumber: string | null; createdAt: string;
};

const STATUS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800', CONFIRMED: 'bg-blue-100 text-blue-800',
  IN_PRODUCTION: 'bg-purple-100 text-purple-800', PACKED: 'bg-indigo-100 text-indigo-800',
  SHIPPED: 'bg-amber-100 text-amber-800', DELIVERED: 'bg-green-100 text-green-800', CANCELLED: 'bg-red-100 text-red-700',
};
const NEXT: Record<string, string> = { PENDING: 'CONFIRMED', CONFIRMED: 'IN_PRODUCTION', IN_PRODUCTION: 'PACKED', PACKED: 'SHIPPED', SHIPPED: 'DELIVERED' };

export default function ManufacturerCustomDesignsPage() {
  const { data, error, loading, reload } = useApi<Order[]>('/api/manufacturer/custom-designs', '/manufacturer/login');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [retailer, setRetailer] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [zoomUrl, setZoomUrl] = useState<string | null>(null);

  const retailerOptions = useMemo(() => uniqueBranchOptions((data ?? []).map((o) => o.storeNameSnapshot)), [data]);
  const filtered = useMemo(
    () => (data ?? []).filter((o) => matchOrder(o, { search, status, searchLabel: o.category, branch: retailer, branchName: o.storeNameSnapshot, from, to })),
    [data, search, status, retailer, from, to],
  );

  async function advance(id: string, status: string) {
    setBusy(id);
    try { await apiSend('PATCH', `/api/manufacturer/custom-designs/${id}`, { status }); void reload(); }
    catch (e) { alert(e instanceof Error ? e.message : 'Failed'); } finally { setBusy(null); }
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-medium tracking-tight">Custom Design Orders</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Sanitized from stores — no customer data. Ship to the store address.</p>
      </div>
      {data && data.length > 0 && (
        <OrderFilters
          search={search} onSearch={setSearch} searchPlaceholder="Search by order ID / category…"
          status={status} onStatus={setStatus} statusOptions={CUSTOM_ORDER_STATUS_OPTIONS}
          group={retailer} onGroup={setRetailer} groupOptions={retailerOptions} groupAllLabel="All retailers" groupLabel="Retailer"
          from={from} to={to} onFrom={setFrom} onTo={setTo}
        />
      )}
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {loading && <div className="flex items-center gap-2 py-12 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>}
      {data && data.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
          <PencilLine className="h-10 w-10 text-muted-foreground/40" /><p className="text-sm text-muted-foreground">No custom design orders yet.</p>
        </div>
      )}
      {data && data.length > 0 && filtered.length === 0 && (
        <p className="py-12 text-center text-sm text-muted-foreground">No orders match your filters.</p>
      )}
      {filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map((o) => (
            <div key={o.id} className="rounded-xl border bg-card overflow-hidden">
              <button type="button" onClick={() => setExpanded(expanded === o.id ? null : o.id)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/30">
                <div className="grid flex-1 grid-cols-2 gap-x-4 sm:grid-cols-4">
                  <div><p className="text-xs text-muted-foreground">Order</p><p className="text-sm font-medium">{o.orderNumber}</p></div>
                  <div><p className="text-xs text-muted-foreground">Store</p><p className="text-sm font-medium text-primary truncate">{o.storeNameSnapshot}</p></div>
                  <div><p className="text-xs text-muted-foreground">Category</p><p className="text-sm">{o.category}</p></div>
                  <div className="flex items-start"><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS[o.status] ?? ''}`}>{o.status.replace('_', ' ').toLowerCase()}</span></div>
                </div>
                {expanded === o.id ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </button>
              {expanded === o.id && (
                <div className="border-t bg-muted/10 px-4 pb-4 pt-3 space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                    {o.weightGrams && <div><p className="text-xs text-muted-foreground">Weight</p><p>{o.weightGrams}g</p></div>}
                    {o.purity && <div><p className="text-xs text-muted-foreground">Purity</p><p>{o.purity}</p></div>}
                    {o.trackingNumber && <div><p className="text-xs text-muted-foreground">Tracking</p><p className="font-mono text-xs">{o.trackingNumber}</p></div>}
                  </div>
                  <div><p className="text-xs text-muted-foreground uppercase tracking-wider">Ship to (store address)</p><p className="text-sm">{o.storeAddressSnapshot}</p></div>
                  {o.designNotes && <div><p className="text-xs text-muted-foreground uppercase tracking-wider">Design Notes</p><p className="text-sm">{o.designNotes}</p></div>}
                  {o.referenceImageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={o.referenceImageUrl}
                      alt="reference"
                      className="max-h-56 rounded-lg border object-contain cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => setZoomUrl(o.referenceImageUrl)}
                    />
                  )}
                  <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2 text-xs text-blue-700">Customer details are not shared. Ship to the store address above.</div>
                  {NEXT[o.status] && (
                    <Button size="sm" disabled={busy === o.id} onClick={() => advance(o.id, NEXT[o.status])} className="metal-sheen text-[#17120b] font-semibold">
                      {busy === o.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : `Mark as ${NEXT[o.status].replace('_', ' ').toLowerCase()}`}
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {zoomUrl && (
        <ImageZoomModal
          isOpen={!!zoomUrl}
          images={[zoomUrl]}
          productName="Reference Image"
          onClose={() => setZoomUrl(null)}
        />
      )}
    </div>
  );
}
