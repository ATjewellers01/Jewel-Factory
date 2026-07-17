'use client';

import { Loader2, Package, ChevronDown, ChevronUp, CheckCircle2, MessageCircle, Check } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { useApi, apiPost } from '@/hooks/use-api';
import { OrderChat } from '@/components/orders/OrderChat';
import { titleCaseName } from '@/lib/format';

type Item = { id: string; productNameSnapshot: string | null; productImageSnapshot: string | null; quantity: number };
type BaseOrder = {
  id: string; orderNumber: string; status?: string; totalItems?: number;
  pendingStoreApproval?: boolean; pendingManagerApproval?: boolean;
  forwardedToManufacturer?: boolean; completedAt?: string | null; createdAt: string;
  items?: Item[];
};
type CustomOrder = {
  id: string; category: string; status: string; completedAt: string | null; createdAt: string;
  referenceImageUrl: string | null; designNotes: string | null;
  order: { orderNumber: string; status: string } | null;
};

type Kind = 'kiosk' | 'b2b' | 'custom';
const TABS: { key: Kind; label: string; endpoint: string }[] = [
  { key: 'kiosk', label: 'Kiosk', endpoint: '/api/branch-manager/my-orders/kiosk' },
  { key: 'custom', label: 'Custom', endpoint: '/api/branch-manager/my-orders/custom' },
  { key: 'b2b', label: 'Restock', endpoint: '/api/branch-manager/my-orders/b2b' },
];

export default function MyOrdersPage() {
  const [tab, setTab] = useState<Kind>('kiosk');
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6">
      <div className="mb-4">
        <h1 className="font-display text-2xl font-medium tracking-tight">My Orders</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Orders you sent to Head Office — track status, message HO, and mark completed.</p>
      </div>
      <div className="mb-5 flex gap-1 rounded-lg border bg-muted/30 p-1">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${tab === t.key ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>{t.label}</button>
        ))}
      </div>
      {tab === 'custom' ? <CustomList /> : <OrderList kind={tab} endpoint={TABS.find((t) => t.key === tab)!.endpoint} />}
    </div>
  );
}

function statusOf(o: BaseOrder): { label: string; cls: string } {
  if (o.completedAt) return { label: 'Completed', cls: 'bg-green-100 text-green-800' };
  if (o.pendingStoreApproval || o.pendingManagerApproval) return { label: 'Pending (HO)', cls: 'bg-yellow-100 text-yellow-800' };
  return { label: 'Approved', cls: 'bg-blue-100 text-blue-800' };
}

