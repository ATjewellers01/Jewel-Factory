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
  // Plain designs have only one Weight field in Add Design, so both Gross
  // and Net show that same value here. Studded designs collect Gross/Net
  // Weight as two separate manual fields, so they can differ — see the
  // schema comment on ManufacturerProduct.grossWeightGrams/netWeightGrams.
  grossWeightGrams: string | number | null;
  netWeightGrams: string | number | null;
  pieces: number | null;
  karigarCode: string | null; // null/empty -> shown as "0"
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

export function OrderSummaryModal({ order, onClose, children }: { order: OrderSummaryData; onClose: () => void; children?: ReactNode }) {
  const [busy, setBusy] = useState<'image' | 'large-image' | 'excel' | 'pdf' | null>(null);
  const remarks = order.requirementNote?.trim() || 'No remarks';

  const totalQty = order.items.reduce((sum, it) => sum + it.quantity, 0);
  const totalGross = order.items.reduce((sum, it) => sum + num(it.grossWeightGrams), 0);
  const totalNet = order.items.reduce((sum, it) => sum + num(it.netWeightGrams), 0);

  function downloadExcel() {
    const header = ['#', 'Design Code', 'Tag Number', 'Order Stage', 'Quantity', 'Gross Wt.', 'Net Wt.', 'Pcs.', 'Remarks', 'Karigar'];
    const rows = order.items.map((it, i) => [
      String(i + 1), it.designNumber, '', formatOrderStatus(it.status), String(it.quantity),
      it.grossWeightGrams != null ? String(it.grossWeightGrams) : '', it.netWeightGrams != null ? String(it.netWeightGrams) : '',
      String(it.pieces ?? ''), remarks, it.karigarCode || '0',
    ]);
    rows.push(['Total', '', '', '', String(totalQty), totalGross.toFixed(2), totalNet.toFixed(2), '', '', '']);
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
            <div className="text-right">
              <p className="font-display text-lg font-semibold">
                <span className="text-[#17120b]">JEWEL</span><span className="text-[#c9a84c]"> FACTORY</span>
              </p>
              <p className="text-xs text-muted-foreground">Order Summary</p>
            </div>
          </div>

          {/* Table */}
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-sm">
              <thead>
                <tr className="border-b bg-[#17120b]/[0.03] text-left">
                  <th className="px-2 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">#</th>
                  <th className="px-2 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Design Code</th>
                  <th className="px-2 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Tag Number</th>
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
                    <td className="px-2 py-2 align-middle">{i + 1}</td>
                    <td className="px-2 py-2 align-middle font-medium">{it.designNumber}</td>
                    <td className="px-2 py-2 align-middle text-muted-foreground">—</td>
                    <td className="px-2 py-2 align-middle text-muted-foreground">{formatOrderStatus(it.status)}</td>
                    <td className="px-2 py-2 align-middle text-right tabular-nums">{it.quantity}</td>
                    <td className="px-2 py-2 align-middle text-right tabular-nums">{it.grossWeightGrams != null ? String(it.grossWeightGrams) : '—'}</td>
                    <td className="px-2 py-2 align-middle text-right tabular-nums">{it.netWeightGrams != null ? String(it.netWeightGrams) : '—'}</td>
                    <td className="px-2 py-2 align-middle text-right tabular-nums">{it.pieces ?? '—'}</td>
                    <td className="px-2 py-2 align-middle text-muted-foreground">{remarks}</td>
                    <td className="px-2 py-2 align-middle">{it.karigarCode || '0'}</td>
                    <td className="px-2 py-2 align-middle">
                      {it.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={it.imageUrl} alt={it.designNumber} className="h-12 w-12 rounded border object-contain bg-white" />
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 bg-[#c9a84c]/10 font-semibold">
                  <td className="px-2 py-2" colSpan={4}>Total</td>
                  <td className="px-2 py-2 text-right tabular-nums">{totalQty}</td>
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
