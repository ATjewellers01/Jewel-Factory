'use client';

import { CheckCircle2, XCircle, Loader2, ClipboardCheck, Store, Pencil, Save, MessageCircle } from 'lucide-react';
import { useState } from 'react';

import { ImageZoomModal } from '@/components/orders/ImageZoomModal';
import { Button } from '@/components/ui/button';
import { useApi, apiPost, apiSend } from '@/hooks/use-api';
import { OrderChat } from '@/components/orders/OrderChat';

type Item = { id: string; productNameSnapshot: string | null; productImageSnapshot: string | null; quantity: number };
type KioskOrder = { id: string; orderNumber: string; customerName: string | null; branchNameSnapshot: string | null; requirementNote: string | null; totalItems: number; pickupStore: boolean; createdAt: string; items: Item[] };
type B2bOrder = { id: string; orderNumber: string; branchNameSnapshot: string | null; requirementNote: string | null; totalItems: number; createdAt: string; items: Item[] };

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
            <Row key={o.id} kind="kiosk" id={o.id} title={o.orderNumber} branch={o.branchNameSnapshot}
              sub={`${o.totalItems} item(s)`} note={o.requirementNote}
              items={o.items} busy={busy?.startsWith(o.id) ?? false} onNoteSaved={() => kiosk.reload()}
              onApprove={() => act('kiosk', o.id, 'approve')} onReject={() => act('kiosk', o.id, 'reject')} />
          ))}
        </section>
      )}

      {!loading && (b2b.data?.length ?? 0) > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">B2B Restock Orders</h2>
          {b2b.data!.map((o) => (
            <Row key={o.id} kind="b2b" id={o.id} title={o.orderNumber} branch={o.branchNameSnapshot}
              sub={`${o.totalItems} item(s)`} note={o.requirementNote}
              items={o.items} busy={busy?.startsWith(o.id) ?? false} onNoteSaved={() => b2b.reload()}
              onApprove={() => act('b2b', o.id, 'approve')} onReject={() => act('b2b', o.id, 'reject')} />
          ))}
        </section>
      )}
    </div>
  );
}

function Row({ kind, id, title, branch, sub, note, items, busy, onApprove, onReject, onNoteSaved }: {
  kind: 'kiosk' | 'b2b'; id: string; title: string; branch: string | null; sub: string; note: string | null;
  items: Item[]; busy: boolean; onApprove: () => void; onReject: () => void; onNoteSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note ?? '');
  const [saving, setSaving] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [zoomItem, setZoomItem] = useState<Item | null>(null);

  async function saveNote() {
    setSaving(true);
    try {
      await apiSend('PATCH', `/api/store/${kind === 'kiosk' ? 'kiosk-orders' : 'b2b-orders'}/${id}/note`, { requirementNote: draft.trim() || null });
      setEditing(false);
      onNoteSaved();
    } catch { /* ignore */ } finally { setSaving(false); }
  }

  return (
    <div className="rounded-xl border bg-card px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium">{title}</p>
            {branch && <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-800"><Store className="h-3 w-3" />{branch}</span>}
          </div>
          <p className="text-xs text-muted-foreground">{sub}</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" disabled={busy} onClick={onApprove} className="metal-sheen text-[#17120b] font-semibold">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><CheckCircle2 className="mr-1 h-3.5 w-3.5" />Approve</>}
          </Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={onReject} className="border-red-200 text-red-700 hover:bg-red-50">
            <XCircle className="mr-1 h-3.5 w-3.5" />Reject
          </Button>
          <Button size="sm" variant="outline" onClick={() => setChatOpen(true)}>
            <MessageCircle className="mr-1 h-3.5 w-3.5" />Message
          </Button>
        </div>
      </div>
      {chatOpen && <OrderChat basePath="/api/store/messages" kind={kind} orderId={id} orderLabel={title} viewer="HO" onClose={() => setChatOpen(false)} />}

      {/* Requirement note — editable by HO before approving */}
      <div className="mt-3 rounded-lg border bg-muted/20 p-2.5">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Requirement note (sent to manufacturer)</p>
          {!editing && (
            <button onClick={() => { setDraft(note ?? ''); setEditing(true); }} className="inline-flex items-center gap-1 text-xs text-primary hover:underline"><Pencil className="h-3 w-3" />Edit</button>
          )}
        </div>
        {editing ? (
          <div className="mt-1.5 space-y-2">
            <textarea value={draft} onChange={(e) => setDraft(e.target.value)} className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm min-h-[60px]" placeholder="Customer requirement / specs…" />
            <div className="flex gap-2">
              <Button size="sm" onClick={saveNote} disabled={saving} className="metal-sheen text-[#17120b] font-semibold">{saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Save className="mr-1 h-3.5 w-3.5" />Save</>}</Button>
              <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <p className="mt-1 text-sm text-foreground/80">{note?.trim() ? note : <span className="text-muted-foreground italic">No note</span>}</p>
        )}
      </div>

      {items.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-3 border-t pt-3">
          {items.map((it) => (
            <div key={it.id} className="flex items-center gap-2">
              {it.productImageSnapshot ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={it.productImageSnapshot}
                  alt={it.productNameSnapshot ?? ''}
                  className="h-16 w-16 rounded-lg border bg-white object-contain p-1 cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setZoomItem(it)}
                />
              ) : <div className="h-16 w-16 rounded-lg border bg-muted" />}
              <span className="text-sm">{it.productNameSnapshot ?? 'Product'} × {it.quantity}</span>
            </div>
          ))}
        </div>
      )}

      {zoomItem?.productImageSnapshot && (
        <ImageZoomModal
          isOpen={!!zoomItem}
          images={[zoomItem.productImageSnapshot]}
          productName={zoomItem.productNameSnapshot ?? undefined}
          onClose={() => setZoomItem(null)}
        />
      )}
    </div>
  );
}
