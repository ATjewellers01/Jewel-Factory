import type { CustomOrderStatus } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { formatStoreAddress } from '@/lib/db/stores';
import { nextCatalogOrderNumber } from '@/lib/db/order-number';

// ── Kiosk: customer submits a request (has PII) ───────────────────────────────

export async function placeCustomRequest(input: {
  storeId: string;
  branchId?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  customerNotes?: string;
  referenceImageUrl?: string;
  referenceImagePublicId?: string;
  referenceImageUrls?: string[];
  category: string;
  subCategory?: string;
  weightGramsMin?: number;
  weightGramsMax?: number;
  purity?: string;
  designNotes?: string;
  // Counter spec — all optional (see the custom_design_spec_fields migration).
  orderRef?: string;
  deliveryDate?: Date;
  quantity?: string; // free text — "2 pcs", not a strict count
  meena?: string;
  length?: string;
  size?: string;
  broadness?: string;
  screw?: string;
  sampleWeightGrams?: number;
}) {
  return prisma.customDesignRequest.create({
    data: {
      storeId: input.storeId,
      branchId: input.branchId ?? null,
      customerName: input.customerName ?? null,
      customerPhone: input.customerPhone ?? null,
      customerNotes: input.customerNotes ?? null,
      referenceImageUrl: input.referenceImageUrl ?? null,
      referenceImagePublicId: input.referenceImagePublicId ?? null,
      referenceImageUrls: input.referenceImageUrls ?? [],
      category: input.category,
      subCategory: input.subCategory ?? null,
      weightGramsMin: input.weightGramsMin ?? null,
      weightGramsMax: input.weightGramsMax ?? null,
      purity: input.purity ?? null,
      designNotes: input.designNotes ?? null,
      orderRef: input.orderRef ?? null,
      deliveryDate: input.deliveryDate ?? null,
      quantity: input.quantity ?? null,
      meena: input.meena ?? null,
      length: input.length ?? null,
      size: input.size ?? null,
      broadness: input.broadness ?? null,
      screw: input.screw ?? null,
      sampleWeightGrams: input.sampleWeightGrams ?? null,
    },
    select: { id: true },
  });
}

// ── Store/manager: list + approve (forward) / reject ──────────────────────────

export async function listCustomRequests(storeId: string) {
  // Include the downstream order so the manager sees the manufacturer's live status,
  // and the branch (Store) so HO can see/filter which Store each request came from.
  return prisma.customDesignRequest.findMany({
    where: { storeId },
    orderBy: { createdAt: 'desc' },
    include: {
      order: { select: { id: true, status: true, orderNumber: true, trackingNumber: true } },
      branch: { select: { name: true } },
    },
  });
}

/**
 * Approve + forward: create a SANITIZED custom_design_order (store identity +
 * specs only, NO customer PII), then flip the request to FORWARDED. Atomic.
 */
export async function forwardCustomRequest(storeId: string, requestId: string, reviewedById: string | null) {
  const req = await prisma.customDesignRequest.findFirst({ where: { id: requestId, storeId } });
  if (!req) return { ok: false as const, reason: 'not_found' };

  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: {
      name: true, manufacturerId: true,
      addressStreet: true, addressLandmark: true, addressCity: true, addressState: true, addressPincode: true,
    },
  });
  if (!store) return { ok: false as const, reason: 'not_found' };
  if (!store.manufacturerId) return { ok: false as const, reason: 'no_manufacturer' };

  const orderNum = await nextCatalogOrderNumber(store.manufacturerId);

  await prisma.$transaction(async (tx) => {
    await tx.customDesignOrder.create({
      data: {
        requestId,
        manufacturerId: store.manufacturerId!,
        storeId,
        storeNameSnapshot: store.name,
        storeAddressSnapshot: formatStoreAddress(store),
        category: req.category,
        subCategory: req.subCategory,
        weightGramsMin: req.weightGramsMin,
        weightGramsMax: req.weightGramsMax,
        purity: req.purity,
        referenceImageUrl: req.referenceImageUrl,
        referenceImageUrls: req.referenceImageUrls,
        designNotes: req.designNotes,
        // The whole counter spec travels to the manufacturer — it carries no PII.
        orderRef: req.orderRef,
        deliveryDate: req.deliveryDate,
        quantity: req.quantity,
        meena: req.meena,
        length: req.length,
        size: req.size,
        broadness: req.broadness,
        screw: req.screw,
        sampleWeightGrams: req.sampleWeightGrams,
        orderNumber: orderNum,
      },
    });
    await tx.customDesignRequest.update({
      where: { id: requestId },
      data: { status: 'FORWARDED', reviewedById, reviewedAt: new Date() },
    });
  });
  return { ok: true as const, orderNumber: orderNum };
}

