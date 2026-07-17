import type { CustomOrderStatus } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { formatStoreAddress } from '@/lib/db/stores';

function orderNumber(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const suffix =
    (Date.now() % 10000).toString().padStart(4, '0') +
    Math.random().toString(36).slice(2, 6).toUpperCase();
  return `CD-${date}-${suffix}`;
}

// ── Kiosk: customer submits a request (has PII) ───────────────────────────────

export async function placeCustomRequest(input: {
  storeId: string;
  branchId?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  customerNotes?: string;
  referenceImageUrl?: string;
  referenceImagePublicId?: string;
  category: string;
  weightGrams?: number;
  purity?: string;
  designNotes?: string;
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
      category: input.category,
      weightGrams: input.weightGrams ?? null,
      purity: input.purity ?? null,
      designNotes: input.designNotes ?? null,
    },
    select: { id: true },
  });
}

// ── Store/manager: list + approve (forward) / reject ──────────────────────────

export async function listCustomRequests(storeId: string) {
  // Include the downstream order so the manager sees the manufacturer's live status.
  return prisma.customDesignRequest.findMany({
    where: { storeId },
    orderBy: { createdAt: 'desc' },
    include: {
      order: { select: { id: true, status: true, orderNumber: true, trackingNumber: true } },
    },
  });
}

export async function getCustomRequestForStore(storeId: string, id: string) {
  return prisma.customDesignRequest.findFirst({ where: { id, storeId } });
}

// Store Manager: custom requests for THIS branch (their own view) + mfr status.
export async function getCustomRequestsByBranch(branchId: string) {
  return prisma.customDesignRequest.findMany({
    where: { branchId },
    orderBy: { createdAt: 'desc' },
    include: { order: { select: { id: true, status: true, orderNumber: true, trackingNumber: true } } },
  });
}

// Store Manager marks a custom request Completed (piece delivered to customer).
export async function markCustomCompleted(branchId: string, id: string) {
  const r = await prisma.customDesignRequest.findFirst({ where: { id, branchId }, select: { id: true } });
  if (!r) return false;
  await prisma.customDesignRequest.update({ where: { id }, data: { completedAt: new Date() } });
  return true;
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

  await prisma.$transaction(async (tx) => {
    await tx.customDesignOrder.create({
      data: {
        requestId,
        manufacturerId: store.manufacturerId!,
        storeId,
        storeNameSnapshot: store.name,
        storeAddressSnapshot: formatStoreAddress(store),
        category: req.category,
        weightGrams: req.weightGrams,
        purity: req.purity,
        referenceImageUrl: req.referenceImageUrl,
        designNotes: req.designNotes,
        orderNumber: orderNumber(),
      },
    });
    await tx.customDesignRequest.update({
      where: { id: requestId },
      data: { status: 'FORWARDED', reviewedById, reviewedAt: new Date() },
    });
  });
  return { ok: true as const };
}

export async function rejectCustomRequest(storeId: string, requestId: string, reviewedById: string | null, reason?: string) {
  const req = await prisma.customDesignRequest.findFirst({ where: { id: requestId, storeId }, select: { id: true } });
  if (!req) return false;
  await prisma.customDesignRequest.update({
    where: { id: requestId },
    data: { status: 'REJECTED', reviewedById, reviewedAt: new Date(), rejectionReason: reason ?? null },
  });
  return true;
}

// ── Manufacturer: list + advance status (sanitized, no PII) ───────────────────

export async function listCustomOrdersByManufacturer(manufacturerId: string) {
  return prisma.customDesignOrder.findMany({
    where: { manufacturerId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, orderNumber: true, storeNameSnapshot: true, storeAddressSnapshot: true,
      category: true, weightGrams: true, purity: true, referenceImageUrl: true, designNotes: true,
      status: true, trackingNumber: true, createdAt: true,
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
