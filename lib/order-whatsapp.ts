import sharp from 'sharp';

import { getServerEnv } from '@/lib/env';
import { prisma } from '@/lib/prisma';
import { isWhatsAppConfigured, sendOrderApprovedWhatsApp, sendOrderPlacedWhatsApp } from '@/lib/whatsapp';

/**
 * "Order placed" WhatsApp to the purchase manager, with the order as a PDF.
 *
 * Built server-side (lib/order-summary-pdf.ts only runs in the browser) and
 * deliberately NOT that manufacturer Order Summary: this one goes to the
 * purchase manager, so it carries no karigar code and no price. Called
 * fire-and-forget — it never throws, never delays the order response.
 */

type PdfItem = {
  designNumber: string;
  category: string | null;
  purity: string | null;
  size: string | null;
  quantity: number;
  grossWeightGrams: string | null;
  netWeightGrams: string | null;
  imageUrl: string | null;
};

type PdfOrder = {
  orderNumber: string;
  storeName: string;
  branchName: string | null;
  createdAt: Date;
  deliveryDate: Date | null;
  remark: string | null;
  items: PdfItem[];
};

const GOLD = [201, 168, 76] as const; // #c9a84c
const INK = [23, 18, 11] as const; // #17120b
const IMAGE_FETCH_TIMEOUT_MS = 10_000;
const IMAGE_CONCURRENCY = 6;

function fmtDate(d: Date | null, timeZone: string): string {
  if (!d) return '-';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone });
}

function fmtWeight(value: string | null): string {
  if (!value) return '-';
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? `${n.toFixed(3)} gm` : '-';
}

/**
 * Catalogue photos are full-size PNGs (often 1MB+); a thumbnail-sized JPEG
 * keeps a 50-line order PDF small enough to upload and open quickly on a phone.
 */
async function thumbnail(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(IMAGE_FETCH_TIMEOUT_MS) });
    if (!res.ok) return null;
    const jpeg = await sharp(Buffer.from(await res.arrayBuffer()))
      .resize(160, 160, { fit: 'contain', background: '#ffffff' })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: 72 })
      .toBuffer();
    return `data:image/jpeg;base64,${jpeg.toString('base64')}`;
  } catch {
    return null;
  }
}

async function thumbnails(urls: Array<string | null>): Promise<Array<string | null>> {
  const out: Array<string | null> = new Array(urls.length).fill(null);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(IMAGE_CONCURRENCY, urls.length) }, async () => {
      while (next < urls.length) {
        const i = next++;
        out[i] = await thumbnail(urls[i] ?? null);
      }
    }),
  );
  return out;
}

