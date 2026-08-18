'use client';

import { Loader2, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { formatOrderStatus } from '@/lib/format';
import { downloadOrderSummaryImages, downloadOrderSummaryLargeImagePdf, downloadOrderSummaryPdf } from '@/lib/order-summary-pdf';

export type OrderSummaryItem = {
  id: string;
  designNumber: string;
  imageUrl: string | null;
  quantity: number;
  status: string; // "Order Stage"
  // Legacy pre-2026-08-17 designs have only the old single Weight field, so
  // both Gross and Net show that same value here (see the caller's
  // fallback). Every design since then collects Gross/Net Weight as two
  // separate manual fields, so they can differ.
  grossWeightGrams: string | number | null;
  netWeightGrams: string | number | null;
  pieces: number | null;
  karigarCode: string | null; // null/empty -> shown as "0"
  // Set once a Karigar has been assigned to this item — the JFC-#### number
  // of the resulting Customised Order. Unassigned items can still be
  // selected (checkbox) for a new assignment; assigned ones show this
  // instead of a checkbox.
  customisedOrderId: string | null;
  customisedOrderNo: string | null;
  // True once this item's Customised Order has been sent to O2D -- status
  // then updates automatically (see lib/db/o2d-sync.ts's check-on-view
  // sync), so the dropdown below is hidden in favor of read-only text.
  o2dLinked?: boolean;
  canOpenProduct: boolean; // whether Design Code is clickable (has a linked product)
};

export type OrderSummaryData = {
  orderNumber: string;
  storeName: string | null;
  orderDate: string;
  deliveryDate: string | null;
  requirementNote: string | null;
  items: OrderSummaryItem[];
};

function fmtDate(value: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function num(value: string | number | null): number {
  if (value == null || value === '') return 0;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function OrderSummaryModal({
  order, onClose, children,
  selected, onToggleSelect,
  statusOptions, itemBusy, onStatusChange,
  onDesignClick, onImageClick,
  onAssignClick, assignDisabled, assignBusy,
}: {
  order: OrderSummaryData;
  onClose: () => void;
  children?: ReactNode;
  // Karigar-assignment checkbox selection — omit these props entirely
  // (e.g. for a source with no assignment flow) to hide the checkbox column.
  selected?: Set<string>;
  onToggleSelect?: (itemId: string) => void;
  // Order Stage as an editable dropdown — omit to render it as plain text.
  statusOptions?: string[];
  itemBusy?: string | null;
  onStatusChange?: (item: OrderSummaryItem, next: string) => void;
  onDesignClick?: (item: OrderSummaryItem) => void;
  onImageClick?: (item: OrderSummaryItem) => void;
  // "Assign items" button, top-right of the header (2026-08-14) — omit to
  // hide it entirely (e.g. a source with no assignment flow). Disabled until
  // at least one item is checked off.
  onAssignClick?: () => void;
  assignDisabled?: boolean;
  assignBusy?: boolean;
}) {
  const [busy, setBusy] = useState<'image' | 'large-image' | 'excel' | 'pdf' | null>(null);
  const remarks = order.requirementNote?.trim() || 'No remarks';

  // "Total" = how many design-code rows this order has, not a quantity sum —
  // matches the list page's Total/Pending Qty, which now also counts rows.
  const totalRows = order.items.length;
  const totalGross = order.items.reduce((sum, it) => sum + num(it.grossWeightGrams), 0);
  const totalNet = order.items.reduce((sum, it) => sum + num(it.netWeightGrams), 0);

  function downloadExcel() {
    const header = ['#', 'Design Code', 'Tag Number', 'Customised Order No.', 'Order Stage', 'Quantity', 'Gross Wt.', 'Net Wt.', 'Pcs.', 'Remarks', 'Karigar'];
    const rows = order.items.map((it, i) => [
      String(i + 1), it.designNumber, '', it.customisedOrderNo || '', formatOrderStatus(it.status), String(it.quantity),
      it.grossWeightGrams != null ? String(it.grossWeightGrams) : '', it.netWeightGrams != null ? String(it.netWeightGrams) : '',
      String(it.pieces ?? ''), remarks, it.karigarCode || '0',
    ]);
    rows.push(['Total', '', '', '', '', String(totalRows), totalGross.toFixed(2), totalNet.toFixed(2), '', '', '']);
    const csv = [header, ...rows]
      .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\r\n');
    const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${order.orderNumber}-order-summary.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function run(kind: 'image' | 'large-image' | 'pdf', fn: () => Promise<void>) {
    setBusy(kind);
    try { await fn(); } finally { setBusy(null); }
  }

  return (
    <div className="fixed inset-0 z-50 flex min-h-full items-start justify-center overflow-y-auto bg-black/50 p-4 py-8" onClick={onClose} role="dialog" aria-modal="true">
      <div className="relative w-full max-w-4xl rounded-2xl bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={onClose} aria-label="Close" className="absolute right-3 top-3 z-20 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80"><X className="h-4 w-4" /></button>

        <div className="max-h-[85vh] overflow-y-auto p-6">
          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-4 border-b pb-4">
            <div>
              <p className="text-sm"><span className="text-muted-foreground">Name : </span><span className="font-semibold">{order.storeName ?? '—'}</span></p>
              <p className="text-sm"><span className="text-muted-foreground">Order Date : </span><span className="font-semibold">{fmtDate(order.orderDate)}</span></p>
              <p className="text-sm"><span className="text-muted-foreground">Delivery date : </span><span className="font-semibold">{fmtDate(order.deliveryDate)}</span></p>
              <p className="text-sm"><span className="text-muted-foreground">Order ID : </span><span className="font-semibold">{order.orderNumber}</span></p>
            </div>
            <div className="pr-8 text-right">
              {onAssignClick && (
                <Button
                  type="button" size="sm" disabled={assignDisabled}
                  onClick={onAssignClick}
                  className="mb-2 metal-sheen text-[#17120b] font-semibold"
                >
                  {assignBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Assign items'}
                </Button>
              )}
              <p className="font-display text-lg font-semibold">
                <span className="text-[#17120b]">JEWEL</span><span className="text-[#c9a84c]"> FACTORY</span>
              </p>
              <p className="text-xs text-muted-foreground">Order Summary</p>
            </div>
          </div>

          {/* Table */}
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-225 border-collapse text-sm">
              <thead>
                <tr className="border-b bg-[#17120b]/[0.03] text-left">
                  {selected && <th className="w-8 px-2 py-2" />}
                  <th className="px-2 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">#</th>
                  <th className="px-2 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Design Code</th>
                  <th className="px-2 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Tag Number</th>
                  <th className="px-2 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Customised Order No.</th>
                  <th className="px-2 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Order Stage</th>
                  <th className="px-2 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Quantity</th>
                  <th className="px-2 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Gross Wt.</th>
                  <th className="px-2 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Net Wt.</th>
                  <th className="px-2 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Pcs.</th>
                  <th className="px-2 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Remarks</th>
                  <th className="px-2 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Karigar</th>
                  <th className="px-2 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Image</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {order.items.map((it, i) => (
                  <tr key={it.id}>
                    {selected && (
                      <td className="px-2 py-2 align-middle">
                        {!it.customisedOrderId && onToggleSelect && (
                          <input
                            type="checkbox"
                            checked={selected.has(it.id)}
                            onChange={() => onToggleSelect(it.id)}
                            className="h-4 w-4"
                            aria-label={`Select ${it.designNumber}`}
                          />
                        )}
                      </td>
                    )}
                    <td className="px-2 py-2 align-middle">{i + 1}</td>
                    <td className="px-2 py-2 align-middle font-medium">
                      {it.canOpenProduct && onDesignClick ? (
                        <button type="button" onClick={() => onDesignClick(it)} className="text-primary hover:underline">{it.designNumber}</button>
                      ) : it.designNumber}
                    </td>
                    <td className="px-2 py-2 align-middle text-muted-foreground">—</td>
                    <td className="px-2 py-2 align-middle">
                      {it.customisedOrderId ? (
                        <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-800">{it.customisedOrderNo ?? 'Assigned'}</span>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-2 py-2 align-middle">
                      {statusOptions && onStatusChange && !it.o2dLinked ? (
                        <select
                          value={it.status}
                          disabled={itemBusy === it.id}
                          onChange={(e) => onStatusChange(it, e.target.value)}
                          className="h-7 rounded border border-input bg-transparent px-1 text-xs disabled:opacity-50"
                        >
                          {statusOptions.map((s) => <option key={s} value={s}>{formatOrderStatus(s)}</option>)}
                        </select>
                      ) : <span className="text-muted-foreground">{formatOrderStatus(it.status)}</span>}
                    </td>
                    <td className="px-2 py-2 align-middle text-right tabular-nums">{it.quantity}</td>
                    <td className="px-2 py-2 align-middle text-right tabular-nums">{it.grossWeightGrams != null ? String(it.grossWeightGrams) : '—'}</td>
                    <td className="px-2 py-2 align-middle text-right tabular-nums">{it.netWeightGrams != null ? String(it.netWeightGrams) : '—'}</td>
                    <td className="px-2 py-2 align-middle text-right tabular-nums">{it.pieces ?? '—'}</td>
                    <td className="px-2 py-2 align-middle text-muted-foreground">{remarks}</td>
                    <td className="px-2 py-2 align-middle">{it.karigarCode || '0'}</td>
                    <td className="px-2 py-2 align-middle">
                      {it.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={it.imageUrl}
                          alt={it.designNumber}
                          onClick={() => onImageClick?.(it)}
                          className={`h-12 w-12 rounded border object-contain bg-white ${onImageClick ? 'cursor-zoom-in hover:shadow-md transition-shadow' : ''}`}
                        />
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 bg-[#c9a84c]/10 font-semibold">
                  <td className="px-2 py-2" colSpan={selected ? 6 : 5}>Total</td>
                  <td className="px-2 py-2 text-right tabular-nums">{totalRows}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{totalGross.toFixed(2)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{totalNet.toFixed(2)}</td>
                  <td className="px-2 py-2" colSpan={4} />
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Actions */}
          <div className="mt-5 flex flex-wrap justify-end gap-2 border-t pt-4">
            <Button type="button" size="sm" variant="outline" disabled={busy !== null} onClick={() => void run('image', () => downloadOrderSummaryImages(order))}>
              {busy === 'image' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Generate Image'}
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={busy !== null} onClick={() => void run('large-image', () => downloadOrderSummaryLargeImagePdf(order))}>
              {busy === 'large-image' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Large Image PDF'}
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={busy !== null} onClick={downloadExcel}>Download Excel</Button>
            <Button type="button" size="sm" disabled={busy !== null} onClick={() => void run('pdf', () => downloadOrderSummaryPdf(order))} className="metal-sheen text-[#17120b] font-semibold">
              {busy === 'pdf' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Generate PDF'}
            </Button>
          </div>

          {/* Karigar assignment / item-status / approve-complete — the
              existing operational panel, embedded so everything for this
              order lives in one place instead of two separate expand
              targets. */}
          {children && <div className="mt-5 border-t pt-4">{children}</div>}
        </div>
      </div>
    </div>
  );
}
