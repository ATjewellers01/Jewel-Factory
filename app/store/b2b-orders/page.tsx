'use client';

import { Loader2, Package, Plus, ChevronDown, ChevronUp } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { CustomSpecList } from '@/components/orders/CustomSpecList';
import { ImageZoomModal } from '@/components/orders/ImageZoomModal';
import { OrderFilters } from '@/components/orders/OrderFilters';
import { OrderItemDetailModal, type OrderItemProductSafe } from '@/components/orders/OrderItemDetailModal';
import { Button } from '@/components/ui/button';
import { formatOrderLevelStatus } from '@/lib/format';
import { KIOSK_B2B_STATUS_OPTIONS, matchOrder, uniqueBranchOptions } from '@/lib/order-filters';

/**
 * Order History merges the retailer's three incoming order sources — restock
 * (B2B), kiosk, and customised orders — into one list, mirroring the
 * manufacturer's merged view. All three are just orders from this retailer's
 * own stores/requests, so splitting them across separate pages made the
 * retailer check multiple places for the same job.
 *
 * `source` is tracked only to route the detail fields and keep React keys
 * unique across the three id spaces; it is never rendered as a badge.
 *
 * Customised orders have no line items — they're a single design spec, not a
 * product list — so a Row with source 'custom' carries `spec`/`images`
 * instead of `items`, and the row's expanded view falls back to CustomSpecList
 * + an image gallery rather than the item list used by b2b/kiosk rows.
 */
type Source = 'b2b' | 'kiosk' | 'custom';

// The two catalog order types snapshot slightly different columns: B2B items
// carry `productDesignSnapshot`, kiosk items carry `categorySnapshot` instead.
// Both are optional here, and the hydrated `product` join (which supplies the
// design number for either type) is what the row actually renders from.
type Item = {
  id: string; productNameSnapshot: string | null; productImageSnapshot: string | null;
  productDesignSnapshot?: string | null; categorySnapshot?: string | null; quantity: number;
  status: string;
  purity: string | null;
  product: OrderItemProductSafe | null;
};

type B2bOrder = {
  id: string; orderNumber: string; status: string; totalItems: number;
  branchNameSnapshot: string | null;
  pendingManagerApproval: boolean; trackingNumber: string | null; createdAt: string; items: Item[];
};
type KioskOrder = {
  id: string; orderNumber: string; status: string; totalItems: number;
  branchNameSnapshot: string | null;
  pendingStoreApproval: boolean; pickupStore: boolean; createdAt: string; items: Item[];
};
type CustomRequest = {
  id: string; category: string; subCategory: string | null; createdAt: string;
  weightGramsMin: string | null; weightGramsMax: string | null; purity: string | null; designNotes: string | null;
  orderRef: string | null; deliveryDate: string | null; quantity: string | null;
  meena: string | null; length: string | null; size: string | null;
  broadness: string | null; screw: string | null; sampleWeightGrams: string | null;
  referenceImageUrl: string | null; referenceImageUrls: string[];
  status: string; order: { orderNumber: string; status: string } | null;
  branch: { name: string } | null;
};

type Row = {
  key: string; id: string; source: Source; orderNumber: string; status: string; totalItems: number;
  branchNameSnapshot: string | null; needsApproval: boolean; meta: string;
  createdAt: string; items?: Item[];
  custom?: CustomRequest;
};

const STATUS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800', IN_PROCESS: 'bg-blue-100 text-blue-800',
  GHAT_RECEIVED: 'bg-purple-100 text-purple-800', READY_FOR_DELIVERY: 'bg-indigo-100 text-indigo-800',
  DISPATCHED: 'bg-amber-100 text-amber-800', COMPLETED: 'bg-green-100 text-green-800', CANCELLED: 'bg-red-100 text-red-700',
};

function formatWeightRange(min: string | null, max: string | null): string {
  if (!min && !max) return '';
  const lo = min ? parseFloat(min) : null;
  const hi = max ? parseFloat(max) : null;
  if (lo != null && hi != null && lo !== hi) return `${lo}g – ${hi}g`;
  return `${lo ?? hi}g`;
}

export default function StoreCatalogueOrdersPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [branch, setBranch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [zoomItem, setZoomItem] = useState<Item | null>(null);
  const [zoomCustomImages, setZoomCustomImages] = useState<string[] | null>(null);
  const [productModal, setProductModal] = useState<OrderItemProductSafe | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [b2bRes, kioskRes, customRes] = await Promise.all([
          fetch('/api/store/b2b-orders', { cache: 'no-store', credentials: 'same-origin' }),
          fetch('/api/store/kiosk-orders', { cache: 'no-store', credentials: 'same-origin' }),
          fetch('/api/store/custom-designs', { cache: 'no-store', credentials: 'same-origin' }),
        ]);
        if (b2bRes.status === 401 || kioskRes.status === 401 || customRes.status === 401) { window.location.assign('/store/login'); return; }
        const b2bJson = (await b2bRes.json()) as { data?: B2bOrder[]; error?: { message: string } };
        const kioskJson = (await kioskRes.json()) as { data?: KioskOrder[]; error?: { message: string } };
        const customJson = (await customRes.json()) as { data?: CustomRequest[]; error?: { message: string } };
        if (cancelled) return;
        if (!b2bRes.ok || b2bJson.error || !kioskRes.ok || kioskJson.error || !customRes.ok || customJson.error) {
          setError(b2bJson.error?.message ?? kioskJson.error?.message ?? customJson.error?.message ?? 'Failed to load');
          return;
        }

        const b2bRows: Row[] = (b2bJson.data ?? []).map((o) => ({
          key: `b2b-${o.id}`, id: o.id, source: 'b2b',
          orderNumber: o.orderNumber, status: o.status, totalItems: o.totalItems,
          branchNameSnapshot: o.branchNameSnapshot, needsApproval: o.pendingManagerApproval,
          meta: `${o.totalItems} item(s)${o.trackingNumber ? ` · Tracking: ${o.trackingNumber}` : ''}`,
          createdAt: o.createdAt, items: o.items,
        }));
        const kioskRows: Row[] = (kioskJson.data ?? []).map((o) => ({
          key: `kiosk-${o.id}`, id: o.id, source: 'kiosk',
          orderNumber: o.orderNumber, status: o.status, totalItems: o.totalItems,
          branchNameSnapshot: o.branchNameSnapshot, needsApproval: o.pendingStoreApproval,
          // No customer name/phone here — kiosk orders carry no PII by design.
          meta: `${o.totalItems} item(s) · ${o.pickupStore ? 'Pickup' : 'Delivery'}`,
          createdAt: o.createdAt, items: o.items,
        }));
        // Customised orders auto-forward on placement (no approval step), so
        // every request here already has an order number + the manufacturer's
        // real OrderStatus — mirrors b2b/kiosk's "no needsApproval" resting state.
        const customRows: Row[] = (customJson.data ?? []).map((r) => ({
          key: `custom-${r.id}`, id: r.id, source: 'custom',
          orderNumber: r.order?.orderNumber ?? '—', status: r.order?.status ?? 'PENDING', totalItems: 0,
          branchNameSnapshot: r.branch?.name ?? null, needsApproval: false,
          meta: `${r.category}${r.subCategory ? ` › ${r.subCategory}` : ''}${formatWeightRange(r.weightGramsMin, r.weightGramsMax) ? ` · ${formatWeightRange(r.weightGramsMin, r.weightGramsMax)}` : ''}`,
          createdAt: r.createdAt, custom: r,
        }));

        setRows([...b2bRows, ...kioskRows, ...customRows].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
        setError(null);
      } catch {
        if (!cancelled) setError('Network error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const branchOptions = useMemo(() => uniqueBranchOptions((rows ?? []).map((o) => o.branchNameSnapshot)), [rows]);
  const filtered = useMemo(
    () => (rows ?? []).filter((o) => matchOrder(o, { search, status, branch, branchName: o.branchNameSnapshot, from, to })),
    [rows, search, status, branch, from, to],
  );

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-medium tracking-tight">Order History</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Restock, kiosk, and customised orders from across your stores.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/store/custom-designs/new"><Button variant="outline" className="font-semibold"><Plus className="mr-1.5 h-4 w-4" />Customised Order</Button></Link>
          <Link href="/store/manufacturer-catalog"><Button className="metal-sheen text-[#17120b] font-semibold"><Plus className="mr-1.5 h-4 w-4" />New Order</Button></Link>
        </div>
      </div>

      {rows && rows.length > 0 && (
        <OrderFilters
          search={search} onSearch={setSearch}
          status={status} onStatus={setStatus} statusOptions={KIOSK_B2B_STATUS_OPTIONS}
          group={branch} onGroup={setBranch} groupOptions={branchOptions} groupAllLabel="All stores" groupLabel="Store"
          from={from} to={to} onFrom={setFrom} onTo={setTo}
        />
      )}
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {loading && <div className="flex items-center gap-2 py-12 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>}
      {rows && rows.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
          <Package className="h-10 w-10 text-muted-foreground/40" /><p className="text-sm text-muted-foreground">No orders yet.</p>
        </div>
      )}
      {rows && rows.length > 0 && filtered.length === 0 && (
        <p className="py-12 text-center text-sm text-muted-foreground">No orders match your filters.</p>
      )}
      {filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map((o) => (
            <div key={o.key} className="rounded-xl border bg-card overflow-hidden">
              <button type="button" onClick={() => setOpen(open === o.key ? null : o.key)} className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/30">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{o.orderNumber}{o.branchNameSnapshot ? <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">{o.branchNameSnapshot}</span> : null}</p>
                  <p className="text-xs text-muted-foreground">{o.meta}</p>
                </div>
                <div className="flex items-center gap-2">
                  {o.needsApproval && <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] font-semibold text-yellow-800">Needs approval</span>}
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS[o.status] ?? ''}`}>{formatOrderLevelStatus(o.status)}</span>
                  {open === o.key ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </div>
              </button>
              {open === o.key && o.source === 'custom' && o.custom && (
                <div className="border-t bg-muted/10 px-4 pb-4 pt-3 space-y-3">
                  <CustomSpecList spec={o.custom} />
                  {o.custom.designNotes && <div><p className="text-xs text-muted-foreground uppercase tracking-wider">Remarks</p><p className="text-sm">{o.custom.designNotes}</p></div>}
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
                </div>
              )}
              {open === o.key && o.source !== 'custom' && (
                <div className="border-t bg-muted/10 px-4 pb-4 pt-3">
                  <p className="mb-1.5 text-xs uppercase tracking-wider text-muted-foreground">Items</p>
                  <div className="space-y-2">
                    {(o.items ?? []).map((it) => (
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
                            alt={it.productNameSnapshot ?? ''}
                            className="h-20 w-20 flex-shrink-0 rounded-lg border bg-white object-contain p-1 cursor-pointer hover:shadow-md transition-shadow"
                            onClick={(e) => { e.stopPropagation(); setZoomItem(it); }}
                          />
                        ) : <div className="h-20 w-20 flex-shrink-0 rounded-lg border bg-muted" />}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{it.product?.designNumber ?? it.productDesignSnapshot ?? it.productNameSnapshot ?? 'Product'}</p>
                          <p className="text-xs text-muted-foreground">
                            {it.product?.category ?? '—'}
                            {it.product?.subCategory ? ` › ${it.product.subCategory}` : ''}
                            {it.product?.weightGrams != null ? ` · ${it.product.weightGrams}g` : ''}
                            {it.purity ? ` · ${it.purity}` : ''}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <span className="text-sm tabular-nums text-muted-foreground">× {it.quantity}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {zoomItem?.productImageSnapshot && (
        <ImageZoomModal
          isOpen={!!zoomItem}
          images={[zoomItem.productImageSnapshot]}
          productName={zoomItem.productNameSnapshot ?? undefined}
          designNumber={zoomItem.productDesignSnapshot ?? undefined}
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

      {productModal && <OrderItemDetailModal product={productModal} onClose={() => setProductModal(null)} />}
    </div>
  );
}
