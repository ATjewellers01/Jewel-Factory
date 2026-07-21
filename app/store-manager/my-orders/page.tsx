'use client';

import { Loader2, Package, ChevronDown, ChevronUp, CheckCircle2, MessageCircle, Check } from 'lucide-react';
import { useMemo, useState } from 'react';

import { ImageZoomModal } from '@/components/orders/ImageZoomModal';
import { OrderChat } from '@/components/orders/OrderChat';
import { OrderFilters } from '@/components/orders/OrderFilters';
import { Button } from '@/components/ui/button';
import { useApi, apiPost } from '@/hooks/use-api';
import { titleCaseName } from '@/lib/format';
import { SM_STATUS_OPTIONS, inDateRange } from '@/lib/order-filters';

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
        <p className="mt-0.5 text-sm text-muted-foreground">Orders you sent to Head Office — track status, message Head Office, and mark completed.</p>
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
  if (o.pendingStoreApproval || o.pendingManagerApproval) return { label: 'Pending (Head Office)', cls: 'bg-yellow-100 text-yellow-800' };
  return { label: 'Approved', cls: 'bg-blue-100 text-blue-800' };
}

// Derived filter bucket for kiosk/b2b orders (no raw enum shown to the Store Manager).
function bucketOf(o: BaseOrder): 'COMPLETED' | 'PENDING' | 'APPROVED' {
  if (o.completedAt) return 'COMPLETED';
  if (o.pendingStoreApproval || o.pendingManagerApproval) return 'PENDING';
  return 'APPROVED';
}

// Derived filter bucket for custom requests.
function customBucketOf(r: CustomOrder): 'COMPLETED' | 'PENDING' | 'REJECTED' | 'APPROVED' {
  if (r.completedAt) return 'COMPLETED';
  if (r.status === 'PENDING') return 'PENDING';
  if (r.status === 'REJECTED') return 'REJECTED';
  return 'APPROVED';
}

function OrderList({ kind, endpoint }: { kind: Kind; endpoint: string }) {
  const { data, loading, error, reload } = useApi<BaseOrder[]>(endpoint, '/store-manager/login');
  const [open, setOpen] = useState<string | null>(null);
  const [chat, setChat] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [zoomItem, setZoomItem] = useState<Item | null>(null);

  const filtered = useMemo(() => (data ?? []).filter((o) => {
    if (search.trim() && !o.orderNumber.toLowerCase().includes(search.trim().toLowerCase())) return false;
    if (status && bucketOf(o) !== status) return false;
    if (!inDateRange(o.createdAt, from, to)) return false;
    return true;
  }), [data, search, status, from, to]);

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
      <OrderFilters search={search} onSearch={setSearch} status={status} onStatus={setStatus} statusOptions={SM_STATUS_OPTIONS} from={from} to={to} onFrom={setFrom} onTo={setTo} />
      {filtered.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No orders match your filters.</p>}
      {filtered.map((o) => {
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
                        <img
                          src={it.productImageSnapshot}
                          alt=""
                          className="h-14 w-14 rounded-lg border bg-white object-contain p-0.5 cursor-pointer hover:shadow-md transition-shadow"
                          onClick={() => setZoomItem(it)}
                        />
                      ) : <div className="h-14 w-14 rounded-lg border bg-muted" />}
                      <span className="flex-1 text-sm">{titleCaseName(it.productNameSnapshot ?? 'Product')}</span>
                      <span className="text-sm tabular-nums text-muted-foreground">× {it.quantity}</span>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => setChat(o.id)}><MessageCircle className="mr-1.5 h-4 w-4" />Message Head Office</Button>
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

function CustomList() {
  const { data, loading, error, reload } = useApi<CustomOrder[]>('/api/branch-manager/my-orders/custom', '/store-manager/login');
  const [chat, setChat] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [zoomUrl, setZoomUrl] = useState<string | null>(null);

  const filtered = useMemo(() => (data ?? []).filter((r) => {
    if (search.trim()) {
      const hay = `${r.order?.orderNumber ?? ''} ${r.category}`.toLowerCase();
      if (!hay.includes(search.trim().toLowerCase())) return false;
    }
    if (status && customBucketOf(r) !== status) return false;
    if (!inDateRange(r.createdAt, from, to)) return false;
    return true;
  }), [data, search, status, from, to]);

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
      <OrderFilters search={search} onSearch={setSearch} searchPlaceholder="Search by order ID / category…" status={status} onStatus={setStatus} statusOptions={SM_STATUS_OPTIONS} from={from} to={to} onFrom={setFrom} onTo={setTo} />
      {filtered.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No requests match your filters.</p>}
      {filtered.map((r) => {
        // Store Manager does NOT see the manufacturer's granular status — that is HO-only.
        const st = r.completedAt ? { label: 'Completed', cls: 'bg-green-100 text-green-800' }
          : r.status === 'PENDING' ? { label: 'Pending (Head Office)', cls: 'bg-yellow-100 text-yellow-800' }
          : r.status === 'REJECTED' ? { label: 'Rejected', cls: 'bg-red-100 text-red-700' }
          : { label: 'Approved by Head Office', cls: 'bg-blue-100 text-blue-800' };
        return (
          <div key={r.id} className="rounded-xl border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                {r.referenceImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={r.referenceImageUrl}
                    alt=""
                    className="h-14 w-14 rounded-lg border bg-white object-cover cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => setZoomUrl(r.referenceImageUrl)}
                  />
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
              <Button size="sm" variant="outline" onClick={() => setChat(r.id)}><MessageCircle className="mr-1.5 h-4 w-4" />Message Head Office</Button>
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

function Empty() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
      <Package className="h-10 w-10 text-muted-foreground/40" /><p className="text-sm text-muted-foreground">No orders here yet.</p>
    </div>
  );
}
