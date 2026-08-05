'use client';

import { ChevronDown, ChevronUp, Loader2, ShoppingBag } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { CustomSpecList } from '@/components/orders/CustomSpecList';
import { ImageZoomModal } from '@/components/orders/ImageZoomModal';
import { ManufacturerOrderItemModal, type OrderItemProduct } from '@/components/orders/ManufacturerOrderItemModal';
import { OrderFilters } from '@/components/orders/OrderFilters';
import { Button } from '@/components/ui/button';
import { apiSend } from '@/hooks/use-api';
import { formatOrderStatus, formatOrderLevelStatus } from '@/lib/format';
import { KIOSK_B2B_STATUS_OPTIONS, matchOrder, uniqueBranchOptions } from '@/lib/order-filters';

// Catalogue Orders merges the manufacturer's three order sources — B2B/restock
// orders, kiosk (customer) orders, and customised design orders — into one
// list. All three originate from a Purchase manager either way, so the
// manufacturer has no reason to see them as separate pages; `source` is
// tracked only to route detail-fetch/advance calls to the right API, never
// rendered. The manufacturer's own separate Customised Orders page/nav entry
// (app/manufacturer/custom-designs/page.tsx) stays untouched — this merge is
// additive, the same orders now also surface here.
//
// The manufacturer sees the retailer's business name (e.g. "ABC") on every
// order view, but not city/branch — only the ship-to address and any
// remark/note the retailer wrote carry more location detail than that.
// Backend (getB2bOrdersByManufacturer, sanitizeKiosk,
// listCustomOrdersByManufacturer) returns storeName/storeNameSnapshot for
// exactly this reason (2026-08-05).
type Source = 'b2b' | 'kiosk' | 'custom';

// Restock (B2B) = the store ordering stock for itself; Store Customer (kiosk)
// = a walk-in customer's order taken at the counter; Customised = a bespoke
// design request. Only Customised gets a badge on the row — the other two
// look identical there, per client wording ("itna sara nahi, sirf customised
// order rakhna h") — but the filter dropdown still offers all three.
const SOURCE_LABEL: Record<Source, string> = {
  b2b: 'Restock', kiosk: 'Store Customer', custom: 'Customised',
};

type B2bOrder = { id: string; orderNumber: string; status: string; totalItems: number; createdAt: string; storeName: string | null; karigarCodes?: string[] };
type KioskOrder = {
  id: string; orderNumber: string; status: string; totalItems: number; createdAt: string;
  storeNameSnapshot: string; requirementNote: string | null;
  shipToStoreAddress: string; karigarCodes?: string[];
};
type CustomOrder = {
  id: string; orderNumber: string; status: string; createdAt: string;
  storeNameSnapshot: string; storeAddressSnapshot: string;
  category: string; subCategory: string | null;
  weightGramsMin: string | null; weightGramsMax: string | null; purity: string | null;
  referenceImageUrl: string | null; referenceImageUrls: string[]; designNotes: string | null;
  orderRef: string | null; deliveryDate: string | null; quantity: string | null;
  meena: string | null; length: string | null; size: string | null;
  broadness: string | null; screw: string | null; sampleWeightGrams: string | null;
  karigarCode: string | null;
};

type Row = {
  id: string; source: Source; orderNumber: string; status: string; totalItems: number; createdAt: string;
  storeName: string | null; karigarCodes: string[];
  custom?: CustomOrder;
};

type Item = {
  id: string; productNameSnapshot: string; productImageSnapshot: string | null; categorySnapshot: string | null; quantity: number;
  status: string;
  purity: string | null;
  product: OrderItemProduct | null;
};
type Detail = {
  requirementNote: string | null; shipToStoreAddress: string; items: Item[];
};

