'use client';

import { ChevronDown, ChevronUp, Loader2, ShoppingBag } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { AssignKarigarModal, type AssignKarigarManualFields } from '@/components/orders/AssignKarigarModal';
import { CatalogOrderItemsBlock, CatalogOrderKarigarPicker, useCatalogOrderAssignment, type CatalogOrderItem } from '@/components/orders/CatalogOrderItemsBlock';
import { CustomSpecList } from '@/components/orders/CustomSpecList';
import { ImageZoomModal } from '@/components/orders/ImageZoomModal';
import { KarigarPicker, type Karigar } from '@/components/orders/KarigarAssignPanel';
import { KarigarOrderForm } from '@/components/orders/KarigarOrderForm';
import { ManufacturerOrderItemModal, type OrderItemProduct } from '@/components/orders/ManufacturerOrderItemModal';
import { OrderFilters } from '@/components/orders/OrderFilters';
import { Button } from '@/components/ui/button';
import { apiPost, apiSend } from '@/hooks/use-api';
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

type B2bOrder = { id: string; orderNumber: string; status: string; totalItems: number; createdAt: string; deliveryDate: string | null; storeName: string | null; karigarCodes?: string[] };
type KioskOrder = {
  id: string; orderNumber: string; status: string; totalItems: number; createdAt: string; deliveryDate: string | null;
  storeNameSnapshot: string; requirementNote: string | null;
  shipToStoreAddress: string; karigarCodes?: string[];
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
const ALL_ITEM_STATUSES = ['PENDING', 'IN_PROCESS', 'GHAT_RECEIVED', 'READY_FOR_DELIVERY', 'DISPATCHED', 'COMPLETED', 'CANCELLED'];

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
  const [customItems, setCustomItems] = useState<Item[] | null>(null);
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
      const [b2bRes, kioskRes, customRes, retailerReqRes] = await Promise.all([
        fetch('/api/manufacturer/orders', { cache: 'no-store', credentials: 'same-origin' }),
        fetch('/api/manufacturer/kiosk-orders', { cache: 'no-store', credentials: 'same-origin' }),
        fetch('/api/manufacturer/custom-designs', { cache: 'no-store', credentials: 'same-origin' }),
        fetch('/api/manufacturer/retailer-custom-requests', { cache: 'no-store', credentials: 'same-origin' }),
      ]);
      if (b2bRes.status === 401 || kioskRes.status === 401 || customRes.status === 401 || retailerReqRes.status === 401) { window.location.assign('/manufacturer/login'); return; }
      const b2bJson = (await b2bRes.json()) as { data?: B2bOrder[]; error?: { message: string } };
      const kioskJson = (await kioskRes.json()) as { data?: KioskOrder[]; error?: { message: string } };
      const customJson = (await customRes.json()) as { data?: CustomOrder[]; error?: { message: string } };
      const retailerReqJson = (await retailerReqRes.json()) as { data?: RetailerCustomRequestRow[]; error?: { message: string } };
      if (!b2bRes.ok || b2bJson.error || !kioskRes.ok || kioskJson.error || !customRes.ok || customJson.error || !retailerReqRes.ok || retailerReqJson.error) {
        setError(b2bJson.error?.message ?? kioskJson.error?.message ?? customJson.error?.message ?? retailerReqJson.error?.message ?? 'Failed to load');
        return;
      }
      const b2bRows: Row[] = (b2bJson.data ?? []).map((o) => ({
        id: o.id, source: 'b2b', orderNumber: o.orderNumber, status: o.status, totalItems: o.totalItems,
        createdAt: o.createdAt, deliveryDate: o.deliveryDate, storeName: o.storeName, karigarCodes: o.karigarCodes ?? [],
      }));
      const kioskRows: Row[] = (kioskJson.data ?? []).map((o) => ({
        id: o.id, source: 'kiosk', orderNumber: o.orderNumber, status: o.status, totalItems: o.totalItems,
        createdAt: o.createdAt, deliveryDate: o.deliveryDate, storeName: o.storeNameSnapshot, karigarCodes: o.karigarCodes ?? [],
      }));
      // Resolve each Customised Order's "Reference Order No." (the source
      // Catalog/Kiosk order's JFA-####) client-side from the already-loaded
      // b2b/kiosk lists — avoids a second round-trip.
      const orderNumberById = new Map<string, string>();
      for (const o of b2bJson.data ?? []) orderNumberById.set(o.id, o.orderNumber);
      for (const o of kioskJson.data ?? []) orderNumberById.set(o.id, o.orderNumber);
      const customRows: Row[] = (customJson.data ?? []).map((o) => {
        const referenceOrderNumber = (o.sourceB2bOrderId && orderNumberById.get(o.sourceB2bOrderId))
          || (o.sourceKioskOrderId && orderNumberById.get(o.sourceKioskOrderId))
          || null;
        return {
          id: o.id, source: 'custom', orderNumber: o.orderNumber, status: o.status, totalItems: 0,
          createdAt: o.createdAt, deliveryDate: o.deliveryDate, storeName: o.storeNameSnapshot,
          karigarCodes: o.karigarCode ? [o.karigarCode] : [], custom: { ...o, referenceOrderNumber },
        };
      });
      // Only PENDING retailer-custom requests belong in this list — once
      // assigned (status ASSIGNED, orderId set), the resulting CustomDesignOrder
      // already surfaces via customRows above on the next load.
      const retailerReqRows: Row[] = (retailerReqJson.data ?? [])
        .filter((r) => r.status === 'PENDING')
        .map((r) => ({
          id: r.id, source: 'retailer-custom', orderNumber: r.orderNumber, status: 'PENDING', totalItems: 0,
          createdAt: r.createdAt, deliveryDate: null, storeName: r.storeNameSnapshot, karigarCodes: [],
          retailerRequest: r,
        }));
      setRows([...b2bRows, ...kioskRows, ...customRows, ...retailerReqRows].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
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
  // customised-order id -> JFC-#### order number, used to label an assigned
  // item and to hand KarigarOrderForm its up-to-date row after a save.
  const customOrderById = useMemo(() => {
    const map = new Map<string, CustomOrder>();
    for (const o of rows ?? []) if (o.source === 'custom' && o.custom) map.set(o.id, o.custom);
    return map;
  }, [rows]);
  const filtered = useMemo(
    () => (rows ?? []).filter((o) =>
      matchOrder(o, { search, status, branch: retailer, branchName: o.storeName, from, to }) &&
      (!sourceFilter || o.source === sourceFilter) &&
      (!karigarFilter || o.karigarCodes.includes(karigarFilter)),
    ),
    [rows, search, status, retailer, sourceFilter, from, to, karigarFilter],
  );

  async function toggle(row: Row) {
    if (expanded === row.id) { setExpanded(null); setDetail(null); setCustomItems(null); return; }
    setExpanded(row.id); setDetail(null); setCustomItems(null);
    // Retailer-custom requests have no separate detail endpoint needed here
    // — the list response already carries the full spec.
    if (row.source === 'retailer-custom') return;
    if (row.source === 'custom') {
      const res = await fetch(`/api/manufacturer/custom-designs/${row.id}/items`, { cache: 'no-store', credentials: 'same-origin' });
      const json = (await res.json()) as { data?: Array<Record<string, unknown>> };
      setCustomItems((json.data ?? []).map((i) => ({
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
      return;
    }
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

  function customisedOrderNumberFor(customisedOrderId: string | null | undefined): string | null {
    if (!customisedOrderId) return null;
    return customOrderById.get(customisedOrderId)?.orderNumber ?? null;
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

  // For an item shown on a Customised Order card — status still belongs to
  // its ORIGINAL b2b/kiosk order, so route the PATCH there (sourceKind/
  // sourceOrderId come from getCustomOrderItemsForManufacturer).
  async function setCustomItemStatus(item: Item, next: string) {
    if (next === item.status || !item.sourceKind || !item.sourceOrderId) return;
    setItemBusy(item.id);
    try {
      await apiSend('PATCH', `${endpointFor(item.sourceKind, item.sourceOrderId)}/items/${item.id}`, { status: next });
      setCustomItems((prev) => prev ? prev.map((it) => it.id === item.id ? { ...it, status: next } : it) : prev);
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
                    {o.source === 'retailer-custom' ? (
                      <p className="text-sm font-medium text-violet-800 truncate">Customised Order from {o.storeName ?? '—'}</p>
                    ) : (
                      <>
                        <p className="text-sm font-medium text-primary truncate">{o.storeName ?? '—'}</p>
                        {o.source === 'custom' && <span className="mt-0.5 inline-block rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-800">Customised</span>}
                      </>
                    )}
                  </div>
                  <div><p className="text-xs text-muted-foreground sm:hidden">Items</p><p className="text-sm tabular-nums">{o.source === 'custom' || o.source === 'retailer-custom' ? '—' : o.totalItems}</p></div>
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
              {expanded === o.id && o.source === 'custom' && o.custom && (
                <div className="border-t bg-muted/10 px-4 pb-4 pt-3 space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Ship to</p>
                      <p className="text-sm">{o.custom.storeAddressSnapshot || '—'}</p>
                    </div>
                    {o.custom.referenceOrderNumber && (
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Reference Order No.</p>
                        <p className="text-sm">{o.custom.referenceOrderNumber}</p>
                      </div>
                    )}
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
                  {customItems === null && <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>}
                  {customItems && customItems.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5">Items</p>
                      <div className="hidden grid-cols-[5rem_1fr_3rem_7rem] items-center gap-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground sm:grid">
                        <span>Image</span><span>Design No.</span><span>Qty</span><span>Status</span>
                      </div>
                      <div className="space-y-2">
                        {customItems.map((it) => (
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
                              <select
                                value={it.status}
                                disabled={itemBusy === it.id}
                                onChange={(e) => { e.stopPropagation(); void setCustomItemStatus(it, e.target.value); }}
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
                  <KarigarOrderForm
                    order={{
                      id: o.custom.id,
                      orderNumber: o.custom.orderNumber,
                      referenceOrderNumber: o.custom.referenceOrderNumber ?? null,
                      karigarId: o.custom.karigarId ?? null,
                      storeName: o.custom.storeNameSnapshot,
                      storeAddress: o.custom.storeAddressSnapshot,
                      category: o.custom.category,
                      subCategory: o.custom.subCategory,
                      weightGramsMin: o.custom.weightGramsMin,
                      weightGramsMax: o.custom.weightGramsMax,
                      purity: o.custom.purity,
                      quantity: o.custom.quantity,
                      deliveryDate: o.custom.deliveryDate,
                      karigarDeliveryDate: o.custom.karigarDeliveryDate ?? null,
                      meena: o.custom.meena,
                      length: o.custom.length,
                      size: o.custom.size,
                      broadness: o.custom.broadness,
                      screw: o.custom.screw,
                      sampleWeightGrams: o.custom.sampleWeightGrams,
                      totalWeightGrams: o.custom.totalWeightGrams ?? null,
                      karigarNotes: o.custom.karigarNotes ?? null,
                      narration1: o.custom.narration1 ?? null,
                      narration2: o.custom.narration2 ?? null,
                      qc: o.custom.qc ?? null,
                      orderType: o.custom.orderType ?? null,
                      orderStage: o.custom.orderStage ?? null,
                      urgent: o.custom.urgent ?? false,
                      karigarCode: o.custom.karigar?.code ?? o.custom.karigarCode,
                      designNotes: o.custom.designNotes,
                      imageUrl: o.custom.referenceImageUrls[0] ?? o.custom.referenceImageUrl,
                      createdAt: o.custom.createdAt,
                    }}
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
              {expanded === o.id && o.source !== 'custom' && o.source !== 'retailer-custom' && (
                <CatalogOrderDetail
                  row={o}
                  detail={detail}
                  itemBusy={itemBusy}
                  busy={busy}
                  customisedOrderNumberFor={customisedOrderNumberFor}
                  onItemStatusChange={(item, next) => void setItemStatus(o, item, next)}
                  onItemClick={(item) => item.product && setProductModal(item.product)}
                  onItemImageClick={(item) => setZoomItem(item)}
                  onAssigned={() => void loadList()}
                  onAdvance={(next) => advance(o, next)}
                />
              )}
              {expanded === o.id && o.source === 'retailer-custom' && o.retailerRequest && (
                <RetailerCustomRequestDetail row={o} request={o.retailerRequest} onAssigned={() => void loadList()} />
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

// Extracted so useCatalogOrderAssignment (a hook) can be called once per
// expanded row without violating the rules of hooks inside .map().
function CatalogOrderDetail({
  row, detail, itemBusy, busy, customisedOrderNumberFor,
  onItemStatusChange, onItemClick, onItemImageClick, onAssigned, onAdvance,
}: {
  row: Row;
  detail: Detail | null;
  itemBusy: string | null;
  busy: string | null;
  customisedOrderNumberFor: (id: string | null | undefined) => string | null;
  onItemStatusChange: (item: Item, next: string) => void;
  onItemClick: (item: Item) => void;
  onItemImageClick: (item: Item) => void;
  onAssigned: () => void;
  onAdvance: (next: string) => void;
}) {
  const source = row.source === 'kiosk' ? 'kiosk' : 'b2b';
  const assignment = useCatalogOrderAssignment(row.id, source, (detail?.items ?? []) as CatalogOrderItem[]);

  return (
    <div className="border-t bg-muted/10 px-4 pb-4 pt-3 space-y-3">
      {!detail && <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>}
      {detail?.requirementNote && (
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Remark</p>
          <p className="whitespace-pre-wrap text-sm">{detail.requirementNote}</p>
        </div>
      )}
      {detail && (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Ship to</p>
            <p className="text-sm">{detail.shipToStoreAddress || '—'}</p>
          </div>
          <CatalogOrderKarigarPicker assignment={assignment} />
        </div>
      )}
      {detail?.items && (
        <CatalogOrderItemsBlock
          assignment={assignment}
          items={detail.items as CatalogOrderItem[]}
          customisedOrderNumberFor={customisedOrderNumberFor}
          itemBusy={itemBusy}
          onItemStatusChange={(item, next) => onItemStatusChange(item as Item, next)}
          onItemClick={(item) => onItemClick(item as Item)}
          onItemImageClick={(item) => onItemImageClick(item as Item)}
          onAssigned={onAssigned}
        />
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
    </div>
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
      await apiPost(`/api/manufacturer/custom-designs/${created.id}/karigar-form`, {
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
      }).catch(() => {});
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
            deliveryDate: null, karigarDeliveryDate: null, orderReceivedDate: request.createdAt,
          }}
          onSubmit={submit}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}
