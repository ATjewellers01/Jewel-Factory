'use client';

import { Loader2, Package, ChevronDown, ChevronUp, CheckCircle2, MessageCircle, Check } from 'lucide-react';
import { useMemo, useState } from 'react';

import { ImageZoomModal } from '@/components/orders/ImageZoomModal';
import { OrderChat } from '@/components/orders/OrderChat';
import { OrderFilters } from '@/components/orders/OrderFilters';
import { OrderItemDetailModal, type OrderItemProductSafe } from '@/components/orders/OrderItemDetailModal';
import { Button } from '@/components/ui/button';
import { useApi, apiPost } from '@/hooks/use-api';
import { formatOrderStatus, titleCaseName } from '@/lib/format';
import { SM_STATUS_OPTIONS, inDateRange, statusOf, bucketOf } from '@/lib/order-filters';

// Per-product status, set by the manufacturer — a single order can have items
// at different stages (one piece Ghat Received while another is Dispatched).
const ITEM_STATUS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800', IN_PROCESS: 'bg-blue-100 text-blue-800',
  GHAT_RECEIVED: 'bg-purple-100 text-purple-800', READY_FOR_DELIVERY: 'bg-indigo-100 text-indigo-800',
  DISPATCHED: 'bg-amber-100 text-amber-800', COMPLETED: 'bg-green-100 text-green-800', CANCELLED: 'bg-red-100 text-red-700',
};

type Item = {
  id: string; productNameSnapshot: string | null; productImageSnapshot: string | null; quantity: number;
  status: string;
  product: OrderItemProductSafe | null;
};
type BaseOrder = {
  id: string; orderNumber: string; status?: string; totalItems?: number;
  pendingStoreApproval?: boolean; pendingManagerApproval?: boolean;
  forwardedToManufacturer?: boolean; completedAt?: string | null; createdAt: string;
  items?: Item[];
};

export type BranchOrderKind = 'kiosk' | 'b2b' | 'custom';

// statusOf / bucketOf were extracted to lib/order-filters.ts so the mobile
// client can transcribe one readable source (decision #7).

/**
 * Shared "my orders" list for a Store Manager — kiosk and restock (B2B) orders
 * both use this same shape (status badge, item statuses, chat, mark-completed).
 * Custom design orders have their own list (different fields), see CustomList
 * in app/store-manager/my-orders/page.tsx.
 */
export function BranchOrderList({ kind, endpoint }: { kind: BranchOrderKind; endpoint: string }) {
  const { data, loading, error, reload } = useApi<BaseOrder[]>(endpoint, '/store-manager/login');
  const [open, setOpen] = useState<string | null>(null);
  const [chat, setChat] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [zoomItem, setZoomItem] = useState<Item | null>(null);
  const [productModal, setProductModal] = useState<OrderItemProductSafe | null>(null);

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
  if (!data || data.length === 0) return <BranchOrderListEmpty />;

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
                    <button
                      key={it.id}
                      type="button"
                      onClick={() => it.product && setProductModal(it.product)}
                      disabled={!it.product}
                      className="flex w-full items-center gap-3 rounded-lg text-left hover:bg-black/5 disabled:cursor-default disabled:hover:bg-transparent"
                    >
                      {it.productImageSnapshot ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={it.productImageSnapshot}
                          alt=""
                          className="h-14 w-14 shrink-0 rounded-lg border bg-white object-contain p-0.5 cursor-pointer hover:shadow-md transition-shadow"
                          onClick={(e) => { e.stopPropagation(); setZoomItem(it); }}
                        />
                      ) : <div className="h-14 w-14 shrink-0 rounded-lg border bg-muted" />}
                      <span className="flex-1">
                        <span className="block text-sm">{it.product?.designNumber ?? titleCaseName(it.productNameSnapshot ?? 'Product')}</span>
                        {it.product && (
                          <span className="block text-xs text-muted-foreground">
                            {it.product.category ?? '—'}
                            {it.product.subCategory ? ` › ${it.product.subCategory}` : ''}
                            {it.product.weightGrams != null ? ` · ${it.product.weightGrams}g` : ''}
                          </span>
                        )}
                      </span>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className="text-sm tabular-nums text-muted-foreground">× {it.quantity}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${ITEM_STATUS[it.status] ?? ''}`}>{formatOrderStatus(it.status)}</span>
                      </div>
                    </button>
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

      {productModal && <OrderItemDetailModal product={productModal} onClose={() => setProductModal(null)} />}
    </div>
  );
}

export function BranchOrderListEmpty() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
      <Package className="h-10 w-10 text-muted-foreground/40" /><p className="text-sm text-muted-foreground">No orders here yet.</p>
    </div>
  );
}
