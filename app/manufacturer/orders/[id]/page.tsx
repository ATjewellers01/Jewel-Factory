'use client';

import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { useApi, apiSend } from '@/hooks/use-api';

type Item = { id: string; productNameSnapshot: string | null; productImageSnapshot: string | null; productDesignSnapshot: string | null; quantity: number };
type Order = {
  id: string; orderNumber: string; status: string; totalItems: number; deliveryAddress: string;
  notes: string | null; trackingNumber: string | null; createdAt: string;
  storeName: string | null; storeCity: string | null; items: Item[];
};

const STATUS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800', CONFIRMED: 'bg-blue-100 text-blue-800',
  PACKED: 'bg-purple-100 text-purple-800', SHIPPED: 'bg-indigo-100 text-indigo-800',
  DELIVERED: 'bg-green-100 text-green-800', CANCELLED: 'bg-red-100 text-red-700',
};
const NEXT: Record<string, string> = { PENDING: 'CONFIRMED', CONFIRMED: 'PACKED', PACKED: 'SHIPPED', SHIPPED: 'DELIVERED' };

export default function ManufacturerOrderDetailPage() {
  const id = useParams().id as string;
  const { data, error, loading, reload } = useApi<Order>(`/api/manufacturer/orders/${id}`, '/manufacturer/login');
  const [busy, setBusy] = useState(false);
  const [tracking, setTracking] = useState('');

  async function advance(status: string) {
    setBusy(true);
    try {
      await apiSend('PATCH', `/api/manufacturer/orders/${id}`, { status, trackingNumber: tracking || undefined });
      void reload();
    } catch (e) { alert(e instanceof Error ? e.message : 'Failed'); } finally { setBusy(false); }
  }

  if (error) return <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>;
  if (loading || !data) return <div className="flex items-center gap-2 py-16 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>;

  const next = NEXT[data.status];
  return (
    <div className="mx-auto w-full max-w-2xl space-y-5">
      <Link href="/manufacturer/orders" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Orders</Link>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold">{data.orderNumber}</h1>
          {data.storeName && <p className="mt-0.5 text-sm font-medium text-primary">{data.storeName}{data.storeCity ? ` · ${data.storeCity}` : ''}</p>}
          <p className="mt-0.5 text-sm text-muted-foreground">{new Date(data.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-sm font-medium ${STATUS[data.status] ?? ''}`}>{data.status.toLowerCase()}</span>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Delivery Address (store)</p>
        <p className="text-sm">{data.deliveryAddress}</p>
        {data.notes && <p className="mt-2 text-xs text-muted-foreground">Note: {data.notes}</p>}
        {data.trackingNumber && <p className="mt-1 text-xs font-medium text-primary">Tracking: {data.trackingNumber}</p>}
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="border-b bg-muted/40 px-4 py-3"><p className="text-sm font-medium">Items ({data.totalItems})</p></div>
        <div className="divide-y">
          {data.items.map((i) => (
            <div key={i.id} className="flex items-center gap-3 px-4 py-3">
              {i.productImageSnapshot ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={i.productImageSnapshot} alt={i.productNameSnapshot ?? ''} className="h-20 w-20 flex-shrink-0 rounded-lg border bg-white object-contain p-1" />
              ) : <div className="h-20 w-20 flex-shrink-0 rounded-lg border bg-muted" />}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{i.productNameSnapshot ?? 'Product'}</p>
                {i.productDesignSnapshot && <p className="text-xs text-muted-foreground">{i.productDesignSnapshot}</p>}
              </div>
              <span className="text-sm tabular-nums text-muted-foreground">× {i.quantity}</span>
            </div>
          ))}
        </div>
      </div>

      {next && data.status !== 'CANCELLED' && (
        <div className="rounded-xl border bg-card p-4 space-y-3">
          {data.status === 'PACKED' && (
            <input placeholder="Tracking number (optional)" value={tracking} onChange={(e) => setTracking(e.target.value)} className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" />
          )}
          <Button onClick={() => advance(next)} disabled={busy} className="metal-sheen text-[#17120b] font-semibold">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : `Mark as ${next.toLowerCase()}`}
          </Button>
        </div>
      )}
    </div>
  );
}
