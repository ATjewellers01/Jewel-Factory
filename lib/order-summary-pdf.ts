/**
 * Client-side exports for the manufacturer's "Order Summary" popup
 * (components/orders/OrderSummaryModal.tsx) — matches the client's reference
 * table format (Design Code / Tag Number / Order Stage / Quantity / Gross Wt.
 * / Pcs. / Remarks / Karigar / Image, plus a Total row). `jspdf` is
 * dynamically imported, same pattern as lib/catalogue-pdf.ts and
 * lib/karigar-pdf.ts. Images are fetched through the existing
 * /api/manufacturer/catalog-pdf-image proxy to sidestep S3/CloudFront CORS.
 */

import { formatOrderStatus } from '@/lib/format';

export type OrderSummaryPdfItem = {
  designNumber: string;
  imageUrl: string | null;
  quantity: number;
  status: string;
  grossWeightGrams: string | number | null;
  netWeightGrams: string | number | null;
  pieces: number | null;
  karigarCode: string | null;
};

export type OrderSummaryPdfOrder = {
  orderNumber: string;
  storeName: string | null;
  orderDate: string;
  deliveryDate: string | null;
  requirementNote: string | null;
  items: OrderSummaryPdfItem[];
};

const GOLD = [201, 168, 76] as const; // #c9a84c
const INK = [23, 18, 11] as const; // #17120b

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

async function imageToDataUrl(url: string): Promise<string | null> {
  try {
    const proxied = `/api/manufacturer/catalog-pdf-image?url=${encodeURIComponent(url)}`;
    const res = await fetch(proxied, { credentials: 'same-origin', cache: 'force-cache' });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('read failed'));
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function imageFormat(dataUrl: string): string {
  const match = /^data:image\/(\w+);/.exec(dataUrl);
  const ext = (match?.[1] ?? 'jpeg').toUpperCase();
  return ext === 'JPG' ? 'JPEG' : ext;
}

function drawHeader(doc: import('jspdf').jsPDF, order: OrderSummaryPdfOrder, pageW: number, marginX: number): number {
  let y = 16;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...INK);
  doc.text('JEWEL', pageW - marginX - doc.getTextWidth(' FACTORY'), y, { align: 'left' });
  const jewelW = doc.getTextWidth('JEWEL');
  doc.setTextColor(...GOLD);
  doc.text(' FACTORY', pageW - marginX - doc.getTextWidth(' FACTORY') + jewelW, y);
  doc.setTextColor(...INK);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.text('Order Summary', pageW - marginX, y + 5, { align: 'right' });
  doc.setTextColor(...INK);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  const lines = [
    `Name : ${order.storeName ?? '—'}`,
    `Order Date : ${fmtDate(order.orderDate)}`,
    `Delivery date : ${fmtDate(order.deliveryDate)}`,
    `Order ID : ${order.orderNumber}`,
  ];
  lines.forEach((line, i) => doc.text(line, marginX, y + i * 5));
  y += lines.length * 5 + 4;

  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.6);
  doc.line(marginX, y, pageW - marginX, y);
  doc.setLineWidth(0.2);
  return y + 6;
}

/** "Generate PDF" — the full table with all items + a Total row. */
export async function downloadOrderSummaryPdf(order: OrderSummaryPdfOrder): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = 210;
  const marginX = 12;
  let y = drawHeader(doc, order, pageW, marginX);

  const remarks = order.requirementNote?.trim() || 'No remarks';
  const cols = [
    { label: '#', w: 8 },
    { label: 'Design Code', w: 26 },
    { label: 'Order Stage', w: 20 },
    { label: 'Qty', w: 12, align: 'right' as const },
    { label: 'Gross Wt.', w: 16, align: 'right' as const },
    { label: 'Net Wt.', w: 16, align: 'right' as const },
    { label: 'Pcs.', w: 10, align: 'right' as const },
    { label: 'Karigar', w: 18 },
    { label: 'Remarks', w: 36 },
    { label: 'Image', w: 24 },
  ];
  const tableW = cols.reduce((s, c) => s + c.w, 0);
  const scale = (pageW - marginX * 2) / tableW;
  cols.forEach((c) => { (c as { w: number }).w *= scale; });

  function drawRow(cells: string[], opts: { bold?: boolean; fill?: boolean; imageDataUrl?: string | null } = {}) {
    const rowH = opts.imageDataUrl ? 16 : 8;
    if (y + rowH > 280) { doc.addPage(); y = 16; }
    if (opts.fill) { doc.setFillColor(246, 238, 219); doc.rect(marginX, y, pageW - marginX * 2, rowH, 'F'); }
    let x = marginX;
    doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...INK);
    cols.forEach((c, i) => {
      if (i === cols.length - 1 && opts.imageDataUrl) {
        try { doc.addImage(opts.imageDataUrl, imageFormat(opts.imageDataUrl), x + 1, y + 1, 14, 14, undefined, 'FAST'); } catch { /* skip corrupt image */ }
      } else {
        doc.text(cells[i] ?? '', c.align === 'right' ? x + c.w - 1 : x + 1, y + rowH / 2 + 1.2, { align: c.align, maxWidth: c.w - 2 });
      }
      x += c.w;
    });
    doc.setDrawColor(230);
    doc.line(marginX, y + rowH, pageW - marginX, y + rowH);
    y += rowH;
  }

  doc.setFillColor(245, 240, 227);
  doc.rect(marginX, y, pageW - marginX * 2, 8, 'F');
  drawRow(cols.map((c) => c.label), { bold: true });

  let totalQty = 0;
  let totalGross = 0;
  let totalNet = 0;
  for (let i = 0; i < order.items.length; i++) {
    const it = order.items[i];
    totalQty += it.quantity;
    totalGross += num(it.grossWeightGrams);
    totalNet += num(it.netWeightGrams);
    const dataUrl = it.imageUrl ? await imageToDataUrl(it.imageUrl) : null;
    drawRow([
      String(i + 1), it.designNumber, formatOrderStatus(it.status), String(it.quantity),
      it.grossWeightGrams != null ? String(it.grossWeightGrams) : '—',
      it.netWeightGrams != null ? String(it.netWeightGrams) : '—',
      String(it.pieces ?? '—'), it.karigarCode || '0', remarks, '',
    ], { imageDataUrl: dataUrl });
  }

  drawRow(['Total', '', '', String(totalQty), totalGross.toFixed(2), totalNet.toFixed(2), '', '', '', ''], { bold: true, fill: true });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(150);
  doc.text('Jewel Factory', marginX, 290);

  doc.save(`${order.orderNumber}-order-summary.pdf`);
}