// ── Retailer Admin's own bespoke request (2026-08-10 redesign) ────────────────
// Unlike the original CustomDesignRequest→CustomDesignOrder flow above, this
// does NOT create a CustomDesignOrder immediately. It lands as a PENDING row
// in the manufacturer's Catalog Orders list (JFA-####, same shared counter),
// tagged "Customised Order from {business name}". A real CustomDesignOrder
// (JFC-####) is only created once the manufacturer assigns a Karigar — see
// assignKarigarToRetailerRequest in lib/db/karigar.ts.

export async function placeRetailerCustomRequest(storeId: string, input: {
  category: string;
  subCategory?: string | null;
  weightGramsMin?: number | null;
  weightGramsMax?: number | null;
  purity?: string | null;
  designNotes?: string | null;
  referenceImageUrl?: string | null;
  referenceImageUrls?: string[];
  orderRef?: string | null;
  deliveryDate?: Date | null;
  quantity?: string | null;
  meena?: string | null;
  length?: string | null;
  size?: string | null;
  broadness?: string | null;
  screw?: string | null;
  sampleWeightGrams?: number | null;
}) {
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: {
      name: true, manufacturerId: true,
      addressStreet: true, addressLandmark: true, addressCity: true, addressState: true, addressPincode: true,
    },
  });
  if (!store) return { ok: false as const, reason: 'not_found' };
  if (!store.manufacturerId) return { ok: false as const, reason: 'no_manufacturer' };

  const orderNumber = await nextCatalogOrderNumber(store.manufacturerId);
  const created = await prisma.retailerCustomRequest.create({
    data: {
      manufacturerId: store.manufacturerId,
      storeId,
      orderNumber,
      storeNameSnapshot: store.name,
      storeAddressSnapshot: formatStoreAddress(store),
      category: input.category,
      subCategory: input.subCategory ?? null,
      weightGramsMin: input.weightGramsMin ?? null,
      weightGramsMax: input.weightGramsMax ?? null,
      purity: input.purity ?? null,
      designNotes: input.designNotes ?? null,
      referenceImageUrl: input.referenceImageUrl ?? null,
      referenceImageUrls: input.referenceImageUrls ?? [],
      orderRef: input.orderRef ?? null,
      deliveryDate: input.deliveryDate ?? null,
      quantity: input.quantity ?? null,
      meena: input.meena ?? null,
      length: input.length ?? null,
      size: input.size ?? null,
      broadness: input.broadness ?? null,
      screw: input.screw ?? null,
      sampleWeightGrams: input.sampleWeightGrams ?? null,
    },
  });
  return { ok: true as const, id: created.id, orderNumber };
}

export async function listRetailerCustomRequestsByStore(storeId: string) {
  return prisma.retailerCustomRequest.findMany({ where: { storeId }, orderBy: { createdAt: 'desc' } });
}

export async function listRetailerCustomRequestsByManufacturer(manufacturerId: string) {
  return prisma.retailerCustomRequest.findMany({
    where: { manufacturerId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, orderNumber: true, storeNameSnapshot: true, storeAddressSnapshot: true,
      status: true, orderId: true, createdAt: true,
    },
  });
}

export async function getRetailerCustomRequestForManufacturer(manufacturerId: string, id: string) {
  return prisma.retailerCustomRequest.findFirst({ where: { id, manufacturerId } });
}

// ── Manufacturer: list + advance status (sanitized, no PII) ───────────────────
// storeNameSnapshot (business name only) is shown; city is not part of this
// model, so no further stripping is needed here (see CLAUDE.md 2026-08-05).

export async function listCustomOrdersByManufacturer(manufacturerId: string) {
  return prisma.customDesignOrder.findMany({
    where: { manufacturerId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, orderNumber: true, storeNameSnapshot: true, storeAddressSnapshot: true,
      category: true, subCategory: true, weightGramsMin: true, weightGramsMax: true, purity: true,
      referenceImageUrl: true, referenceImageUrls: true, designNotes: true,
      orderRef: true, deliveryDate: true, quantity: true, meena: true,
      length: true, size: true, broadness: true, screw: true, sampleWeightGrams: true,
      totalWeightGrams: true, karigarNotes: true,
      status: true, trackingNumber: true, karigarCode: true, createdAt: true,
      // Karigar-assignment fields (2026-08-09) — present on both origins
      // (bespoke request OR assigned from a Catalog/Kiosk order); null when unset.
      sourceB2bOrderId: true, sourceKioskOrderId: true,
      karigarId: true, karigar: { select: { id: true, code: true } },
      karigarDeliveryDate: true, narration1: true, narration2: true, qc: true,
      orderType: true, orderStage: true, urgent: true,
    },
  });
}