async function buildOrderPdf(order: PdfOrder): Promise<Uint8Array> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 12;
  const images = await thumbnails(order.items.map((i) => i.imageUrl));

  // Header — same JEWEL FACTORY wordmark as the other order PDFs.
  let y = 16;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...INK);
  const factoryW = doc.getTextWidth(' FACTORY');
  doc.text('JEWEL', pageW - marginX - factoryW - doc.getTextWidth('JEWEL'), y);
  doc.setTextColor(...GOLD);
  doc.text(' FACTORY', pageW - marginX - factoryW, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.text('Order Summary', pageW - marginX, y + 5, { align: 'right' });

  doc.setTextColor(...INK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  const lines = [
    `Name : ${order.storeName}`,
    ...(order.branchName ? [`Store : ${order.branchName}`] : []),
    `Order ID : ${order.orderNumber}`,
    `Order Date : ${fmtDate(order.createdAt, 'Asia/Kolkata')}`,
    // DATE column — stored as UTC midnight, so format it in UTC.
    `Delivery date : ${fmtDate(order.deliveryDate, 'UTC')}`,
  ];
  lines.forEach((line, i) => doc.text(line, marginX, y + i * 5));
  y += lines.length * 5;
  if (order.remark) {
    doc.setFont('helvetica', 'normal');
    const remark = doc.splitTextToSize(`Remark : ${order.remark}`, pageW - marginX * 2) as string[];
    doc.text(remark, marginX, y + 1);
    y += remark.length * 4.5;
  }
  y += 3;
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.6);
  doc.line(marginX, y, pageW - marginX, y);
  doc.setLineWidth(0.2);
  y += 5;

  // Table
  const cols = [
    { title: '#', w: 8 },
    { title: 'Image', w: 22 },
    { title: 'Design No.', w: 26 },
    { title: 'Category', w: 34 },
    { title: 'Purity', w: 18 },
    { title: 'Size', w: 16 },
    { title: 'Qty', w: 12 },
    { title: 'Gross Wt.', w: 25 },
    { title: 'Net Wt.', w: 25 },
  ];
  const rowH = 22;

  function drawHeaderRow() {
    doc.setFillColor(...INK);
    doc.rect(marginX, y, pageW - marginX * 2, 8, 'F');
    doc.setTextColor(255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    let x = marginX;
    for (const c of cols) {
      doc.text(c.title, x + 2, y + 5.5);
      x += c.w;
    }
    doc.setTextColor(...INK);
    y += 8;
  }

  drawHeaderRow();
  doc.setFont('helvetica', 'normal');
  order.items.forEach((item, idx) => {
    if (y + rowH > pageH - 14) {
      doc.addPage();
      y = 14;
      drawHeaderRow();
      doc.setFont('helvetica', 'normal');
    }
    doc.setFontSize(8.5);
    const cells = [
      String(idx + 1),
      '',
      item.designNumber,
      item.category ?? '-',
      item.purity ?? '-',
      item.size ?? '-',
      String(item.quantity),
      fmtWeight(item.grossWeightGrams),
      fmtWeight(item.netWeightGrams),
    ];
    let x = marginX;
    cols.forEach((c, ci) => {
      if (ci === 1) {
        const img = images[idx];
        if (img) {
          try { doc.addImage(img, 'JPEG', x + 1.5, y + 1.5, rowH - 3, rowH - 3, undefined, 'FAST'); } catch { /* skip bad image */ }
        }
      } else {
        const text = doc.splitTextToSize(cells[ci] ?? '-', c.w - 3) as string[];
        doc.text(text.slice(0, 3), x + 2, y + 6);
      }
      x += c.w;
    });
    doc.setDrawColor(225);
    doc.line(marginX, y + rowH, pageW - marginX, y + rowH);
    y += rowH;
  });

  const totalQty = order.items.reduce((s, i) => s + i.quantity, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(`Total designs: ${order.items.length}    Total quantity: ${totalQty}`, pageW - marginX, y + 7, { align: 'right' });

  return new Uint8Array(doc.output('arraybuffer'));
}

/**
 * The order's line items with live product specs (category/gross/net weight
 * aren't snapshotted on the order). Only karigar-free fields are selected.
 */
async function productSpecs(ids: string[]) {
  const products = await prisma.manufacturerProduct.findMany({
    where: { id: { in: ids } },
    select: {
      id: true, designNumber: true, category: true, purity: true, size: true,
      grossWeightGrams: true, netWeightGrams: true, weightGrams: true,
      images: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }], take: 1, select: { secureUrl: true } },
    },
  });
  return new Map(products.map((p) => [p.id, p]));
}

async function loadPdfOrder(kind: 'B2B' | 'KIOSK', orderId: string) {
  const storeSelect = { name: true, ownerName: true, ownerPhone: true, phone: true } as const;

  if (kind === 'B2B') {
    const o = await prisma.b2bOrder.findUnique({
      where: { id: orderId },
      include: { items: true, store: { select: storeSelect } },
    });
    if (!o) return null;
    const specs = await productSpecs(o.items.map((i) => i.manufacturerProductId));
    const items: PdfItem[] = o.items.map((i) => {
      const p = specs.get(i.manufacturerProductId);
      return {
        designNumber: i.productDesignSnapshot ?? p?.designNumber ?? i.productNameSnapshot ?? '-',
        category: p?.category ?? null,
        purity: i.purity ?? p?.purity ?? null,
        size: i.size ?? p?.size ?? null,
        quantity: i.quantity,
        grossWeightGrams: (p?.grossWeightGrams ?? p?.weightGrams)?.toString() ?? null,
        netWeightGrams: p?.netWeightGrams?.toString() ?? null,
        imageUrl: i.productImageSnapshot ?? p?.images[0]?.secureUrl ?? null,
      };
    });
    return {
      store: o.store,
      branchId: o.branchId,
      order: {
        orderNumber: o.orderNumber, storeName: o.store.name, branchName: o.branchNameSnapshot,
        createdAt: o.createdAt, deliveryDate: o.deliveryDate, remark: o.requirementNote ?? o.notes, items,
      } satisfies PdfOrder,
    };
  }

  const o = await prisma.kioskOrder.findUnique({
    where: { id: orderId },
    include: { items: true, store: { select: storeSelect } },
  });
  if (!o) return null;
  const specs = await productSpecs(o.items.flatMap((i) => (i.manufacturerProductId ? [i.manufacturerProductId] : [])));
  const items: PdfItem[] = o.items.map((i) => {
    const p = i.manufacturerProductId ? specs.get(i.manufacturerProductId) : undefined;
    return {
      designNumber: p?.designNumber ?? i.productNameSnapshot,
      category: p?.category ?? i.categorySnapshot,
      purity: i.purity ?? p?.purity ?? null,
      size: p?.size ?? null,
      quantity: i.quantity,
      grossWeightGrams: (p?.grossWeightGrams ?? p?.weightGrams)?.toString() ?? null,
      netWeightGrams: p?.netWeightGrams?.toString() ?? null,
      imageUrl: i.productImageSnapshot ?? p?.images[0]?.secureUrl ?? null,
    };
  });
  return {
    store: o.store,
    branchId: o.branchId,
    order: {
      orderNumber: o.orderNumber, storeName: o.store.name, branchName: o.branchNameSnapshot,
      createdAt: o.createdAt, deliveryDate: o.deliveryDate, remark: o.requirementNote ?? o.notes, items,
    } satisfies PdfOrder,
  };
}

