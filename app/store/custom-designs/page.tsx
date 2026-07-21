'use client';

import { CheckCircle2, XCircle, Loader2, PencilLine, ChevronDown, ChevronUp, MessageSquare } from 'lucide-react';
import { useMemo, useState } from 'react';

import { ImageZoomModal } from '@/components/orders/ImageZoomModal';
import { OrderChat } from '@/components/orders/OrderChat';
import { OrderFilters } from '@/components/orders/OrderFilters';
import { Button } from '@/components/ui/button';
import { useApi, apiPost } from '@/hooks/use-api';
import { CUSTOM_REQUEST_STATUS_OPTIONS, matchOrder, uniqueBranchOptions } from '@/lib/order-filters';

type Order = { id: string; status: string; orderNumber: string; trackingNumber: string | null };
type Request = {
  id: string; customerName: string; customerPhone: string; category: string;
  weightGrams: string | null; purity: string | null; designNotes: string | null;
  referenceImageUrl: string | null; status: string; createdAt: string; order: Order | null;
  branch: { name: string } | null;
};

const REQ_STATUS: Record<string, string> = {
  PENDING: 'bg-yellow-50 text-yellow-800 border-yellow-200',
  FORWARDED: 'bg-green-50 text-green-800 border-green-200',
  REJECTED: 'bg-red-50 text-red-700 border-red-200',
  APPROVED: 'bg-blue-50 text-blue-800 border-blue-200',
};
const MFR_STATUS: Record<string, string> = {
  PENDING: 'bg-gray-100 text-gray-700', CONFIRMED: 'bg-blue-100 text-blue-700',
  IN_PRODUCTION: 'bg-purple-100 text-purple-700', PACKED: 'bg-indigo-100 text-indigo-700',
  SHIPPED: 'bg-amber-100 text-amber-700', DELIVERED: 'bg-green-100 text-green-700', CANCELLED: 'bg-red-100 text-red-700',
};

export default function StoreCustomDesignsPage() {
  const { data, error, loading, reload } = useApi<Request[]>('/api/store/custom-designs', '/store/login');
  const [busy, setBusy] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [chat, setChat] = useState<{ id: string; label: string } | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [branch, setBranch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [zoomUrl, setZoomUrl] = useState<string | null>(null);

  const branchOptions = useMemo(() => uniqueBranchOptions((data ?? []).map((r) => r.branch?.name)), [data]);
  const filtered = useMemo(
    () => (data ?? []).filter((r) => matchOrder(
      { orderNumber: r.order?.orderNumber, status: r.status, createdAt: r.createdAt },
      { search, status, searchLabel: `${r.customerName} ${r.customerPhone}`, branch, branchName: r.branch?.name, from, to },
    )),
    [data, search, status, branch, from, to],
  );

  async function act(id: string, action: 'approve' | 'reject') {
    if (action === 'reject' && !confirm('Reject this custom design request?')) return;
    setBusy(id + action);
    try {
      await apiPost(`/api/store/custom-designs/${id}/${action}`);
      void reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed');
    } finally { setBusy(null); }
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-medium tracking-tight">Custom Design Requests</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Approve to forward specs to the manufacturer (no customer data sent).</p>
      </div>
      {data && data.length > 0 && (
        <OrderFilters
          search={search} onSearch={setSearch} searchPlaceholder="Search by name / order ID…"
          status={status} onStatus={setStatus} statusOptions={CUSTOM_REQUEST_STATUS_OPTIONS}
          group={branch} onGroup={setBranch} groupOptions={branchOptions} groupAllLabel="All stores" groupLabel="Store"
          from={from} to={to} onFrom={setFrom} onTo={setTo}
        />
      )}
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {loading && <div className="flex items-center gap-2 py-12 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>}
      {data && data.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
          <PencilLine className="h-10 w-10 text-muted-foreground/40" /><p className="text-sm text-muted-foreground">No custom design requests yet.</p>
        </div>
      )}
      {data && data.length > 0 && filtered.length === 0 && (
        <p className="py-12 text-center text-sm text-muted-foreground">No requests match your filters.</p>
      )}
      {filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map((r) => (
            <div key={r.id} className="rounded-xl border bg-card overflow-hidden">
              <button type="button" onClick={() => setExpanded(expanded === r.id ? null : r.id)} className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left hover:bg-muted/30">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold">{r.customerName}</p>
                    {r.branch?.name && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">{r.branch.name}</span>}
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${REQ_STATUS[r.status] ?? ''}`}>{r.status.toLowerCase()}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{r.customerPhone} · {r.category}{r.weightGrams ? ` · ${r.weightGrams}g` : ''}{r.purity ? ` · ${r.purity}` : ''}</p>
                </div>
                {expanded === r.id ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </button>
              {expanded === r.id && (
                <div className="border-t px-4 pb-4 pt-3 space-y-3 bg-muted/10">
                  {r.designNotes && <div><p className="text-xs text-muted-foreground uppercase tracking-wider">Notes</p><p className="text-sm">{r.designNotes}</p></div>}
                  {r.referenceImageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={r.referenceImageUrl}
                      alt="reference"
                      className="max-h-56 rounded-lg border object-contain cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => setZoomUrl(r.referenceImageUrl || null)}
                    />
                  )}
                  {r.status === 'FORWARDED' && r.order && (
                    <div className="rounded-lg border bg-[#fdf9f2] px-3 py-2">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Manufacturer Status</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">{r.order.orderNumber}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${MFR_STATUS[r.order.status] ?? ''}`}>{r.order.status.replace('_', ' ').toLowerCase()}</span>
                        {r.order.trackingNumber && <span className="text-xs text-muted-foreground">Tracking: {r.order.trackingNumber}</span>}
                      </div>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {r.status === 'PENDING' && (
                      <>
                        <Button size="sm" disabled={busy?.startsWith(r.id)} onClick={() => act(r.id, 'approve')} className="metal-sheen text-[#17120b] font-semibold">
                          {busy === r.id + 'approve' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><CheckCircle2 className="mr-1 h-3.5 w-3.5" />Approve &amp; Forward</>}
                        </Button>
                        <Button size="sm" variant="outline" disabled={busy?.startsWith(r.id)} onClick={() => act(r.id, 'reject')} className="border-red-200 text-red-700 hover:bg-red-50">
                          <XCircle className="mr-1 h-3.5 w-3.5" />Reject
                        </Button>
                      </>
                    )}
                    <Button size="sm" variant="outline" onClick={() => setChat({ id: r.id, label: r.customerName })}>
                      <MessageSquare className="mr-1 h-3.5 w-3.5" />Message Store Manager
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {chat && (
        <OrderChat
          basePath="/api/store/messages"
          kind="custom"
          orderId={chat.id}
          orderLabel={chat.label}
          viewer="HO"
          onClose={() => setChat(null)}
        />
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