const STATUS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800', IN_PROCESS: 'bg-blue-100 text-blue-800',
  GHAT_RECEIVED: 'bg-purple-100 text-purple-800', READY_FOR_DELIVERY: 'bg-indigo-100 text-indigo-800',
  DISPATCHED: 'bg-amber-100 text-amber-800', COMPLETED: 'bg-green-100 text-green-800', CANCELLED: 'bg-red-100 text-red-700',
};
// Free-form — the manufacturer can set an item to any status directly
// (including Cancelled, for a rejected/never-made item), not just the next
// one in sequence.
const ALL_ITEM_STATUSES = ['PENDING', 'IN_PROCESS', 'GHAT_RECEIVED', 'READY_FOR_DELIVERY', 'DISPATCHED', 'COMPLETED', 'CANCELLED'];

function endpointFor(source: Source, id?: string) {
  if (source === 'kiosk') return `/api/manufacturer/kiosk-orders${id ? `/${id}` : ''}`;
  if (source === 'custom') return `/api/manufacturer/custom-designs${id ? `/${id}` : ''}`;
  return `/api/manufacturer/orders${id ? `/${id}` : ''}`;
}

export default function ManufacturerOrdersPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [itemBusy, setItemBusy] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [retailer, setRetailer] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [karigarFilter, setKarigarFilter] = useState('');
  const [zoomItem, setZoomItem] = useState<Item | null>(null);
  const [zoomCustomImages, setZoomCustomImages] = useState<string[] | null>(null);
  const [productModal, setProductModal] = useState<OrderItemProduct | null>(null);

  async function loadList() {
    setLoading(true);
    try {
      const [b2bRes, kioskRes, customRes] = await Promise.all([
        fetch('/api/manufacturer/orders', { cache: 'no-store', credentials: 'same-origin' }),
        fetch('/api/manufacturer/kiosk-orders', { cache: 'no-store', credentials: 'same-origin' }),
        fetch('/api/manufacturer/custom-designs', { cache: 'no-store', credentials: 'same-origin' }),
      ]);
      if (b2bRes.status === 401 || kioskRes.status === 401 || customRes.status === 401) { window.location.assign('/manufacturer/login'); return; }
      const b2bJson = (await b2bRes.json()) as { data?: B2bOrder[]; error?: { message: string } };
      const kioskJson = (await kioskRes.json()) as { data?: KioskOrder[]; error?: { message: string } };
      const customJson = (await customRes.json()) as { data?: CustomOrder[]; error?: { message: string } };
      if (!b2bRes.ok || b2bJson.error || !kioskRes.ok || kioskJson.error || !customRes.ok || customJson.error) {
        setError(b2bJson.error?.message ?? kioskJson.error?.message ?? customJson.error?.message ?? 'Failed to load');
        return;
      }
      const b2bRows: Row[] = (b2bJson.data ?? []).map((o) => ({
        id: o.id, source: 'b2b', orderNumber: o.orderNumber, status: o.status, totalItems: o.totalItems,
        createdAt: o.createdAt, storeName: o.storeName, karigarCodes: o.karigarCodes ?? [],
      }));
      const kioskRows: Row[] = (kioskJson.data ?? []).map((o) => ({
        id: o.id, source: 'kiosk', orderNumber: o.orderNumber, status: o.status, totalItems: o.totalItems,
        createdAt: o.createdAt, storeName: o.storeNameSnapshot, karigarCodes: o.karigarCodes ?? [],
      }));
      const customRows: Row[] = (customJson.data ?? []).map((o) => ({
        id: o.id, source: 'custom', orderNumber: o.orderNumber, status: o.status, totalItems: 0,
        createdAt: o.createdAt, storeName: o.storeNameSnapshot, karigarCodes: o.karigarCode ? [o.karigarCode] : [], custom: o,
      }));
      setRows([...b2bRows, ...kioskRows, ...customRows].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      setError(null);
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadList(); }, []);

  const retailerOptions = useMemo(() => uniqueBranchOptions((rows ?? []).map((o) => o.storeName)), [rows]);
  const karigarOptions = useMemo(() => [...new Set((rows ?? []).flatMap((o) => o.karigarCodes))].sort(), [rows]);
  const filtered = useMemo(
    () => (rows ?? []).filter((o) =>
      matchOrder(o, { search, status, branch: retailer, branchName: o.storeName, from, to }) &&
      (!sourceFilter || o.source === sourceFilter) &&
      (!karigarFilter || o.karigarCodes.includes(karigarFilter)),
    ),
    [rows, search, status, retailer, sourceFilter, from, to, karigarFilter],
  );

  async function toggle(row: Row) {
    if (expanded === row.id) { setExpanded(null); setDetail(null); return; }
    setExpanded(row.id); setDetail(null);
    // Custom orders have no separate detail endpoint — listCustomOrdersByManufacturer
    // already returns the full spec, so the row itself carries everything needed.
    if (row.source === 'custom') return;
    const res = await fetch(endpointFor(row.source, row.id), { cache: 'no-store', credentials: 'same-origin' });
    const json = (await res.json()) as { data?: Record<string, unknown> };
    if (!json.data) return;
    if (row.source === 'kiosk') {
      setDetail({
        requirementNote: (json.data.requirementNote as string | null) ?? null,
        shipToStoreAddress: (json.data.shipToStoreAddress as string) ?? '',
        items: (json.data.items as Item[]) ?? [],
      });
    } else {
      setDetail({
        requirementNote: (json.data.requirementNote as string | null) ?? null,
        shipToStoreAddress: (json.data.deliveryAddress as string) ?? '',
        items: ((json.data.items as Array<Record<string, unknown>>) ?? []).map((i) => ({
          id: i.id as string,
          productNameSnapshot: (i.productNameSnapshot as string) ?? '',
          productImageSnapshot: (i.productImageSnapshot as string | null) ?? null,
          categorySnapshot: null,
          quantity: i.quantity as number,
          status: (i.status as string) ?? 'PENDING',
          purity: (i.purity as string | null) ?? null,
          product: (i.manufacturerProduct as OrderItemProduct | null) ?? null,
        })),
      });
    }
  }

  // Order-level status is manual, not derived from items — two explicit
  // actions: Approve (Pending -> In Process) and Complete (-> Completed),
  // independent of whatever stage the individual items are at.
  async function advance(row: Row, next: string) {
    setBusy(row.id);
    try {
      await apiSend('PATCH', endpointFor(row.source, row.id), { status: next });
      await loadList();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(null);
    }
  }

  async function setItemStatus(row: Row, item: Item, next: string) {
    if (next === item.status) return;
    setItemBusy(item.id);
    try {
      await apiSend('PATCH', `${endpointFor(row.source, row.id)}/items/${item.id}`, { status: next });
      setDetail((prev) => prev ? { ...prev, items: prev.items.map((it) => it.id === item.id ? { ...it, status: next } : it) } : prev);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed');
    } finally {
      setItemBusy(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4">
      <div>
        <h1 className="text-2xl font-medium tracking-tight">Catalogue Orders</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Orders placed by customers from your catalog.</p>
      </div>
      {rows && rows.length > 0 && (
        <div className="space-y-2">
          <OrderFilters
            search={search} onSearch={setSearch}
            status={status} onStatus={setStatus} statusOptions={KIOSK_B2B_STATUS_OPTIONS}
            group={retailer} onGroup={setRetailer} groupOptions={retailerOptions} groupAllLabel="All customers" groupLabel="Customer"
            from={from} to={to} onFrom={setFrom} onTo={setTo}
          />
          <select className="h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} aria-label="Order type">
            <option value="">All order types</option>
            <option value="b2b">{SOURCE_LABEL.b2b}</option>
            <option value="kiosk">{SOURCE_LABEL.kiosk}</option>
            <option value="custom">{SOURCE_LABEL.custom}</option>
          </select>
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
      {rows && rows.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
          <ShoppingBag className="h-10 w-10 text-muted-foreground/40" /><p className="text-sm text-muted-foreground">No orders yet.</p>
        </div>
      )}
      {rows && rows.length > 0 && filtered.length === 0 && (
        <p className="py-12 text-center text-sm text-muted-foreground">No orders match your filters.</p>
      )}
      {filtered.length > 0 && (
        <div className="rounded-xl border bg-card overflow-hidden">
          {/* Column headings — new users otherwise have to guess what each
              value in a row represents. */}
          <div className="hidden grid-cols-[1fr_1fr_auto_8rem_9rem] items-center gap-4 border-b bg-muted/20 px-4 py-2 sm:grid">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Order ID</span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Customer</span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Items</span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Order Date</span>
            <span className="text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Status</span>
          </div>
          <div className="divide-y">
          {filtered.map((o) => (
            <div key={o.id}>
              <button type="button" onClick={() => toggle(o)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/30">
                <div className="grid flex-1 grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-[1fr_1fr_auto_8rem_9rem] sm:items-center sm:gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground sm:hidden">Order</p>
                    <p className="text-sm font-medium">{o.orderNumber}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground sm:hidden">Customer</p>
                    <p className="text-sm font-medium text-primary truncate">{o.storeName ?? '—'}</p>
                    {o.source === 'custom' && <span className="mt-0.5 inline-block rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-800">Customised</span>}
                  </div>
                  <div><p className="text-xs text-muted-foreground sm:hidden">Items</p><p className="text-sm tabular-nums">{o.source === 'custom' ? '—' : o.totalItems}</p></div>
                  <div>
                    <p className="text-xs text-muted-foreground sm:hidden">Order Date</p>
                    <p className="text-sm text-muted-foreground">{new Date(o.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                  </div>
                  <div className="flex items-start sm:justify-end"><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS[o.status] ?? ''}`}>{formatOrderLevelStatus(o.status)}</span></div>
                </div>
                {expanded === o.id ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </button>
              {expanded === o.id && o.source === 'custom' && o.custom && (
                <div className="border-t bg-muted/10 px-4 pb-4 pt-3 space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Ship to</p>
                    <p className="text-sm">{o.custom.storeAddressSnapshot || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Design</p>
                    <p className="text-sm">{o.custom.category}{o.custom.subCategory ? ` › ${o.custom.subCategory}` : ''}</p>
                  </div>
                  <CustomSpecList spec={o.custom} />
                  {o.custom.designNotes && <div><p className="text-xs text-muted-foreground uppercase tracking-wider">Remarks</p><p className="whitespace-pre-wrap text-sm">{o.custom.designNotes}</p></div>}
                  {(() => {
                    const images = o.custom.referenceImageUrls.length > 0 ? o.custom.referenceImageUrls : (o.custom.referenceImageUrl ? [o.custom.referenceImageUrl] : []);
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
              {expanded === o.id && o.source !== 'custom' && (
                <div className="border-t bg-muted/10 px-4 pb-4 pt-3 space-y-3">
                  {!detail && <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>}
                  {detail?.requirementNote && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Remark</p>
                      <p className="whitespace-pre-wrap text-sm">{detail.requirementNote}</p>
                    </div>
                  )}
                  {detail && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Ship to</p>
                      <p className="text-sm">{detail.shipToStoreAddress || '—'}</p>
                    </div>
                  )}
                  {detail?.items && detail.items.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5">Items</p>
                      <div className="space-y-2">
                        {detail.items.map((it) => (
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
                                {it.product?.karigarCode && (
                                  <span className="mt-0.5 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">Karigar: {it.product.karigarCode}</span>
                                )}
                              </span>
                              <span className="text-sm tabular-nums text-muted-foreground">× {it.quantity}</span>
                            </button>
                            <div className="flex shrink-0 flex-col items-end gap-1">
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS[it.status] ?? ''}`}>{formatOrderStatus(it.status)}</span>
                              <select
                                value={it.status}
                                disabled={itemBusy === it.id}
                                onChange={(e) => { e.stopPropagation(); void setItemStatus(o, it, e.target.value); }}
                                onClick={(e) => e.stopPropagation()}
                                className="h-6 rounded border border-input bg-transparent px-1 text-[10px] disabled:opacity-50"
                              >
                                {ALL_ITEM_STATUSES.map((s) => <option key={s} value={s}>{formatOrderStatus(s)}</option>)}
                              </select>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
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
