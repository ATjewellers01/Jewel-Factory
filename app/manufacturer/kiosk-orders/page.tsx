'use client';

import { Loader2, Users, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { useApi, apiSend } from '@/hooks/use-api';

// Manufacturer view: NO customer PII, NO amount. Ships to store address.
type Item = { id: string; productNameSnapshot: string; productImageSnapshot: string | null; categorySnapshot: string | null; quantity: number };
type Order = {
  id: string; orderNumber: string; status: string; totalItems: number;
  storeNameSnapshot: string; storeCitySnapshot: string | null;
  shipToStoreAddress: string; createdAt: string; items?: Item[];
};

const STATUS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800', CONFIRMED: 'bg-blue-100 text-blue-800',
  PACKED: 'bg-purple-100 text-purple-800', SHIPPED: 'bg-indigo-100 text-indigo-800',
  DELIVERED: 'bg-green-100 text-green-800', CANCELLED: 'bg-red-100 text-red-700',
};
const NEXT: Record<string, string> = { PENDING: 'CONFIRMED', CONFIRMED: 'PACKED', PACKED: 'SHIPPED', SHIPPED: 'DELIVERED' };

export default function ManufacturerKioskOrdersPage() {
  const { data, error, loading, reload } = useApi<Order[]>('/api/manufacturer/kiosk-orders', '/manufacturer/login');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [detail, setDetail] = useState<Order | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function toggle(id: string) {
    if (expanded === id) { setExpanded(null); setDetail(null); return; }
    setExpanded(id); setDetail(null);
    const res = await fetch(`/api/manufacturer/kiosk-orders/${id}`, { cache: 'no-store' });
    const json = (await res.json()) as { data?: Order };
    if (json.data) setDetail(json.data);
  }

  async function advance(id: string, status: string) {
    setBusy(id);
    try { await apiSend('PATCH', `/api/manufacturer/kiosk-orders/${id}`, { status }); void reload(); }
    catch (e) { alert(e instanceof Error ? e.message : 'Failed'); } finally { setBusy(null); }
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4">
      <div>
        <h1 className="text-2xl font-medium tracking-tight">Kiosk Orders</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Guest orders from store kiosks. Ship to the store address shown.</p>
      </div>
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {loading && <div className="flex items-center gap-2 py-12 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>}
      {data && data.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
          <Users className="h-10 w-10 text-muted-foreground/40" /><p className="text-sm text-muted-foreground">No kiosk orders yet.</p>
        </div>
      )}
      {data && data.length > 0 && (
        <div className="rounded-xl border bg-card overflow-hidden divide-y">
          {data.map((o) => (
            <div key={o.id}>
              <button type="button" onClick={() => toggle(o.id)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/30">
                <div className="grid flex-1 grid-cols-2 gap-x-4 sm:grid-cols-4">
                  <div><p className="text-xs text-muted-foreground">Order</p><p className="text-sm font-medium">{o.orderNumber}</p></div>
                  <div><p className="text-xs text-muted-foreground">Store</p><p className="text-sm font-medium text-primary truncate">{o.storeNameSnapshot}</p>{o.storeCitySnapshot && <p className="text-xs text-muted-foreground">{o.storeCitySnapshot}</p>}</div>
                  <div><p className="text-xs text-muted-foreground">Items</p><p className="text-sm tabular-nums">{o.totalItems}</p></div>
                  <div className="flex items-start"><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS[o.status] ?? ''}`}>{o.status.toLowerCase()}</span></div>
                </div>
                {expanded === o.id ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </button>
              {expanded === o.id && (
                <div className="border-t bg-muted/10 px-4 pb-4 pt-3 space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Ship to (store address)</p>
                    <p className="text-sm">{o.shipToStoreAddress || '—'}</p>
                  </div>
                  {detail?.items && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5">Items</p>
                      <div className="space-y-2">
                        {detail.items.map((it) => (
                          <div key={it.id} className="flex items-center gap-3">
                            {it.productImageSnapshot ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={it.productImageSnapshot} alt={it.productNameSnapshot} className="h-10 w-10 flex-shrink-0 rounded-lg border object-cover" />
                            ) : <div className="h-10 w-10 flex-shrink-0 rounded-lg border bg-muted" />}
                            <span className="flex-1 text-sm">{it.productNameSnapshot}</span>
                            <span className="text-sm tabular-nums text-muted-foreground">× {it.quantity}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {NEXT[o.status] && (
                    <Button size="sm" disabled={busy === o.id} onClick={() => advance(o.id, NEXT[o.status])} className="metal-sheen text-[#17120b] font-semibold">
                      {busy === o.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : `Mark as ${NEXT[o.status].toLowerCase()}`}
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
