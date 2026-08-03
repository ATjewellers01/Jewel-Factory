'use client';

import { Loader2, Package, Plus, ChevronDown, ChevronUp } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { ImageZoomModal } from '@/components/orders/ImageZoomModal';
import { OrderFilters } from '@/components/orders/OrderFilters';
import { OrderItemDetailModal, type OrderItemProductSafe } from '@/components/orders/OrderItemDetailModal';
import { Button } from '@/components/ui/button';
import { formatOrderStatus } from '@/lib/format';
import { KIOSK_B2B_STATUS_OPTIONS, matchOrder, uniqueBranchOptions } from '@/lib/order-filters';

/**
 * Catalogue Orders merges the retailer's two incoming order sources — restock
 * (B2B) orders and kiosk orders raised by a store — into one list, mirroring
 * the manufacturer's merged view. Both are just orders from this retailer's
 * own stores, so splitting them across two pages made the retailer check two
 * places for the same job.
 *
 * `source` is tracked only to route the detail fields and keep React keys
 * unique across the two id spaces; it is never rendered as a badge.
 */
type Source = 'b2b' | 'kiosk';

// The two order types snapshot slightly different columns: B2B items carry
// `productDesignSnapshot`, kiosk items carry `categorySnapshot` instead. Both
// are optional here, and the hydrated `product` join (which supplies the design
// number for either type) is what the row actually renders from.
type Item = {
  id: string; productNameSnapshot: string | null; productImageSnapshot: string | null;
  productDesignSnapshot?: string | null; categorySnapshot?: string | null; quantity: number;
  status: string;
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
  salesCode: string | null; salesPersonName: string | null;
};

type Row = {
  key: string; id: string; source: Source; orderNumber: string; status: string; totalItems: number;
  branchNameSnapshot: string | null; needsApproval: boolean; meta: string;
  createdAt: string; items: Item[];
  salesCode?: string | null; salesPersonName?: string | null;
};

const STATUS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800', IN_PROCESS: 'bg-blue-100 text-blue-800',
  GHAT_RECEIVED: 'bg-purple-100 text-purple-800', READY_FOR_DELIVERY: 'bg-indigo-100 text-indigo-800',
  DISPATCHED: 'bg-amber-100 text-amber-800', COMPLETED: 'bg-green-100 text-green-800', CANCELLED: 'bg-red-100 text-red-700',
};

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
  const [productModal, setProductModal] = useState<OrderItemProductSafe | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [b2bRes, kioskRes] = await Promise.all([
          fetch('/api/store/b2b-orders', { cache: 'no-store', credentials: 'same-origin' }),
          fetch('/api/store/kiosk-orders', { cache: 'no-store', credentials: 'same-origin' }),
        ]);
        if (b2bRes.status === 401 || kioskRes.status === 401) { window.location.assign('/store/login'); return; }
        const b2bJson = (await b2bRes.json()) as { data?: B2bOrder[]; error?: { message: string } };
        const kioskJson = (await kioskRes.json()) as { data?: KioskOrder[]; error?: { message: string } };
        if (cancelled) return;
        if (!b2bRes.ok || b2bJson.error || !kioskRes.ok || kioskJson.error) {
          setError(b2bJson.error?.message ?? kioskJson.error?.message ?? 'Failed to load');
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
          salesCode: o.salesCode, salesPersonName: o.salesPersonName,
        }));

        setRows([...b2bRows, ...kioskRows].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
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
          <h1 className="text-2xl font-medium tracking-tight">Catalogue Orders</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Restock and kiosk orders from across your stores.</p>
        </div>
        <Link href="/store/manufacturer-catalog"><Button className="metal-sheen text-[#17120b] font-semibold"><Plus className="mr-1.5 h-4 w-4" />New Order</Button></Link>
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
          <Package className="h-10 w-10 text-muted-foreground/40" /><p className="text-sm text-muted-foreground">No Catalogue orders yet.</p>
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
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS[o.status] ?? ''}`}>{formatOrderStatus(o.status)}</span>
                  {open === o.key ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </div>
              </button>
              {open === o.key && (
                <div className="border-t bg-muted/10 px-4 pb-4 pt-3">
                  {(o.salesCode || o.salesPersonName) && (
                    <div className="mb-3 flex flex-wrap gap-4 rounded-lg border bg-card px-3 py-2 text-xs">
                      {o.salesPersonName && <span><span className="text-muted-foreground">Sales person: </span><span className="font-medium">{o.salesPersonName}</span></span>}
                      {o.salesCode && <span><span className="text-muted-foreground">Sales code: </span><span className="font-medium">{o.salesCode}</span></span>}
                    </div>
                  )}
                  <p className="mb-1.5 text-xs uppercase tracking-wider text-muted-foreground">Items</p>
                  <div className="space-y-2">
                    {o.items.map((it) => (
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
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <span className="text-sm tabular-nums text-muted-foreground">× {it.quantity}</span>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS[it.status] ?? ''}`}>{formatOrderStatus(it.status)}</span>
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

      {productModal && <OrderItemDetailModal product={productModal} onClose={() => setProductModal(null)} />}
    </div>
  );
}
