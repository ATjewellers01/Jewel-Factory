'use client';

import { Loader2, CheckCircle2, MessageCircle, Check } from 'lucide-react';
import { useMemo, useState } from 'react';

import { BranchOrderList, BranchOrderListEmpty, type BranchOrderKind } from '@/components/orders/BranchOrderList';
import { ImageZoomModal } from '@/components/orders/ImageZoomModal';
import { CustomSpecList } from '@/components/orders/CustomSpecList';
import { OrderChat } from '@/components/orders/OrderChat';
import { OrderFilters } from '@/components/orders/OrderFilters';
import { Button } from '@/components/ui/button';
import { useApi, apiPost } from '@/hooks/use-api';
import { formatOrderStatus } from '@/lib/format';
import { SM_STATUS_OPTIONS, inDateRange, customBucketOf, uniqueBranchOptions } from '@/lib/order-filters';

// Manufacturer's granular status on the forwarded order — same badge shown to
// the Retailer Admin (app/store/custom-designs/page.tsx MFR_STATUS), so all
// three roles (Retailer User, Retailer Admin, Manufacturer) see the same thing.
const MFR_STATUS: Record<string, string> = {
  PENDING: 'bg-gray-100 text-gray-700', IN_PROCESS: 'bg-blue-100 text-blue-700',
  GHAT_RECEIVED: 'bg-purple-100 text-purple-700', READY_FOR_DELIVERY: 'bg-indigo-100 text-indigo-700',
  DISPATCHED: 'bg-amber-100 text-amber-700', COMPLETED: 'bg-green-100 text-green-700', CANCELLED: 'bg-red-100 text-red-700',
};

type CustomOrder = {
  id: string; category: string; status: string; completedAt: string | null; createdAt: string;
  referenceImageUrl: string | null; designNotes: string | null;
  orderRef: string | null; deliveryDate: string | null; quantity: string | null;
  meena: string | null; length: string | null; size: string | null;
  broadness: string | null; screw: string | null; sampleWeightGrams: string | null;
  subCategory: string | null;
  salesCode: string | null; salesPersonName: string | null;
  order: { orderNumber: string; status: string; trackingNumber: string | null } | null;
};

// Restock lives under its own PIN gate (/store-manager/restock) — its order
// history moved there too, so everything restock-related sits behind one PIN.
type Kind = Extract<BranchOrderKind, 'kiosk' | 'custom'>;
const TABS: { key: Kind; label: string; endpoint: string }[] = [
  { key: 'kiosk', label: 'Kiosk', endpoint: '/api/branch-manager/my-orders/kiosk' },
  { key: 'custom', label: 'Customised', endpoint: '/api/branch-manager/my-orders/custom' },
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
      {tab === 'custom' ? <CustomList /> : <BranchOrderList kind={tab} endpoint={TABS.find((t) => t.key === tab)!.endpoint} />}
    </div>
  );
}

function CustomList() {
  const { data, loading, error, reload } = useApi<CustomOrder[]>('/api/branch-manager/my-orders/custom', '/store-manager/login');
  const [chat, setChat] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [salesPerson, setSalesPerson] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [zoomUrl, setZoomUrl] = useState<string | null>(null);

  const salesPersonOptions = useMemo(() => uniqueBranchOptions((data ?? []).map((r) => r.salesPersonName)), [data]);

  const filtered = useMemo(() => (data ?? []).filter((r) => {
    if (search.trim()) {
      const hay = `${r.order?.orderNumber ?? ''} ${r.category}`.toLowerCase();
      if (!hay.includes(search.trim().toLowerCase())) return false;
    }
    if (status && customBucketOf(r) !== status) return false;
    if (salesPerson && r.salesPersonName !== salesPerson) return false;
    if (!inDateRange(r.createdAt, from, to)) return false;
    return true;
  }), [data, search, status, salesPerson, from, to]);

  async function complete(id: string) {
    setBusy(id);
    try { await apiPost(`/api/branch-manager/my-orders/custom/${id}/complete`); void reload(); }
    catch { /* ignore */ } finally { setBusy(null); }
  }

  if (loading) return <div className="flex items-center gap-2 py-12 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>;
  if (error) return <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>;
  if (!data || data.length === 0) return <BranchOrderListEmpty />;

  return (
    <div className="space-y-3">
      <OrderFilters search={search} onSearch={setSearch} searchPlaceholder="Search by order ID / category…" status={status} onStatus={setStatus} statusOptions={SM_STATUS_OPTIONS} from={from} to={to} onFrom={setFrom} onTo={setTo} />
      {salesPersonOptions.length > 0 && (
        <select className="h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={salesPerson} onChange={(e) => setSalesPerson(e.target.value)}>
          <option value="">All sales people</option>
          {salesPersonOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      )}
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
                  <p className="text-sm font-medium">{r.category}{r.subCategory ? ` › ${r.subCategory}` : ''}</p>
                  <p className="text-xs text-muted-foreground">{r.order?.orderNumber ?? 'Custom request'} · {new Date(r.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</p>
                </div>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${st.cls}`}>{st.label}</span>
            </div>
            {r.status === 'FORWARDED' && r.order && (
              <div className="mt-3 rounded-lg border bg-muted/20 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Manufacturer Status</p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-muted-foreground">{r.order.orderNumber}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${MFR_STATUS[r.order.status] ?? ''}`}>{formatOrderStatus(r.order.status)}</span>
                  {r.order.trackingNumber && <span className="text-xs text-muted-foreground">Tracking: {r.order.trackingNumber}</span>}
                </div>
              </div>
            )}
            {(r.salesCode || r.salesPersonName) && (
              <div className="mt-3 flex flex-wrap gap-4 rounded-lg border bg-card px-3 py-2 text-xs">
                {r.salesPersonName && <span><span className="text-muted-foreground">Sales person: </span><span className="font-medium">{r.salesPersonName}</span></span>}
                {r.salesCode && <span><span className="text-muted-foreground">Sales code: </span><span className="font-medium">{r.salesCode}</span></span>}
              </div>
            )}
            <CustomSpecList spec={r} className="mt-3" />
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
