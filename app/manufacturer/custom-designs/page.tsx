'use client';

import { ChevronDown, ChevronUp, Loader2, PencilLine } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { CustomSpecList } from '@/components/orders/CustomSpecList';
import { ImageZoomModal } from '@/components/orders/ImageZoomModal';
import { KarigarOrderForm } from '@/components/orders/KarigarOrderForm';
import { ManufacturerOrderItemModal, type OrderItemProduct } from '@/components/orders/ManufacturerOrderItemModal';
import { OrderFilters } from '@/components/orders/OrderFilters';
import { Button } from '@/components/ui/button';
import { apiPost, apiSend } from '@/hooks/use-api';
import { formatOrderStatus, formatOrderLevelStatus } from '@/lib/format';
import { KIOSK_B2B_STATUS_OPTIONS, matchOrder, uniqueBranchOptions } from '@/lib/order-filters';

/**
 * Customised Orders (JFC-####) — 2026-08-11: pulled back OUT of the merged
 * Catalogue Orders list (which had absorbed them since 2026-08-05) into
 * this dedicated page, per client request. A Customised Order only ever
 * exists here once a Karigar has been assigned (either from a Catalog/
 * Kiosk order's items, or from a Retailer Admin's bespoke request) — the
 * PENDING/unassigned state of a bespoke request still shows on the
 * Catalogue Orders list (app/manufacturer/orders/page.tsx), tagged
 * "Customised Order from {business name}", until it's assigned.
 */
type CustomOrder = {
  id: string; orderNumber: string; status: string; createdAt: string;
  storeNameSnapshot: string; storeAddressSnapshot: string;
  category: string; subCategory: string | null;
  weightGramsMin: string | null; weightGramsMax: string | null; purity: string | null;
  referenceImageUrl: string | null; referenceImageUrls: string[]; designNotes: string | null;
  orderRef: string | null; deliveryDate: string | null; quantity: string | null;
  meena: string | null; length: string | null; size: string | null;
  broadness: string | null; screw: string | null; sampleWeightGrams: string | null;
  totalWeightGrams?: string | null; karigarNotes?: string | null;
  karigarCode: string | null;
  sourceB2bOrderId?: string | null; sourceKioskOrderId?: string | null;
  karigarId?: string | null; karigar?: { id: string; code: string } | null;
  karigarDeliveryDate?: string | null;
  narration1?: string | null; narration2?: string | null; qc?: string | null;
  orderType?: string | null; orderStage?: string | null; urgent?: boolean;
  referenceOrderNumber?: string | null; // JFA-#### of the source order, resolved client-side
  o2dOrderNo?: string | null;
  o2dSyncError?: string | null;
};

type Item = {
  id: string; productNameSnapshot: string; productImageSnapshot: string | null; categorySnapshot: string | null; quantity: number;
  status: string;
  purity: string | null;
  product: OrderItemProduct | null;
  // Status for these items still belongs to the ORIGINAL b2b/kiosk order.
  sourceKind?: 'b2b' | 'kiosk';
  sourceOrderId?: string;
};

const STATUS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800', IN_PROCESS: 'bg-blue-100 text-blue-800',
  GHAT_RECEIVED: 'bg-purple-100 text-purple-800', READY_FOR_DELIVERY: 'bg-indigo-100 text-indigo-800',
  DISPATCHED: 'bg-amber-100 text-amber-800', COMPLETED: 'bg-green-100 text-green-800', CANCELLED: 'bg-red-100 text-red-700',
};
const ALL_ITEM_STATUSES = ['PENDING', 'IN_PROCESS', 'GHAT_RECEIVED', 'READY_FOR_DELIVERY', 'DISPATCHED', 'COMPLETED', 'CANCELLED'];

function endpointFor(source: 'b2b' | 'kiosk', id: string) {
  return source === 'kiosk' ? `/api/manufacturer/kiosk-orders/${id}` : `/api/manufacturer/orders/${id}`;
}

