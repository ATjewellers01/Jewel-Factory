'use client';

import { CheckCircle2, XCircle, Loader2, ClipboardCheck } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { useApi, apiPost } from '@/hooks/use-api';

type Item = { id: string; productNameSnapshot: string | null; productImageSnapshot: string | null; quantity: number };
type KioskOrder = { id: string; orderNumber: string; customerName: string; totalItems: number; pickupStore: boolean; createdAt: string; items: Item[] };
type B2bOrder = { id: string; orderNumber: string; totalItems: number; createdAt: string; items: Item[] };

export default function PendingApprovalsPage() {
  const kiosk = useApi<KioskOrder[]>('/api/store/kiosk-orders/pending', '/store/login');
  const b2b = useApi<B2bOrder[]>('/api/store/b2b-orders/pending', '/store/login');
  const [busy, setBusy] = useState<string | null>(null);

  async function act(kind: 'kiosk' | 'b2b', id: string, action: 'approve' | 'reject') {
    setBusy(id + action);
    try {
      await apiPost(`/api/store/${kind === 'kiosk' ? 'kiosk-orders' : 'b2b-orders'}/${id}/${action}`);
      if (kind === 'kiosk') void kiosk.reload(); else void b2b.reload();
    } catch { /* ignore */ } finally { setBusy(null); }
  }

  const loading = kiosk.loading || b2b.loading;
  const empty = (kiosk.data?.length ?? 0) === 0 && (b2b.data?.length ?? 0) === 0;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-medium tracking-tight">Pending Approvals</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Approve to forward to the manufacturer, or reject.</p>
      </div>

      {loading && <div className="flex items-center gap-2 py-12 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>}

      {!loading && empty && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
          <ClipboardCheck className="h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Nothing pending. You&apos;re all caught up.</p>
        </div>
      )}

      {!loading && (kiosk.data?.length ?? 0) > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Kiosk Orders</h2>
          {kiosk.data!.map((o) => (
            <Row key={o.id} title={o.orderNumber} sub={`${o.customerName} · ${o.totalItems} item(s) · ${o.pickupStore ? 'Pickup' : 'Delivery'}`}
              items={o.items} busy={busy?.startsWith(o.id) ?? false}
              onApprove={() => act('kiosk', o.id, 'approve')} onReject={() => act('kiosk', o.id, 'reject')} />
          ))}
        </section>
      )}

      {!loading && (b2b.data?.length ?? 0) > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">B2B Restock Orders</h2>
          {b2b.data!.map((o) => (
            <Row key={o.id} title={o.orderNumber} sub={`${o.totalItems} item(s)`}
              items={o.items} busy={busy?.startsWith(o.id) ?? false}
              onApprove={() => act('b2b', o.id, 'approve')} onReject={() => act('b2b', o.id, 'reject')} />
          ))}
        </section>
      )}
    </div>
  );
}

function Row({ title, sub, items, busy, onApprove, onReject }: { title: string; sub: string; items: Item[]; busy: boolean; onApprove: () => void; onReject: () => void }) {
  return (
    <div className="rounded-xl border bg-card px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground">{sub}</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" disabled={busy} onClick={onApprove} className="metal-sheen text-[#17120b] font-semibold">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><CheckCircle2 className="mr-1 h-3.5 w-3.5" />Approve</>}
          </Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={onReject} className="border-red-200 text-red-700 hover:bg-red-50">
            <XCircle className="mr-1 h-3.5 w-3.5" />Reject
          </Button>
        </div>
      </div>
      {items.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-3 border-t pt-3">
          {items.map((it) => (
            <div key={it.id} className="flex items-center gap-2">
              {it.productImageSnapshot ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={it.productImageSnapshot} alt={it.productNameSnapshot ?? ''} className="h-10 w-10 rounded-lg border object-cover" />
              ) : <div className="h-10 w-10 rounded-lg border bg-muted" />}
              <span className="text-xs">{it.productNameSnapshot ?? 'Product'} × {it.quantity}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