function OrderList({ kind, endpoint }: { kind: Kind; endpoint: string }) {
  const { data, loading, error, reload } = useApi<BaseOrder[]>(endpoint, '/store-manager/login');
  const [open, setOpen] = useState<string | null>(null);
  const [chat, setChat] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function complete(id: string) {
    setBusy(id);
    try { await apiPost(`/api/branch-manager/my-orders/${kind}/${id}/complete`); void reload(); }
    catch { /* ignore */ } finally { setBusy(null); }
  }

  if (loading) return <div className="flex items-center gap-2 py-12 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>;
  if (error) return <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>;
  if (!data || data.length === 0) return <Empty />;

  return (
    <div className="space-y-3">
      {data.map((o) => {
        const st = statusOf(o);
        return (
          <div key={o.id} className="rounded-xl border bg-card overflow-hidden">
            <button onClick={() => setOpen(open === o.id ? null : o.id)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/30">
              <div className="min-w-0">
                <p className="text-sm font-medium">{o.orderNumber}</p>
                <p className="text-xs text-muted-foreground">{o.totalItems ?? 0} item(s) · {new Date(o.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${st.cls}`}>{st.label}</span>
                {open === o.id ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </div>
            </button>
            {open === o.id && (
              <div className="border-t bg-muted/10 px-4 pb-4 pt-3 space-y-3">
                <div className="space-y-2">
                  {o.items?.map((it) => (
                    <div key={it.id} className="flex items-center gap-3">
                      {it.productImageSnapshot ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={it.productImageSnapshot} alt="" className="h-14 w-14 rounded-lg border bg-white object-contain p-0.5" />
                      ) : <div className="h-14 w-14 rounded-lg border bg-muted" />}
                      <span className="flex-1 text-sm">{titleCaseName(it.productNameSnapshot ?? 'Product')}</span>
                      <span className="text-sm tabular-nums text-muted-foreground">× {it.quantity}</span>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => setChat(o.id)}><MessageCircle className="mr-1.5 h-4 w-4" />Message HO</Button>
                  {!o.completedAt && (
                    <Button size="sm" disabled={busy === o.id} onClick={() => complete(o.id)} className="metal-sheen text-[#17120b] font-semibold">
                      {busy === o.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="mr-1.5 h-4 w-4" />Mark Completed</>}
                    </Button>
                  )}
                  {o.completedAt && <span className="inline-flex items-center gap-1 text-sm text-green-700"><CheckCircle2 className="h-4 w-4" />Completed</span>}
                </div>
              </div>
            )}
            {chat === o.id && <OrderChat basePath="/api/branch-manager/messages" kind={kind} orderId={o.id} orderLabel={o.orderNumber} viewer="STORE_MANAGER" onClose={() => setChat(null)} />}
          </div>
        );
      })}
    </div>
  );
}

function CustomList() {
  const { data, loading, error, reload } = useApi<CustomOrder[]>('/api/branch-manager/my-orders/custom', '/store-manager/login');
  const [chat, setChat] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function complete(id: string) {
    setBusy(id);
    try { await apiPost(`/api/branch-manager/my-orders/custom/${id}/complete`); void reload(); }
    catch { /* ignore */ } finally { setBusy(null); }
  }

  if (loading) return <div className="flex items-center gap-2 py-12 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>;
  if (error) return <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>;
  if (!data || data.length === 0) return <Empty />;

  return (
    <div className="space-y-3">
      {data.map((r) => {
        const st = r.completedAt ? { label: 'Completed', cls: 'bg-green-100 text-green-800' }
          : r.status === 'PENDING' ? { label: 'Pending (HO)', cls: 'bg-yellow-100 text-yellow-800' }
          : r.status === 'REJECTED' ? { label: 'Rejected', cls: 'bg-red-100 text-red-700' }
          : { label: r.order?.status ? `HO · ${r.order.status.toLowerCase()}` : 'Approved', cls: 'bg-blue-100 text-blue-800' };
        return (
          <div key={r.id} className="rounded-xl border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                {r.referenceImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.referenceImageUrl} alt="" className="h-14 w-14 rounded-lg border bg-white object-cover" />
                ) : <div className="h-14 w-14 rounded-lg border bg-muted" />}
                <div>
                  <p className="text-sm font-medium">{r.category}</p>
                  <p className="text-xs text-muted-foreground">{r.order?.orderNumber ?? 'Custom request'} · {new Date(r.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</p>
                </div>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${st.cls}`}>{st.label}</span>
            </div>
            {r.designNotes && <p className="mt-2 text-sm text-muted-foreground">{r.designNotes}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => setChat(r.id)}><MessageCircle className="mr-1.5 h-4 w-4" />Message HO</Button>
              {!r.completedAt && r.status !== 'REJECTED' && (
                <Button size="sm" disabled={busy === r.id} onClick={() => complete(r.id)} className="metal-sheen text-[#17120b] font-semibold">
                  {busy === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="mr-1.5 h-4 w-4" />Mark Completed</>}
                </Button>
              )}
              {r.completedAt && <span className="inline-flex items-center gap-1 text-sm text-green-700"><CheckCircle2 className="h-4 w-4" />Completed</span>}
            </div>
            {chat === r.id && <OrderChat basePath="/api/branch-manager/messages" kind="custom" orderId={r.id} orderLabel={r.order?.orderNumber ?? r.category} viewer="STORE_MANAGER" onClose={() => setChat(null)} />}
          </div>
        );
      })}
    </div>
  );
}

function Empty() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
      <Package className="h-10 w-10 text-muted-foreground/40" /><p className="text-sm text-muted-foreground">No orders here yet.</p>
    </div>
  );
}