/**
 * Phase 2 assignment form — the manually + auto-filled fields the manufacturer
 * sets once a Karigar-assignment CustomDesignOrder exists (both origins: from
 * assigning items on a Catalog/Kiosk order, or from a bespoke request).
 * All fields optional/partial — the caller sends only what changed.
 */
export async function updateCustomOrderKarigarForm(manufacturerId: string, id: string, input: {
  category?: string;
  weightGramsMin?: number | null;
  weightGramsMax?: number | null;
  purity?: string | null;
  quantity?: string | null;
  deliveryDate?: Date | null;
  karigarDeliveryDate?: Date | null;
  size?: string | null;
  sampleWeightGrams?: number | null;
  totalWeightGrams?: number | null;
  karigarNotes?: string | null;
  meena?: string | null;
  length?: string | null;
  broadness?: string | null;
  screw?: string | null;
  narration1?: string | null;
  narration2?: string | null;
  qc?: string | null;
  orderType?: string | null;
  orderStage?: string | null;
  urgent?: boolean;
  karigarId?: string | null;
  karigarCode?: string | null;
}) {
  const o = await prisma.customDesignOrder.findFirst({ where: { id, manufacturerId }, select: { id: true } });
  if (!o) return false;
  await prisma.customDesignOrder.update({ where: { id }, data: input });
  return true;
}

export async function getCustomOrderForManufacturer(manufacturerId: string, id: string) {
  return prisma.customDesignOrder.findFirst({
    where: { id, manufacturerId },
    include: { karigar: { select: { id: true, code: true } } },
  });
}

// Items table on the Customised Order card (2026-08-10 redesign) — the
// specific Catalog/Kiosk order items this JFC-#### actually covers, if it
// originated from item-assignment (empty for the bespoke-request origin,
// which has no linked items).
export async function getCustomOrderItemsForManufacturer(manufacturerId: string, id: string) {
  const order = await prisma.customDesignOrder.findFirst({ where: { id, manufacturerId }, select: { id: true } });
  if (!order) return null;
  const productSelect = { id: true, karigarCode: true, category: true, subCategory: true, weightGrams: true, purity: true, description: true, designNumber: true, images: { orderBy: [{ isPrimary: 'desc' as const }, { sortOrder: 'asc' as const }], select: { secureUrl: true, isPrimary: true } } };
  const [b2bItems, kioskItems] = await Promise.all([
    prisma.b2bOrderItem.findMany({
      where: { customisedOrderId: id },
      include: { manufacturerProduct: { select: productSelect } },
    }),
    // KioskOrderItem has no direct `manufacturerProduct` relation defined
    // (only the nullable FK id) — same manual-join pattern as
    // hydrateItemsWithProduct in lib/db/orders.ts.
    prisma.kioskOrderItem.findMany({ where: { customisedOrderId: id } }),
  ]);
  const kioskProductIds = [...new Set(kioskItems.map((i) => i.manufacturerProductId).filter((x): x is string => !!x))];
  const kioskProducts = kioskProductIds.length
    ? await prisma.manufacturerProduct.findMany({ where: { id: { in: kioskProductIds } }, select: productSelect })
    : [];
  const kioskProductById = new Map(kioskProducts.map((p) => [p.id, p]));
  // sourceKind/sourceOrderId let the caller route a per-item status PATCH
  // back to the item's ORIGINAL b2b/kiosk order (item-status is still owned
  // by that order, not by the Customised Order it's now linked to).
  return [
    ...b2bItems.map((i) => ({ ...i, sourceKind: 'b2b' as const, sourceOrderId: i.orderId })),
    ...kioskItems.map((i) => ({
      ...i, sourceKind: 'kiosk' as const, sourceOrderId: i.orderId,
      manufacturerProduct: i.manufacturerProductId ? kioskProductById.get(i.manufacturerProductId) ?? null : null,
    })),
  ];
}

export async function advanceCustomOrderStatus(
  manufacturerId: string,
  id: string,
  status: CustomOrderStatus,
  trackingNumber?: string,
) {
  const o = await prisma.customDesignOrder.findFirst({ where: { id, manufacturerId }, select: { id: true } });
  if (!o) return false;
  await prisma.customDesignOrder.update({
    where: { id },
    data: { status, ...(trackingNumber ? { trackingNumber } : {}) },
  });
  return true;
}

// Manually assigned by the manufacturer — custom orders have no existing
// catalog product to look a karigar code up from.
export async function setCustomOrderKarigarCode(manufacturerId: string, id: string, karigarCode: string | null) {
  const o = await prisma.customDesignOrder.findFirst({ where: { id, manufacturerId }, select: { id: true } });
  if (!o) return false;
  await prisma.customDesignOrder.update({ where: { id }, data: { karigarCode } });
  return true;
}