/** Loads an order and renders its purchase-manager PDF; null if not found. */
export async function renderOrderPdf(kind: 'B2B' | 'KIOSK', orderId: string) {
  const loaded = await loadPdfOrder(kind, orderId);
  if (!loaded) return null;
  return { ...loaded, pdf: await buildOrderPdf(loaded.order) };
}

type Recipient = { name: string; phone: string | null };

/**
 * Who gets an order's WhatsApp: the branch's Store Manager(s) when the order
 * came from a branch, otherwise the purchase manager (Head Office) who placed
 * it. A branch with several active managers notifies each with a phone.
 */
async function orderRecipients(branchId: string | null, store: { name: string; ownerName: string | null; ownerPhone: string | null; phone: string | null }): Promise<Recipient[]> {
  if (branchId) {
    const managers = await prisma.branchManager.findMany({
      where: { branchId, isActive: true, phone: { not: null } },
      select: { name: true, phone: true },
    });
    if (managers.length > 0) return managers.map((m) => ({ name: m.name || store.name, phone: m.phone }));
  }
  return [{ name: store.ownerName || store.name, phone: store.ownerPhone ?? store.phone }];
}

/**
 * "Order placed" confirmation to whoever placed the order (the purchase
 * manager's own order, or a branch's Store Manager). PDF only when a
 * Document-header template is configured (WHATSAPP_ORDER_PDF).
 */
export async function notifyOrderPlacedWhatsApp(kind: 'B2B' | 'KIOSK', orderId: string): Promise<void> {
  try {
    if (!isWhatsAppConfigured()) return;
    let pdf: Uint8Array | undefined;
    let loaded: Awaited<ReturnType<typeof loadPdfOrder>>;
    if (getServerEnv().WHATSAPP_ORDER_PDF) {
      const rendered = await renderOrderPdf(kind, orderId);
      if (rendered) pdf = rendered.pdf;
      loaded = rendered;
    } else {
      loaded = await loadPdfOrder(kind, orderId);
    }
    if (!loaded) return;
    const { store, branchId, order } = loaded;
    const recipients = await orderRecipients(branchId, store);
    const common = {
      orderNumber: order.orderNumber,
      designs: new Set(order.items.map((i) => i.designNumber)).size,
      totalQuantity: order.items.reduce((s, i) => s + i.quantity, 0),
      expectedDelivery: order.deliveryDate ? fmtDate(order.deliveryDate, 'UTC') : 'To be confirmed',
      pdf,
    };
    await Promise.all(recipients.map((r) => sendOrderPlacedWhatsApp({ to: r.phone, name: r.name, ...common })));
  } catch (e) {
    console.warn(`[whatsapp] order-placed ${kind} ${orderId} FAILED: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/**
 * "Order approved" to the branch's Store Manager(s) when Head Office approves
 * their order (falls back to the purchase manager if the order has no branch).
 */
export async function notifyOrderApprovedWhatsApp(kind: 'B2B' | 'KIOSK', orderId: string): Promise<void> {
  try {
    if (!isWhatsAppConfigured()) return;
    const loaded = await loadPdfOrder(kind, orderId);
    if (!loaded) return;
    const { store, branchId, order } = loaded;
    const recipients = await orderRecipients(branchId, store);
    const expectedDelivery = order.deliveryDate ? fmtDate(order.deliveryDate, 'UTC') : 'To be confirmed';
    await Promise.all(recipients.map((r) =>
      sendOrderApprovedWhatsApp({ to: r.phone, name: r.name, orderNumber: order.orderNumber, expectedDelivery }),
    ));
  } catch (e) {
    console.warn(`[whatsapp] order-approved ${kind} ${orderId} FAILED: ${e instanceof Error ? e.message : String(e)}`);
  }
}
