'use client';

import { Loader2, ShoppingBag } from 'lucide-react';
import { Fragment, useEffect, useMemo, useState } from 'react';

import { AssignKarigarModal, type AssignKarigarManualFields } from '@/components/orders/AssignKarigarModal';
import { ALL_ITEM_STATUSES, CatalogOrderAssignModal, useCatalogOrderAssignment, useCustomisedOrderNumbers, type CatalogOrderItem } from '@/components/orders/CatalogOrderItemsBlock';
import { ImageZoomModal } from '@/components/orders/ImageZoomModal';
import { KarigarPicker, type Karigar } from '@/components/orders/KarigarAssignPanel';
import { ManufacturerOrderItemModal, type OrderItemProduct } from '@/components/orders/ManufacturerOrderItemModal';
import { OrderFilters } from '@/components/orders/OrderFilters';
import { OrderSummaryModal } from '@/components/orders/OrderSummaryModal';
import { Button } from '@/components/ui/button';
import { apiPost, apiSend } from '@/hooks/use-api';
import { formatOrderLevelStatus } from '@/lib/format';
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
type Source = 'b2b' | 'kiosk' | 'custom' | 'retailer-custom';

// Restock (B2B) = the store ordering stock for itself; Store Customer (kiosk)
// = a walk-in customer's order taken at the counter; Customised = a bespoke
// design request (already assigned a Karigar); retailer-custom = a Retailer
// Admin's own bespoke request AWAITING Karigar assignment (2026-08-10
// redesign — see RetailerCustomRequest). Only Customised/retailer-custom get
// a badge on the row — Restock/Store Customer look identical there, per
// client wording ("itna sara nahi, sirf customised order rakhna h") — but
// the filter dropdown still offers all four.
const SOURCE_LABEL: Record<Source, string> = {
  b2b: 'Restock', kiosk: 'Store Customer', custom: 'Customised', 'retailer-custom': 'Customised',
};

type B2bOrder = {
  id: string; orderNumber: string; status: string; totalItems: number; createdAt: string; deliveryDate: string | null;
  storeName: string | null; karigarCodes?: string[]; totalQuantity?: number; pendingQuantity?: number;
  requirementNote: string | null;
};
type KioskOrder = {
  id: string; orderNumber: string; status: string; totalItems: number; createdAt: string; deliveryDate: string | null;
  storeNameSnapshot: string; requirementNote: string | null;
  shipToStoreAddress: string; karigarCodes?: string[]; totalQuantity?: number; pendingQuantity?: number;
};
// A Retailer Admin's own bespoke request, PENDING Karigar assignment — lands
// in this same Catalog Orders list, tagged "Customised Order from {business
// name}". Once assigned, orderId points at the resulting CustomDesignOrder
// and the row would instead surface via the normal `custom` source on a
// future reload (status flips to ASSIGNED server-side).
type RetailerCustomRequestRow = {
  id: string; orderNumber: string; status: 'PENDING' | 'ASSIGNED'; createdAt: string;
  storeNameSnapshot: string; storeAddressSnapshot: string; orderId: string | null;
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
  totalWeightGrams?: string | null; karigarNotes?: string | null;
  karigarCode: string | null;
  // Karigar-assignment fields (2026-08-09) — present when this Customised
  // Order originated from assigning items on a Catalog/Kiosk order, or once
  // the manufacturer fills the Phase 2 form.
  sourceB2bOrderId?: string | null; sourceKioskOrderId?: string | null;
  karigarId?: string | null; karigar?: { id: string; code: string } | null;
  karigarDeliveryDate?: string | null;
  narration1?: string | null; narration2?: string | null; qc?: string | null;
  orderType?: string | null; orderStage?: string | null; urgent?: boolean;
  referenceOrderNumber?: string | null; // JFA-#### of the source order, resolved client-side
};

type Row = {
  id: string; source: Source; orderNumber: string; status: string; totalItems: number; createdAt: string;
  deliveryDate: string | null;
  storeName: string | null; karigarCodes: string[];
  totalQuantity: number | null; pendingQuantity: number | null;
  requirementNote: string | null;
  custom?: CustomOrder;
  retailerRequest?: RetailerCustomRequestRow;
};

