/**
 * Client-side PDF export for a Karigar-assignment Customised Order — two
 * variants sharing one layout:
 *  - Customer PDF: full client (store) identity + the real client delivery date.
 *  - Karigar PDF: NO client identity, but includes every applicable remark
 *    (requirement note, Narration 1/2, bespoke-request Karigar Notes) since
 *    production notes aren't PII; delivery date shown is karigarDeliveryDate
 *    (client date minus a 3-day buffer, computed server-side).
 * Urgent orders render with a red border/highlight on every page.
 * `jspdf` is dynamically imported so it never lands in the initial bundle —
 * same pattern as lib/catalogue-pdf.ts.
 */

export type KarigarPdfOrder = {
  orderNumber: string; // JFC-####
  referenceOrderNumber: string | null; // JFA-#### of the source order, if any
  storeName: string | null;
  storeAddress: string | null;
  category: string;
  subCategory: string | null;
  weightGramsMin: string | number | null;
  weightGramsMax: string | number | null;
  purity: string | null;
  quantity: string | null;
  deliveryDate: string | Date | null;
  karigarDeliveryDate: string | Date | null;
  meena: string | null;
  length: string | null;
  size: string | null;
  broadness: string | null;
  screw: string | null;
  sampleWeightGrams: string | number | null;
  narration1: string | null;
  narration2: string | null;
  qc: string | null;
  orderType: string | null;
  orderStage: string | null;
  urgent: boolean;
  karigarCode: string | null;
  designNotes: string | null; // requirement note / remarks
  imageUrl: string | null;
};

const GOLD = [201, 168, 76] as const; // #c9a84c — the app's gold accent
const INK = [23, 18, 11] as const; // #17120b

function fmtDate(value: string | Date | null): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function fmtWeight(min: string | number | null, max: string | number | null): string {
  if (min == null && max == null) return '—';
  if (min != null && max != null && String(min) !== String(max)) return `${min}g – ${max}g`;
  return `${min ?? max}g`;
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

export async function downloadKarigarOrderPdf(order: KarigarPdfOrder, variant: 'customer' | 'karigar'): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = 210;
  const marginX = 14;
  let y = 16;

  if (order.urgent) {
    doc.setDrawColor(220, 38, 38);
    doc.setLineWidth(1.2);
    doc.rect(4, 4, pageW - 8, 289 - 8);
    doc.setLineWidth(0.2);
  }

  // Header — Jewel Factory wordmark, gold accent
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...INK);
  doc.text('JEWEL', marginX, y);
  doc.setTextColor(...GOLD);
  doc.text(' FACTORY', marginX + doc.getTextWidth('JEWEL'), y);
  doc.setTextColor(...INK);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(variant === 'karigar' ? 'Karigar Order' : 'Customer Order', pageW - marginX, y, { align: 'right' });

  if (order.urgent) {
    doc.setTextColor(220, 38, 38);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('URGENT', pageW - marginX, y + 5, { align: 'right' });
    doc.setTextColor(...INK);
  }

  y += 4;
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.6);
  doc.line(marginX, y, pageW - marginX, y);
  doc.setLineWidth(0.2);
  y += 8;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(order.orderNumber, marginX, y);
  if (order.referenceOrderNumber) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(`Ref. order: ${order.referenceOrderNumber}`, pageW - marginX, y, { align: 'right' });
    doc.setTextColor(...INK);
  }
  y += 8;

  if (variant === 'customer') {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text('CUSTOMER', marginX, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.text(order.storeName ?? '—', marginX, y);
    y += 5;
    if (order.storeAddress) {
      doc.setFontSize(8.5);
      doc.setTextColor(110);
      const lines = doc.splitTextToSize(order.storeAddress, pageW - marginX * 2);
      doc.text(lines, marginX, y);
      y += lines.length * 4 + 2;
      doc.setTextColor(...INK);
    }
    y += 2;
  }

  function row(pairs: Array<[string, string]>) {
    const colW = (pageW - marginX * 2) / pairs.length;
    doc.setDrawColor(230);
    doc.line(marginX, y, pageW - marginX, y);
    y += 5;
    pairs.forEach(([label, value], i) => {
      const x = marginX + i * colW;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(130);
      doc.text(label.toUpperCase(), x, y);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(...INK);
      doc.text(value || '—', x, y + 5, { maxWidth: colW - 3 });
    });
    y += 12;
  }

  const deliveryDate = variant === 'karigar' ? order.karigarDeliveryDate : order.deliveryDate;
  row([
    ['Order Date', fmtDate(new Date())],
    ['Delivery Date', fmtDate(deliveryDate)],
    ['Category', [order.category, order.subCategory].filter(Boolean).join(' › ') || '—'],
    ['Quantity', order.quantity ?? '—'],
    ['Melting / Purity', order.purity ?? '—'],
  ]);

  row([
    ['Length', order.length ?? '—'],
    ['Size', order.size ?? '—'],
    ['Broadness', order.broadness ?? '—'],
    ['Screw', order.screw ?? '—'],
    ['Meena', order.meena ?? '—'],
  ]);

  row([
    ['Weight', fmtWeight(order.weightGramsMin, order.weightGramsMax)],
    ['Sample Weight', order.sampleWeightGrams != null && order.sampleWeightGrams !== '' ? `${order.sampleWeightGrams}g` : '—'],
    ['QC', order.qc ?? '—'],
    ['Order Type', order.orderType ?? '—'],
    ['Karigar', order.karigarCode ?? '—'],
  ]);

  if (order.orderStage) {
    row([['Order Stage', order.orderStage], ['', ''], ['', ''], ['', ''], ['', '']]);
  }

  // Remarks / narration block — Karigar PDF gets ALL notes (requirement note +
  // both narrations); Customer PDF gets none (production notes aren't for the
  // client).
  if (variant === 'karigar') {
    const notes: Array<[string, string]> = [];
    if (order.designNotes) notes.push(['Remarks', order.designNotes]);
    if (order.narration1) notes.push(['Narration 1', order.narration1]);
    if (order.narration2) notes.push(['Narration 2', order.narration2]);
    if (notes.length > 0) {
      doc.setDrawColor(230);
      doc.line(marginX, y, pageW - marginX, y);
      y += 6;
      for (const [label, value] of notes) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(130);
        doc.text(label.toUpperCase(), marginX, y);
        y += 4.5;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        doc.setTextColor(...INK);
        const lines = doc.splitTextToSize(value, pageW - marginX * 2);
        doc.text(lines, marginX, y);
        y += lines.length * 4.5 + 4;
      }
    }
  }

  if (order.imageUrl) {
    const dataUrl = await imageToDataUrl(order.imageUrl);
    if (dataUrl) {
      try {
        const size = 60;
        doc.setDrawColor(230);
        doc.line(marginX, y, pageW - marginX, y);
        y += 6;
        doc.addImage(dataUrl, imageFormat(dataUrl), marginX, y, size, size, undefined, 'FAST');
      } catch {
        // Corrupt/unsupported image data — skip, text content already rendered.
      }
    }
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(150);
  doc.text('Jewel Factory', marginX, 285);

  doc.save(`${order.orderNumber}-${variant}.pdf`);
}
