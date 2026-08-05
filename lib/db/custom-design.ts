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

// ── Manufacturer: list + advance status (sanitized, no PII, no store identity) ─
// storeNameSnapshot is intentionally NOT selected — the manufacturer ships to
// storeAddressSnapshot, not to a named retailer (see CLAUDE.md 2026-08-05).

export async function listCustomOrdersByManufacturer(manufacturerId: string) {
  return prisma.customDesignOrder.findMany({
    where: { manufacturerId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, orderNumber: true, storeAddressSnapshot: true,
      category: true, subCategory: true, weightGramsMin: true, weightGramsMax: true, purity: true,
      referenceImageUrl: true, referenceImageUrls: true, designNotes: true,
      orderRef: true, deliveryDate: true, quantity: true, meena: true,
      length: true, size: true, broadness: true, screw: true, sampleWeightGrams: true,
      status: true, trackingNumber: true, karigarCode: true, createdAt: true,
    },
  });
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