/** "Large Image PDF" — one big image per item, design number + spec below it. */
export async function downloadOrderSummaryLargeImagePdf(order: OrderSummaryPdfOrder): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = 210;
  const marginX = 14;
  let y = drawHeader(doc, order, pageW, marginX);

  const imgSize = 110;
  for (let i = 0; i < order.items.length; i++) {
    const it = order.items[i];
    if (i > 0) { doc.addPage(); y = 16; }
    doc.setDrawColor(225);
    doc.roundedRect((pageW - imgSize) / 2, y, imgSize, imgSize, 2, 2);
    if (it.imageUrl) {
      const dataUrl = await imageToDataUrl(it.imageUrl);
      if (dataUrl) {
        try { doc.addImage(dataUrl, imageFormat(dataUrl), (pageW - imgSize) / 2 + 2, y + 2, imgSize - 4, imgSize - 4, undefined, 'FAST'); } catch { /* skip corrupt image */ }
      }
    }
    let ty = y + imgSize + 10;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...INK);
    doc.text(it.designNumber, pageW / 2, ty, { align: 'center' });
    ty += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(110);
    const weightPart = `Gross ${it.grossWeightGrams != null ? `${it.grossWeightGrams} gm` : '—'} · Net ${it.netWeightGrams != null ? `${it.netWeightGrams} gm` : '—'}`;
    const spec = `Qty ${it.quantity} · ${weightPart}${it.pieces != null ? ` · ${it.pieces} pcs` : ''} · Karigar ${it.karigarCode || '0'}`;
    doc.text(spec, pageW / 2, ty, { align: 'center' });
  }

  doc.save(`${order.orderNumber}-large-image.pdf`);
}

/** "Generate Image" — every item's photo as one combined image-sheet PNG. */
export async function downloadOrderSummaryImages(order: OrderSummaryPdfOrder): Promise<void> {
  const cols = 4;
  const cell = 220;
  const rows = Math.max(1, Math.ceil(order.items.length / cols));
  const canvas = document.createElement('canvas');
  canvas.width = cols * cell;
  canvas.height = rows * cell;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < order.items.length; i++) {
    const it = order.items[i];
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = col * cell;
    const y = row * cell;
    ctx.strokeStyle = '#e5e0d5';
    ctx.strokeRect(x + 4, y + 4, cell - 8, cell - 8);
    if (it.imageUrl) {
      const dataUrl = await imageToDataUrl(it.imageUrl);
      if (dataUrl) {
        const img = await new Promise<HTMLImageElement | null>((resolve) => {
          const el = new Image();
          el.onload = () => resolve(el);
          el.onerror = () => resolve(null);
          el.src = dataUrl;
        });
        if (img) {
          const pad = 12;
          const size = cell - pad * 2 - 20;
          const scale = Math.min(size / img.width, size / img.height);
          const w = img.width * scale;
          const h = img.height * scale;
          ctx.drawImage(img, x + (cell - w) / 2, y + pad, w, h);
        }
      }
    }
    ctx.fillStyle = '#17120b';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(it.designNumber, x + cell / 2, y + cell - 10);
  }

  const url = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = url;
  a.download = `${order.orderNumber}-items.png`;
  a.click();
}