type Item = {
  id: string; productNameSnapshot: string; productImageSnapshot: string | null; categorySnapshot: string | null; quantity: number;
  status: string;
  purity: string | null;
  product: OrderItemProduct | null;
  customisedOrderId?: string | null;
  customisedOrderNumber?: string | null;
  // Only set on items fetched via a Customised Order's own Items table — lets
  // a per-item status change route back to the item's ORIGINAL b2b/kiosk
  // order (status is still owned by that order, not the Customised Order).
  sourceKind?: 'b2b' | 'kiosk';
  sourceOrderId?: string;
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

function endpointFor(source: Source, id?: string) {
  if (source === 'kiosk') return `/api/manufacturer/kiosk-orders${id ? `/${id}` : ''}`;
  if (source === 'custom') return `/api/manufacturer/custom-designs${id ? `/${id}` : ''}`;
  if (source === 'retailer-custom') return `/api/manufacturer/retailer-custom-requests${id ? `/${id}` : ''}`;
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
  const [notesRow, setNotesRow] = useState<Row | null>(null);

  async function loadList() {
    setLoading(true);
    try {
      // Customised Orders (JFC-####) are deliberately NOT merged into this
      // list (2026-08-11 reversal of the 2026-08-05 merge) — once a Karigar
      // is assigned, the resulting order surfaces only on the sidebar's
      // Customised Orders page (app/manufacturer/custom-designs/page.tsx),
      // not here. Retailer-custom bespoke requests still show here WHILE
      // pending Karigar assignment (retailer-custom source), since they're
      // functionally awaiting the same action as a normal Catalog order.
      const [b2bRes, kioskRes, retailerReqRes] = await Promise.all([
        fetch('/api/manufacturer/orders', { cache: 'no-store', credentials: 'same-origin' }),
        fetch('/api/manufacturer/kiosk-orders', { cache: 'no-store', credentials: 'same-origin' }),
        fetch('/api/manufacturer/retailer-custom-requests', { cache: 'no-store', credentials: 'same-origin' }),
      ]);
      if (b2bRes.status === 401 || kioskRes.status === 401 || retailerReqRes.status === 401) { window.location.assign('/manufacturer/login'); return; }
      const b2bJson = (await b2bRes.json()) as { data?: B2bOrder[]; error?: { message: string } };
      const kioskJson = (await kioskRes.json()) as { data?: KioskOrder[]; error?: { message: string } };
      const retailerReqJson = (await retailerReqRes.json()) as { data?: RetailerCustomRequestRow[]; error?: { message: string } };
      if (!b2bRes.ok || b2bJson.error || !kioskRes.ok || kioskJson.error || !retailerReqRes.ok || retailerReqJson.error) {
        setError(b2bJson.error?.message ?? kioskJson.error?.message ?? retailerReqJson.error?.message ?? 'Failed to load');
        return;
      }
      const b2bRows: Row[] = (b2bJson.data ?? []).map((o) => ({
        id: o.id, source: 'b2b', orderNumber: o.orderNumber, status: o.status, totalItems: o.totalItems,
        createdAt: o.createdAt, deliveryDate: o.deliveryDate, storeName: o.storeName, karigarCodes: o.karigarCodes ?? [],
        totalQuantity: o.totalQuantity ?? null, pendingQuantity: o.pendingQuantity ?? null, requirementNote: o.requirementNote,
      }));
      const kioskRows: Row[] = (kioskJson.data ?? []).map((o) => ({
        id: o.id, source: 'kiosk', orderNumber: o.orderNumber, status: o.status, totalItems: o.totalItems,
        createdAt: o.createdAt, deliveryDate: o.deliveryDate, storeName: o.storeNameSnapshot, karigarCodes: o.karigarCodes ?? [],
        totalQuantity: o.totalQuantity ?? null, pendingQuantity: o.pendingQuantity ?? null, requirementNote: o.requirementNote,
      }));
      // Only PENDING retailer-custom requests belong in this list — once
      // assigned (status ASSIGNED, orderId set), the resulting CustomDesignOrder
      // surfaces only on the Customised Orders page, not here.
      const retailerReqRows: Row[] = (retailerReqJson.data ?? [])
        .filter((r) => r.status === 'PENDING')
        .map((r) => ({
          id: r.id, source: 'retailer-custom', orderNumber: r.orderNumber, status: 'PENDING', totalItems: 0,
          createdAt: r.createdAt, deliveryDate: null, storeName: r.storeNameSnapshot, karigarCodes: [],
          totalQuantity: null, pendingQuantity: null, requirementNote: null,
          retailerRequest: r,
        }));
      setRows([...b2bRows, ...kioskRows, ...retailerReqRows].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
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
    // Retailer-custom requests have no separate detail endpoint needed here
    // — the list response already carries the full spec.
    if (row.source === 'retailer-custom') return;
    const res = await fetch(endpointFor(row.source, row.id), { cache: 'no-store', credentials: 'same-origin' });
    const json = (await res.json()) as { data?: Record<string, unknown> };
    if (!json.data) return;
    if (row.source === 'kiosk') {
      setDetail({
        requirementNote: (json.data.requirementNote as string | null) ?? null,
        shipToStoreAddress: (json.data.shipToStoreAddress as string) ?? '',
        items: ((json.data.items as Array<Record<string, unknown>>) ?? []).map((i) => ({
          id: i.id as string,
          productNameSnapshot: (i.productNameSnapshot as string) ?? '',
          productImageSnapshot: (i.productImageSnapshot as string | null) ?? null,
          categorySnapshot: (i.categorySnapshot as string | null) ?? null,
          quantity: i.quantity as number,
          status: (i.status as string) ?? 'PENDING',
          purity: (i.purity as string | null) ?? null,
          product: (i.manufacturerProduct as OrderItemProduct | null) ?? null,
          customisedOrderId: (i.customisedOrderId as string | null) ?? null,
        })),
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
          customisedOrderId: (i.customisedOrderId as string | null) ?? null,
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
            <option value="retailer-custom">{SOURCE_LABEL['retailer-custom']}</option>
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
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-sm">
              <thead>
                <tr className="border-b bg-[#17120b]/[0.03] text-left">
                  <th className="whitespace-nowrap px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Order ID</th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Client Name</th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Order Date</th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Delivery Date</th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Total Qty</th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Pending Qty</th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Order Notes</th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((o) => (
                  <Fragment key={o.id}>
                    <tr className="hover:bg-[#c9a84c]/5">
                      <td className="whitespace-nowrap px-4 py-3 align-top font-medium">{o.orderNumber}</td>
                      <td className="px-4 py-3 align-top">
                        {o.source === 'retailer-custom' ? (
                          <p className="font-medium text-violet-800">Customised Order from {o.storeName ?? '—'}</p>
                        ) : (
                          <>
                            <p className="font-medium text-[#8a6d1d]">{o.storeName ?? '—'}</p>
                            {o.source === 'custom' && <span className="mt-0.5 inline-block rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-800">Customised</span>}
                          </>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 align-top text-muted-foreground">
                        {new Date(o.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 align-top text-muted-foreground">
                        {o.deliveryDate ? new Date(o.deliveryDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 align-top text-right tabular-nums">{o.totalQuantity ?? '—'}</td>
                      <td className="whitespace-nowrap px-4 py-3 align-top text-right tabular-nums">{o.pendingQuantity ?? '—'}</td>
                      <td className="max-w-[16rem] px-4 py-3 align-top">
                        <p className="truncate text-muted-foreground">{o.requirementNote || '—'}</p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 align-top text-right">
                        <div className="flex justify-end gap-2">
                          <Button type="button" size="sm" variant="outline" onClick={() => toggle(o)}>Order Summary</Button>
                          <Button type="button" size="sm" variant="outline" onClick={() => setNotesRow(o)}>Order Notes</Button>
                        </div>
                      </td>
                    </tr>
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {expanded && (() => {
        const o = filtered.find((r) => r.id === expanded);
        if (!o) return null;
        if (o.source === 'retailer-custom') {
          return (
            <OrderSummaryModal
              order={{
                orderNumber: o.orderNumber, storeName: o.storeName, orderDate: o.createdAt,
                deliveryDate: o.deliveryDate, requirementNote: o.requirementNote, items: [],
              }}
              onClose={() => { setExpanded(null); setDetail(null); }}
            >
              {o.retailerRequest && <RetailerCustomRequestDetail row={o} request={o.retailerRequest} onAssigned={() => void loadList()} />}
            </OrderSummaryModal>
          );
        }
        return (
          <CatalogOrderDetail
            row={o}
            detail={detail}
            itemBusy={itemBusy}
            busy={busy}
            onItemStatusChange={(item, next) => void setItemStatus(o, item, next)}
            onItemClick={(item) => item.product && setProductModal(item.product)}
            onItemImageClick={(item) => setZoomItem(item)}
            onAssigned={() => void loadList()}
            onAdvance={(next) => advance(o, next)}
            onClose={() => { setExpanded(null); setDetail(null); }}
          />
        );
      })()}

      {notesRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setNotesRow(null)} role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-xl border bg-card p-5 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Order Notes — {notesRow.orderNumber}</h2>
              <button type="button" onClick={() => setNotesRow(null)} className="text-muted-foreground hover:text-foreground" aria-label="Close">✕</button>
            </div>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">{notesRow.requirementNote || 'No notes for this order.'}</p>
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

// Extracted so useCatalogOrderAssignment (a hook) can be called once per
// expanded row without violating the rules of hooks inside .map(). Renders
// the merged Order Summary modal (2026-08-14) — the checkbox/status-dropdown/
// Customised-Order-No. item table now lives inside OrderSummaryModal itself,
// not a separate "ITEMS" panel underneath it.
function CatalogOrderDetail({
  row, detail, itemBusy, busy,
  onItemStatusChange, onItemClick, onItemImageClick, onAssigned, onAdvance, onClose,
}: {
  row: Row;
  detail: Detail | null;
  itemBusy: string | null;
  busy: string | null;
  onItemStatusChange: (item: Item, next: string) => void;
  onItemClick: (item: Item) => void;
  onItemImageClick: (item: Item) => void;
  onAssigned: () => void;
  onAdvance: (next: string) => void;
  onClose: () => void;
}) {
  const source = row.source === 'kiosk' ? 'kiosk' : 'b2b';
  const items = useMemo(() => (detail?.items ?? []) as CatalogOrderItem[], [detail]);
  const assignment = useCatalogOrderAssignment(row.id, source, items, row.deliveryDate);
  const assignedIds = useMemo(() => items.map((i) => i.customisedOrderId).filter((x): x is string => !!x), [items]);
  const customisedOrderNumberFor = useCustomisedOrderNumbers(assignedIds);

  return (
    <OrderSummaryModal
      order={{
        orderNumber: row.orderNumber,
        storeName: row.storeName,
        orderDate: row.createdAt,
        deliveryDate: row.deliveryDate,
        requirementNote: detail?.requirementNote ?? row.requirementNote,
        items: items.map((it) => ({
          id: it.id,
          designNumber: it.product?.designNumber ?? it.productNameSnapshot,
          imageUrl: it.productImageSnapshot,
          quantity: it.quantity,
          status: it.status,
          // Legacy pre-2026-08-17 designs only have the old single Weight
          // field (weightGrams) — Gross and Net both fall back to showing
          // it. Every design since then has separate Gross/Net values.
          grossWeightGrams: it.product?.grossWeightGrams ?? it.product?.weightGrams ?? null,
          netWeightGrams: it.product?.netWeightGrams ?? it.product?.weightGrams ?? null,
          pieces: it.product?.pieces ?? null,
          karigarCode: it.product?.karigarCode ?? null,
          customisedOrderId: it.customisedOrderId ?? null,
          customisedOrderNo: customisedOrderNumberFor(it.customisedOrderId),
          canOpenProduct: !!it.product,
        })),
      }}
      selected={assignment.selected}
      onToggleSelect={assignment.toggleItem}
      statusOptions={ALL_ITEM_STATUSES}
      itemBusy={itemBusy}
      onStatusChange={(summaryItem, next) => {
        const item = items.find((i) => i.id === summaryItem.id);
        if (item) onItemStatusChange(item as Item, next);
      }}
      onDesignClick={(summaryItem) => {
        const item = items.find((i) => i.id === summaryItem.id);
        if (item) onItemClick(item as Item);
      }}
      onImageClick={(summaryItem) => {
        const item = items.find((i) => i.id === summaryItem.id);
        if (item) onItemImageClick(item as Item);
      }}
      onAssignClick={() => assignment.setModalOpen(true)}
      assignDisabled={assignment.selected.size === 0 || assignment.assigning}
      assignBusy={assignment.assigning}
      onClose={onClose}
    >
      {!detail && <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>}
      {detail && (
        <div className="flex items-center gap-2 pb-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS[row.status] ?? ''}`}>{formatOrderLevelStatus(row.status)}</span>
        </div>
      )}
      {detail && (
        <div className="pb-3">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Ship to</p>
          <p className="text-sm">{detail.shipToStoreAddress || '—'}</p>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {row.status === 'PENDING' && (
          <Button size="sm" disabled={busy === row.id} onClick={() => onAdvance('IN_PROCESS')} className="metal-sheen text-[#17120b] font-semibold">
            {busy === row.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Mark as Approved'}
          </Button>
        )}
        {row.status !== 'COMPLETED' && row.status !== 'CANCELLED' && (
          <Button size="sm" variant="outline" disabled={busy === row.id} onClick={() => onAdvance('COMPLETED')}>
            {busy === row.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Mark as Complete'}
          </Button>
        )}
      </div>
      <CatalogOrderAssignModal assignment={assignment} onAssigned={onAssigned} />
    </OrderSummaryModal>
  );
}

// Retailer Admin bespoke request (PENDING Karigar assignment) — no linked
// items, so the Karigar dropdown shows the FULL manufacturer list (not
// filtered), per the 2026-08-10 redesign.
function RetailerCustomRequestDetail({
  row, request, onAssigned,
}: {
  row: Row;
  request: RetailerCustomRequestRow;
  onAssigned: () => void;
}) {
  // No linked items to select here (unlike CatalogOrderDetail's
  // useCatalogOrderAssignment) — a minimal picker + modal combo instead.
  const [karigarId, setKarigarId] = useState('');
  const [karigars, setKarigars] = useState<Karigar[] | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch('/api/manufacturer/karigars', { credentials: 'same-origin', cache: 'no-store' });
      const json = (await res.json()) as { data?: Karigar[] };
      if (!cancelled) setKarigars(json.data ?? []);
    })();
    return () => { cancelled = true; };
  }, []);

  async function submit(fields: AssignKarigarManualFields) {
    setAssigning(true);
    try {
      const karigar = karigars?.find((k) => k.id === karigarId) ?? null;
      const created = (await apiPost(`/api/manufacturer/retailer-custom-requests/${row.id}/assign-karigar`, {
        karigarId: karigar?.id ?? null,
        karigarCode: karigar?.code ?? null,
      })) as { id: string };
      await apiSend('PATCH', `/api/manufacturer/custom-designs/${created.id}/karigar-form`, {
        category: fields.category || undefined,
        quantity: fields.quantity || null,
        purity: fields.purity || null,
        weightGramsMin: fields.weightFrom ? Number(fields.weightFrom) : null,
        weightGramsMax: fields.weightTo ? Number(fields.weightTo) : null,
        size: fields.size || null,
        sampleWeightGrams: fields.sampleWeight ? Number(fields.sampleWeight) : null,
        totalWeightGrams: fields.totalWeight ? Number(fields.totalWeight) : null,
        deliveryDate: fields.deliveryDate || null,
        karigarDeliveryDate: fields.karigarDeliveryDate || null,
        meena: fields.meena || null, length: fields.length || null, broadness: fields.broadness || null, screw: fields.screw || null,
        karigarNotes: fields.karigarNotes || null,
        narration1: fields.narration1 || null, narration2: fields.narration2 || null, qc: fields.qc || null,
        orderType: fields.orderType || null, orderStage: fields.orderStage || null, urgent: fields.urgent,
      }); // NOT best-effort — see the matching note in CatalogOrderItemsBlock.tsx
      setModalOpen(false);
      onAssigned();
    } finally {
      setAssigning(false);
    }
  }

  return (
    <div className="border-t bg-muted/10 px-4 pb-4 pt-3 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Ship to</p>
          <p className="text-sm">{request.storeAddressSnapshot || '—'}</p>
        </div>
        {karigars !== null && (
          <KarigarPicker
            codes={karigars}
            selectedCount={karigarId ? 1 : 0}
            onPick={(k) => setKarigarId(k?.id ?? '')}
            onAssign={() => setModalOpen(true)}
            assignDisabled={assigning || !karigarId}
            assignBusy={assigning}
          />
        )}
      </div>

      {modalOpen && (
        <AssignKarigarModal
          title="Assign Karigar"
          submitLabel="Submit"
          autoFill={{
            category: '', subCategory: null, quantity: null, purity: null,
            weightGramsMin: null, weightGramsMax: null, size: null, sampleWeightGrams: null,
            // "Order Received Date" = the day the Karigar is being assigned
            // (today), not the bespoke request's own placement date.
            deliveryDate: null, karigarDeliveryDate: null, orderReceivedDate: new Date().toISOString(),
          }}
          karigarLabel={karigars?.find((k) => k.id === karigarId)?.code ?? null}
          onSubmit={submit}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}
