'use client';

import { Loader2, Package, ChevronDown, ChevronUp, CheckCircle2, MessageCircle, Check } from 'lucide-react';
import { useMemo, useState } from 'react';

import { ImageZoomModal } from '@/components/orders/ImageZoomModal';
import { OrderChat } from '@/components/orders/OrderChat';
import { OrderFilters } from '@/components/orders/OrderFilters';
import { OrderItemDetailModal, type OrderItemProductSafe } from '@/components/orders/OrderItemDetailModal';
import { Button } from '@/components/ui/button';
import { useApi, apiPost } from '@/hooks/use-api';
import { titleCaseName } from '@/lib/format';
import { SM_STATUS_OPTIONS, inDateRange, statusOf, bucketOf } from '@/lib/order-filters';

type Item = {
  id: string; productNameSnapshot: string | null; productImageSnapshot: string | null; quantity: number;
  status: string;
  purity: string | null;
  product: OrderItemProductSafe | null;
};
type BaseOrder = {
  id: string; orderNumber: string; status?: string; totalItems?: number;
  pendingStoreApproval?: boolean; pendingManagerApproval?: boolean;
  forwardedToManufacturer?: boolean; completedAt?: string | null; createdAt: string;
  trackingNumber?: string | null;
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
      {/* Column headings — new users otherwise have to guess what each value
          in a row represents. */}
      {filtered.length > 0 && (
        <div className="hidden grid-cols-[1fr_9rem_11rem] items-center gap-3 px-4 sm:grid">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Order ID</span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Order Date</span>
          <span className="text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Status</span>
        </div>
      )}
      {filtered.map((o) => {
        const st = statusOf(o);
        return (
          <div key={o.id} className="rounded-xl border bg-card overflow-hidden">
            <button onClick={() => setOpen(open === o.id ? null : o.id)} className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/30 sm:grid sm:grid-cols-[1fr_9rem_11rem]">
              <div className="min-w-0">
                {/* Mobile has no column-heading row visible above (it's
                    sm:grid-only, and this row wraps rather than being a
                    grid below sm), so each value carries its own tiny
                    label inline instead. */}
                <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground sm:hidden">Order ID</span>
                <p className="text-sm font-medium">{o.orderNumber}</p>
                <p className="text-xs text-muted-foreground">{o.totalItems ?? 0} item(s)</p>
              </div>
              <div>
                <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground sm:hidden">Order Date</span>
                <p className="text-xs text-muted-foreground sm:text-sm">{new Date(o.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
              </div>
              <div className="flex flex-col items-start gap-1 sm:items-end">
                <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground sm:hidden">Status</span>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${st.cls}`}>{st.label}</span>
                  {open === o.id ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </div>
              </div>
            </button>
            {open === o.id && (
              <div className="border-t bg-muted/10 px-4 pb-4 pt-3 space-y-3">
                {/* The Retailer User only ever sees the simple Pending/Approved/
                    Completed badge above (from statusOf) — the manufacturer's own
                    granular production status (and per-item status) is HO-only,
                    so no "Manufacturer Status" block is rendered here. */}
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
                            {it.product.weightGrams != null ? ` · ${it.product.weightGrams}gm` : ''}
                            {it.purity ? ` · ${it.purity}` : ''}
                          </span>
                        )}
                      </span>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className="text-sm tabular-nums text-muted-foreground">× {it.quantity}</span>
                      </div>
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => setChat(o.id)}><MessageCircle className="mr-1.5 h-4 w-4" />Message Head Office</Button>
                  {!o.completedAt && o.status !== 'CANCELLED' && (
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