export default function ManufacturerCustomDesignsPage() {
  const [orders, setOrders] = useState<CustomOrder[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [items, setItems] = useState<Item[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [itemBusy, setItemBusy] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [retailer, setRetailer] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [karigarFilter, setKarigarFilter] = useState('');
  const [zoomItem, setZoomItem] = useState<Item | null>(null);
  const [zoomCustomImages, setZoomCustomImages] = useState<string[] | null>(null);
  const [productModal, setProductModal] = useState<OrderItemProduct | null>(null);

  async function loadList() {
    setLoading(true);
    // Best-effort check-on-view sync (lib/db/o2d-sync.ts) — see the matching
    // comment in app/manufacturer/orders/page.tsx. Isolated from the
    // try/catch below so an unreachable O2D never blocks this page's load.
    try { await apiPost('/api/manufacturer/o2d/sync-statuses'); } catch { /* best-effort */ }
    try {
      const [customRes, b2bRes, kioskRes] = await Promise.all([
        fetch('/api/manufacturer/custom-designs', { cache: 'no-store', credentials: 'same-origin' }),
        fetch('/api/manufacturer/orders', { cache: 'no-store', credentials: 'same-origin' }),
        fetch('/api/manufacturer/kiosk-orders', { cache: 'no-store', credentials: 'same-origin' }),
      ]);
      if (customRes.status === 401) { window.location.assign('/manufacturer/login'); return; }
      const customJson = (await customRes.json()) as { data?: CustomOrder[]; error?: { message: string } };
      const b2bJson = (await b2bRes.json()) as { data?: Array<{ id: string; orderNumber: string }>; error?: { message: string } };
      const kioskJson = (await kioskRes.json()) as { data?: Array<{ id: string; orderNumber: string }>; error?: { message: string } };
      if (!customRes.ok || customJson.error) {
        setError(customJson.error?.message ?? 'Failed to load');
        return;
      }
      // Resolve "Reference Order No." (the source Catalog/Kiosk order's
      // JFA-####) client-side from the already-loaded lists — no extra round-trip.
      const orderNumberById = new Map<string, string>();
      for (const o of b2bJson.data ?? []) orderNumberById.set(o.id, o.orderNumber);
      for (const o of kioskJson.data ?? []) orderNumberById.set(o.id, o.orderNumber);
      const resolved = (customJson.data ?? []).map((o) => ({
        ...o,
        referenceOrderNumber: (o.sourceB2bOrderId && orderNumberById.get(o.sourceB2bOrderId))
          || (o.sourceKioskOrderId && orderNumberById.get(o.sourceKioskOrderId))
          || null,
      }));
      setOrders(resolved.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      setError(null);
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadList(); }, []);

  const retailerOptions = useMemo(() => uniqueBranchOptions((orders ?? []).map((o) => o.storeNameSnapshot)), [orders]);
  const karigarOptions = useMemo(() => [...new Set((orders ?? []).map((o) => o.karigar?.code ?? o.karigarCode).filter((c): c is string => !!c))].sort(), [orders]);
  const filtered = useMemo(
    () => (orders ?? []).filter((o) =>
      matchOrder(o, { search, status, branch: retailer, branchName: o.storeNameSnapshot, from, to }) &&
      (!karigarFilter || (o.karigar?.code ?? o.karigarCode) === karigarFilter),
    ),
    [orders, search, status, retailer, from, to, karigarFilter],
  );

  async function toggle(order: CustomOrder) {
    if (expanded === order.id) { setExpanded(null); setItems(null); return; }
    setExpanded(order.id); setItems(null);
    // Best-effort check-on-view sync (lib/db/o2d-sync.ts) — this items fetch
    // reads straight from Jewel Factory's own DB, so without this the
    // expanded card could show a stale item status until the next full
    // page reload re-runs loadList()'s own sync. Must complete before the
    // fetch below, not run in parallel with it.
    try { await apiPost('/api/manufacturer/o2d/sync-statuses'); } catch { /* best-effort */ }
    const res = await fetch(`/api/manufacturer/custom-designs/${order.id}/items`, { cache: 'no-store', credentials: 'same-origin' });
    const json = (await res.json()) as { data?: Array<Record<string, unknown>> };
    setItems((json.data ?? []).map((i) => ({
      id: i.id as string,
      productNameSnapshot: (i.productNameSnapshot as string) ?? '',
      productImageSnapshot: (i.productImageSnapshot as string | null) ?? null,
      categorySnapshot: (i.categorySnapshot as string | null) ?? null,
      quantity: i.quantity as number,
      status: (i.status as string) ?? 'PENDING',
      purity: (i.purity as string | null) ?? null,
      product: (i.manufacturerProduct as OrderItemProduct | null) ?? null,
      sourceKind: i.sourceKind as 'b2b' | 'kiosk',
      sourceOrderId: i.sourceOrderId as string,
    })));
  }

  async function advance(order: CustomOrder, next: string) {
    setBusy(order.id);
    try {
      await apiSend('PATCH', `/api/manufacturer/custom-designs/${order.id}`, { status: next });
      await loadList();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(null);
    }
  }

  async function setItemStatus(item: Item, next: string) {
    if (next === item.status || !item.sourceKind || !item.sourceOrderId) return;
    setItemBusy(item.id);
    try {
      await apiSend('PATCH', `${endpointFor(item.sourceKind, item.sourceOrderId)}/items/${item.id}`, { status: next });
      setItems((prev) => prev ? prev.map((it) => it.id === item.id ? { ...it, status: next } : it) : prev);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed');
    } finally {
      setItemBusy(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4">
      <div>
        <h1 className="text-2xl font-medium tracking-tight">Customised Orders</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Orders assigned to a Karigar.</p>
      </div>
      {orders && orders.length > 0 && (
        <div className="space-y-2">
          <OrderFilters
            search={search} onSearch={setSearch}
            status={status} onStatus={setStatus} statusOptions={KIOSK_B2B_STATUS_OPTIONS}
            group={retailer} onGroup={setRetailer} groupOptions={retailerOptions} groupAllLabel="All customers" groupLabel="Customer"
            from={from} to={to} onFrom={setFrom} onTo={setTo}
          />
          {karigarOptions.length > 0 && (
            <select className="h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={karigarFilter} onChange={(e) => setKarigarFilter(e.target.value)}>
              <option value="">All karigars</option>
              {karigarOptions.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          )}
        </div>
      )}
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {loading && <div className="flex items-center gap-2 py-12 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>}
      {orders && orders.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
          <PencilLine className="h-10 w-10 text-muted-foreground/40" /><p className="text-sm text-muted-foreground">No Customised orders yet — assign a Karigar to a Catalogue Order to create one.</p>
        </div>
      )}
      {orders && orders.length > 0 && filtered.length === 0 && (
        <p className="py-12 text-center text-sm text-muted-foreground">No orders match your filters.</p>
      )}
      {filtered.length > 0 && (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="hidden grid-cols-[1fr_1fr_8rem_9rem] items-center gap-4 border-b bg-muted/20 px-4 py-2 sm:grid">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Order ID</span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Customer</span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Order Date</span>
            <span className="text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Status</span>
          </div>
          <div className="divide-y">
          {filtered.map((o) => (
            <div key={o.id}>
              <button type="button" onClick={() => toggle(o)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/30">
                <div className="grid flex-1 grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-[1fr_1fr_8rem_9rem] sm:items-center sm:gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground sm:hidden">Order</p>
                    <p className="text-sm font-medium">{o.orderNumber}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground sm:hidden">Customer</p>
                    <p className="text-sm font-medium text-primary truncate">{o.storeNameSnapshot ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground sm:hidden">Order Date</p>
                    <p className="text-sm text-muted-foreground">{new Date(o.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                    {o.deliveryDate && (
                      <p className="text-xs text-muted-foreground">
                        Delivery: {new Date(o.deliveryDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </p>
                    )}
                  </div>
                  <div className="flex items-start sm:justify-end"><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS[o.status] ?? ''}`}>{formatOrderLevelStatus(o.status)}</span></div>
                </div>
                {expanded === o.id ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </button>
              {expanded === o.id && (
                <div className="border-t bg-muted/10 px-4 pb-4 pt-3 space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Ship to</p>
                      <p className="text-sm">{o.storeAddressSnapshot || '—'}</p>
                    </div>
                    {o.referenceOrderNumber && (
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Reference Order No.</p>
                        <p className="text-sm">{o.referenceOrderNumber}</p>
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Design</p>
                    <p className="text-sm">{o.category}{o.subCategory ? ` › ${o.subCategory}` : ''}</p>
                  </div>
                  <CustomSpecList spec={o} />
                  {o.designNotes && <div><p className="text-xs text-muted-foreground uppercase tracking-wider">Remarks</p><p className="whitespace-pre-wrap text-sm">{o.designNotes}</p></div>}
                  {(() => {
                    const images = o.referenceImageUrls.length > 0 ? o.referenceImageUrls : (o.referenceImageUrl ? [o.referenceImageUrl] : []);
                    return images.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {images.map((url) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            key={url}
                            src={url}
                            alt="reference"
                            className="h-20 w-20 rounded-lg border object-cover cursor-pointer hover:shadow-md transition-shadow"
                            onClick={() => setZoomCustomImages(images)}
                          />
                        ))}
                      </div>
                    ) : null;
                  })()}
                  {items === null && <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>}
                  {items && items.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5">Items</p>
                      <div className="hidden grid-cols-[5rem_1fr_3rem_7rem] items-center gap-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground sm:grid">
                        <span>Image</span><span>Design No.</span><span>Qty</span><span>Status</span>
                      </div>
                      <div className="space-y-2">
                        {items.map((it) => (
                          <div key={it.id} className="flex w-full items-center gap-3 rounded-lg hover:bg-black/5">
                            <button
                              type="button"
                              onClick={() => it.product && setProductModal(it.product)}
                              disabled={!it.product}
                              className="flex min-w-0 flex-1 items-center gap-3 text-left disabled:cursor-default"
                            >
                              {it.productImageSnapshot ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={it.productImageSnapshot}
                                  alt={it.productNameSnapshot}
                                  className="h-20 w-20 shrink-0 rounded-lg border bg-white object-contain p-1 cursor-pointer hover:shadow-md transition-shadow"
                                  onClick={(e) => { e.stopPropagation(); setZoomItem(it); }}
                                />
                              ) : <div className="h-20 w-20 shrink-0 rounded-lg border bg-muted" />}
                              <span className="min-w-0 flex-1">
                                <span className="block text-sm font-medium">{it.product?.designNumber ?? it.productNameSnapshot}</span>
                                <span className="block text-xs text-muted-foreground">
                                  {it.product?.category ?? it.categorySnapshot ?? '—'}
                                  {it.product?.subCategory ? ` › ${it.product.subCategory}` : ''}
                                  {it.product?.weightGrams != null ? ` · ${it.product.weightGrams}gm` : ''}
                                  {it.purity ? ` · ${it.purity}` : ''}
                                </span>
                              </span>
                              <span className="text-sm tabular-nums text-muted-foreground">× {it.quantity}</span>
                            </button>
                            <div className="flex shrink-0 flex-col items-end gap-1">
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS[it.status] ?? ''}`}>{formatOrderStatus(it.status)}</span>
                              {/* Once sent to O2D, status is driven automatically by the
                                  o2d-sync check-on-view mechanism (In Process -> Ready for
                                  Delivery -> Completed) -- a manual edit here would just get
                                  overwritten on the next page load, so don't offer it. */}
                              {!o.o2dOrderNo && (
                                <select
                                  value={it.status}
                                  disabled={itemBusy === it.id}
                                  onChange={(e) => { e.stopPropagation(); void setItemStatus(it, e.target.value); }}
                                  onClick={(e) => e.stopPropagation()}
                                  className="h-6 rounded border border-input bg-transparent px-1 text-[10px] disabled:opacity-50"
                                >
                                  {ALL_ITEM_STATUSES.map((s) => <option key={s} value={s}>{formatOrderStatus(s)}</option>)}
                                </select>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <KarigarOrderForm
                    order={{
                      id: o.id,
                      orderNumber: o.orderNumber,
                      referenceOrderNumber: o.referenceOrderNumber ?? null,
                      karigarId: o.karigarId ?? null,
                      storeName: o.storeNameSnapshot,
                      storeAddress: o.storeAddressSnapshot,
                      category: o.category,
                      subCategory: o.subCategory,
                      weightGramsMin: o.weightGramsMin,
                      weightGramsMax: o.weightGramsMax,
                      purity: o.purity,
                      quantity: o.quantity,
                      deliveryDate: o.deliveryDate,
                      karigarDeliveryDate: o.karigarDeliveryDate ?? null,
                      meena: o.meena,
                      length: o.length,
                      size: o.size,
                      broadness: o.broadness,
                      screw: o.screw,
                      sampleWeightGrams: o.sampleWeightGrams,
                      totalWeightGrams: o.totalWeightGrams ?? null,
                      karigarNotes: o.karigarNotes ?? null,
                      narration1: o.narration1 ?? null,
                      narration2: o.narration2 ?? null,
                      qc: o.qc ?? null,
                      orderType: o.orderType ?? null,
                      orderStage: o.orderStage ?? null,
                      urgent: o.urgent ?? false,
                      karigarCode: o.karigar?.code ?? o.karigarCode,
                      designNotes: o.designNotes,
                      imageUrl: o.referenceImageUrls[0] ?? o.referenceImageUrl,
                      createdAt: o.createdAt,
                      o2dOrderNo: o.o2dOrderNo ?? null,
                      o2dSyncError: o.o2dSyncError ?? null,
                    }}
                    items={(items ?? []).map((it) => ({
                      designNumber: it.product?.designNumber ?? it.productNameSnapshot,
                      imageUrl: it.productImageSnapshot,
                      quantity: it.quantity,
                      category: it.product?.category ?? it.categorySnapshot,
                      subCategory: it.product?.subCategory ?? null,
                      weightGrams: it.product?.weightGrams ?? null,
                      purity: it.purity,
                      description: it.product?.description ?? null,
                    }))}
                    onSaved={() => void loadList()}
                  />
                  <div className="flex flex-wrap gap-2">
                    {o.status === 'PENDING' && (
                      <Button size="sm" disabled={busy === o.id} onClick={() => advance(o, 'IN_PROCESS')} className="metal-sheen text-[#17120b] font-semibold">
                        {busy === o.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Mark as Approved'}
                      </Button>
                    )}
                    {o.status !== 'COMPLETED' && o.status !== 'CANCELLED' && (
                      <Button size="sm" variant="outline" disabled={busy === o.id} onClick={() => advance(o, 'COMPLETED')}>
                        {busy === o.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Mark as Complete'}
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
          </div>
        </div>
      )}

      {zoomItem?.productImageSnapshot && (
        <ImageZoomModal
          isOpen={!!zoomItem}
          images={[zoomItem.productImageSnapshot]}
          productName={zoomItem.productNameSnapshot}
          onClose={() => setZoomItem(null)}
        />
      )}

      {zoomCustomImages && (
        <ImageZoomModal
          isOpen={!!zoomCustomImages}
          images={zoomCustomImages}
          productName="Reference Image"
          onClose={() => setZoomCustomImages(null)}
        />
      )}

      {productModal && <ManufacturerOrderItemModal product={productModal} onClose={() => setProductModal(null)} />}
    </div>
  );
}
