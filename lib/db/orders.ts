import type { OrderStatus, Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';

// High-entropy order number (no same-second collision).
function orderNumber(prefix: string): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const suffix =
    (Date.now() % 10000).toString().padStart(4, '0') +
    Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${date}-${suffix}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// KIOSK ORDERS (customer, guest)
// ─────────────────────────────────────────────────────────────────────────────

export type KioskItemInput = {
  manufacturerProductId: string | null;
  productNameSnapshot: string;
  productImageSnapshot?: string;
  categorySnapshot?: string;
  quantity: number;
};

export async function placeKioskOrder(input: {
  storeId: string;
  manufacturerId: string;
  branchId?: string | null;
  branchNameSnapshot?: string | null;
  storeNameSnapshot: string;
  storeCitySnapshot?: string;
  storePhoneSnapshot?: string;
  storeEmailSnapshot?: string;
  customerName?: string | null;
  customerPhone?: string | null;
  customerEmail?: string;
  deliveryAddress?: string;
  pickupStore: boolean;
  notes?: string;
  requirementNote?: string | null;
  items: KioskItemInput[];
}) {
  const totalItems = input.items.reduce((s, i) => s + i.quantity, 0);
  return prisma.kioskOrder.create({
    data: {
      storeId: input.storeId,
      manufacturerId: input.manufacturerId,
      branchId: input.branchId ?? null,
      branchNameSnapshot: input.branchNameSnapshot ?? null,
      storeNameSnapshot: input.storeNameSnapshot,
      storeCitySnapshot: input.storeCitySnapshot ?? null,
      storePhoneSnapshot: input.storePhoneSnapshot ?? null,
      storeEmailSnapshot: input.storeEmailSnapshot ?? null,
      customerName: input.customerName ?? null,
      customerPhone: input.customerPhone ?? null,
      customerEmail: input.customerEmail ?? null,
      deliveryAddress: input.pickupStore ? null : (input.deliveryAddress ?? null),
      pickupStore: input.pickupStore,
      notes: input.notes ?? null,
      requirementNote: input.requirementNote ?? null,
      orderNumber: orderNumber('GK'),
      totalItems,
      items: {
        create: input.items.map((i) => ({
          manufacturerProductId: i.manufacturerProductId,
          productNameSnapshot: i.productNameSnapshot,
          productImageSnapshot: i.productImageSnapshot ?? null,
          categorySnapshot: i.categorySnapshot ?? null,
          quantity: i.quantity,
        })),
      },
      history: { create: { status: 'PENDING', note: 'Order placed at kiosk', changedBy: 'system' } },
    },
    select: { id: true, orderNumber: true },
  });
}

export async function getKioskOrderPublic(id: string) {
  const o = await prisma.kioskOrder.findUnique({
    where: { id },
    select: {
      id: true, orderNumber: true, status: true, customerName: true,
      pickupStore: true, totalItems: true, createdAt: true,
      items: { select: { productNameSnapshot: true, productImageSnapshot: true, quantity: true } },
    },
  });
  return o;
}

export async function getKioskOrdersByStore(storeId: string, pendingOnly = false) {
  return prisma.kioskOrder.findMany({
    where: { storeId, ...(pendingOnly ? { pendingStoreApproval: true, status: { not: 'CANCELLED' } } : {}) },
    orderBy: { createdAt: 'desc' },
    include: { items: true },
  });
}

export async function getKioskOrderForStore(storeId: string, id: string) {
  return prisma.kioskOrder.findFirst({
    where: { id, storeId },
    include: { items: true, history: { orderBy: { createdAt: 'asc' } } },
  });
}

export async function approveKioskOrder(storeId: string, id: string, approvedById: string | null) {
  const o = await prisma.kioskOrder.findFirst({ where: { id, storeId }, select: { id: true } });
  if (!o) return false;
  await prisma.kioskOrder.update({
    where: { id },
    data: {
      pendingStoreApproval: false,
      forwardedToManufacturer: true,
      storeApprovedById: approvedById,
      storeApprovedAt: new Date(),
    },
  });
  return true;
}

export async function rejectKioskOrder(storeId: string, id: string) {
  const o = await prisma.kioskOrder.findFirst({ where: { id, storeId }, select: { id: true } });
  if (!o) return false;
  await prisma.kioskOrder.update({
    where: { id },
    data: { status: 'CANCELLED', pendingStoreApproval: false },
  });
  return true;
}

// Store Manager: kiosk/B2B orders for THIS branch (their own orders view).
export async function getKioskOrdersByBranch(branchId: string) {
  return prisma.kioskOrder.findMany({
    where: { branchId },
    orderBy: { createdAt: 'desc' },
    include: { items: true },
  });
}
export async function getB2bOrdersByBranch(branchId: string) {
  return prisma.b2bOrder.findMany({
    where: { branchId },
    orderBy: { createdAt: 'desc' },
    include: { items: true },
  });
}

// Store Manager marks a kiosk/B2B order Completed (piece reached customer/store).
export async function markKioskCompleted(branchId: string, id: string) {
  const o = await prisma.kioskOrder.findFirst({ where: { id, branchId }, select: { id: true } });
  if (!o) return false;
  await prisma.kioskOrder.update({ where: { id }, data: { completedAt: new Date() } });
  return true;
}
export async function markB2bCompleted(branchId: string, id: string) {
  const o = await prisma.b2bOrder.findFirst({ where: { id, branchId }, select: { id: true } });
  if (!o) return false;
  await prisma.b2bOrder.update({ where: { id }, data: { completedAt: new Date() } });
  return true;
}

// Edit the requirement note on a kiosk order (HO manager, before/around approval).
export async function updateKioskRequirementNote(storeId: string, id: string, note: string | null) {
  const o = await prisma.kioskOrder.findFirst({ where: { id, storeId }, select: { id: true } });
  if (!o) return false;
  await prisma.kioskOrder.update({ where: { id }, data: { requirementNote: note } });
  return true;
}

// Manufacturer view (approved only) — customer PII stripped in the route layer.
export async function getKioskOrdersByManufacturer(manufacturerId: string) {
  return prisma.kioskOrder.findMany({
    where: { manufacturerId, pendingStoreApproval: false, forwardedToManufacturer: true },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getKioskOrderForManufacturer(manufacturerId: string, id: string) {
  return prisma.kioskOrder.findFirst({
    where: { id, manufacturerId, forwardedToManufacturer: true },
    include: { items: true, history: { orderBy: { createdAt: 'asc' } } },
  });
}

export async function advanceKioskOrderStatus(manufacturerId: string, id: string, status: OrderStatus, trackingNumber?: string) {
  const o = await prisma.kioskOrder.findFirst({ where: { id, manufacturerId }, select: { id: true } });
  if (!o) return false;
  await prisma.$transaction([
    prisma.kioskOrder.update({
      where: { id },
      data: { status, ...(trackingNumber ? { trackingNumber } : {}) },
    }),
    prisma.kioskOrderStatusHistory.create({
      data: { orderId: id, status, changedBy: 'manufacturer' },
    }),
  ]);
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// B2B ORDERS (store restock)
// ─────────────────────────────────────────────────────────────────────────────

export async function placeB2bOrder(input: {
  storeId: string;
  manufacturerId: string;
  branchId?: string | null;
  branchNameSnapshot?: string | null;
  deliveryAddress: string;
  notes?: string;
  requirementNote?: string | null;
  items: { manufacturerProductId: string; quantity: number; productNameSnapshot?: string; productImageSnapshot?: string; productDesignSnapshot?: string }[];
}) {
  const totalItems = input.items.reduce((s, i) => s + i.quantity, 0);
  return prisma.b2bOrder.create({
    data: {
      storeId: input.storeId,
      manufacturerId: input.manufacturerId,
      branchId: input.branchId ?? null,
      branchNameSnapshot: input.branchNameSnapshot ?? null,
      orderNumber: orderNumber('B2B'),
      deliveryAddress: input.deliveryAddress,
      notes: input.notes ?? null,
      requirementNote: input.requirementNote ?? null,
      totalItems,
      items: {
        create: input.items.map((i) => ({
          manufacturerProductId: i.manufacturerProductId,
          quantity: i.quantity,
          productNameSnapshot: i.productNameSnapshot ?? null,
          productImageSnapshot: i.productImageSnapshot ?? null,
          productDesignSnapshot: i.productDesignSnapshot ?? null,
        })),
      },
      history: { create: { status: 'PENDING', note: 'Order placed' } },
    },
    select: { id: true, orderNumber: true },
  });
}

export async function getB2bOrdersByStore(storeId: string, pendingOnly = false) {
  return prisma.b2bOrder.findMany({
    where: { storeId, ...(pendingOnly ? { pendingManagerApproval: true, status: { not: 'CANCELLED' } } : {}) },
    orderBy: { createdAt: 'desc' },
    include: { items: true },
  });
}

export async function getB2bOrderForStore(storeId: string, id: string) {
  return prisma.b2bOrder.findFirst({
    where: { id, storeId },
    include: { items: true, history: { orderBy: { createdAt: 'asc' } } },
  });
}

export async function approveB2bOrder(storeId: string, id: string, approvedById: string | null) {
  const o = await prisma.b2bOrder.findFirst({ where: { id, storeId }, select: { id: true } });
  if (!o) return false;
  await prisma.b2bOrder.update({
    where: { id },
    data: { pendingManagerApproval: false, managerApprovedById: approvedById, managerApprovedAt: new Date() },
  });
  return true;
}

export async function rejectB2bOrder(storeId: string, id: string) {
  const o = await prisma.b2bOrder.findFirst({ where: { id, storeId }, select: { id: true } });
  if (!o) return false;
  await prisma.b2bOrder.update({ where: { id }, data: { status: 'CANCELLED', pendingManagerApproval: false } });
  return true;
}

// Edit the requirement note on a B2B/restock order (HO manager).
export async function updateB2bRequirementNote(storeId: string, id: string, note: string | null) {
  const o = await prisma.b2bOrder.findFirst({ where: { id, storeId }, select: { id: true } });
  if (!o) return false;
  await prisma.b2bOrder.update({ where: { id }, data: { requirementNote: note } });
  return true;
}

// Manufacturer view (approved only) with store name joined.
export async function getB2bOrdersByManufacturer(manufacturerId: string) {
  const rows = await prisma.b2bOrder.findMany({
    where: { manufacturerId, pendingManagerApproval: false },
    orderBy: { createdAt: 'desc' },
    include: { store: { select: { name: true, city: true } } },
  });
  return rows.map((o) => ({ ...o, storeName: o.store?.name ?? null, storeCity: o.store?.city ?? null }));
}

export async function getB2bOrderForManufacturer(manufacturerId: string, id: string) {
  const o = await prisma.b2bOrder.findFirst({
    where: { id, manufacturerId, pendingManagerApproval: false },
    include: {
      items: true,
      history: { orderBy: { createdAt: 'asc' } },
      store: { select: { name: true, city: true } },
    },
  });
  if (!o) return null;
  return { ...o, storeName: o.store?.name ?? null, storeCity: o.store?.city ?? null };
}

export async function advanceB2bOrderStatus(manufacturerId: string, id: string, status: OrderStatus, trackingNumber?: string) {
  const o = await prisma.b2bOrder.findFirst({ where: { id, manufacturerId }, select: { id: true } });
  if (!o) return false;
  await prisma.$transaction([
    prisma.b2bOrder.update({ where: { id }, data: { status, ...(trackingNumber ? { trackingNumber } : {}) } }),
    prisma.b2bOrderStatusHistory.create({ data: { orderId: id, status } }),
  ]);
  // On delivery, materialize into store inventory (fulfillment).
  if (status === 'DELIVERED') await fulfillB2bOrder(id);
  return true;
}

// ── Fulfillment: copy manufacturer products into the store's retail catalog ────

async function fulfillB2bOrder(orderId: string) {
  const order = await prisma.b2bOrder.findUnique({
    where: { id: orderId },
    include: {
      items: { include: { manufacturerProduct: { include: { images: true, tryonAssets: { where: { isActive: true } } } } } },
    },
  });
  if (!order || order.fulfilledAt) return;

  await prisma.$transaction(async (tx) => {
    const newIds: string[] = [];
    for (const item of order.items) {
      const mp = item.manufacturerProduct;
      // If already fulfilled for this store, bump stock instead of duplicating.
      const existing = await tx.product.findFirst({
        where: { storeId: order.storeId, manufacturerProductId: mp.id },
        select: { id: true },
      });
      if (existing) {
        await tx.product.update({ where: { id: existing.id }, data: { stockCount: { increment: item.quantity } } });
        newIds.push(existing.id);
        continue;
      }
      const slug = `${slugify(mp.name)}-${mp.designNumber.toLowerCase()}`;
      const created = await tx.product.create({
        data: {
          storeId: order.storeId,
          manufacturerProductId: mp.id,
          slug,
          name: mp.name,
          category: mp.category,
          description: mp.description,
          purity: mp.purity,
          weightGrams: mp.weightGrams as unknown as Prisma.Decimal | null,
          gemstones: mp.gemstones,
          occasionTags: mp.occasionTags,
          styleTags: mp.styleTags,
          stockCount: item.quantity,
          images: {
            create: mp.images.map((img, idx) => ({
              cloudinaryPublicId: img.cloudinaryPublicId,
              url: img.secureUrl,
              isPrimary: img.isPrimary,
              sortOrder: idx,
            })),
          },
        },
        select: { id: true },
      });
      // copy try-on asset if any
      if (mp.tryonAssets[0]) {
        const t = mp.tryonAssets[0];
        await tx.tryonAsset.create({
          data: {
            productId: created.id,
            cloudinaryPublicId: t.cloudinaryPublicId,
            assetUrl: t.assetUrl,
            jewelleryType: t.jewelleryType,
            pivotX: t.pivotX, pivotY: t.pivotY, xOffset: t.xOffset, yOffset: t.yOffset,
            scaleMultiplier: t.scaleMultiplier, rotationOffsetDeg: t.rotationOffsetDeg,
          },
        });
      }
      newIds.push(created.id);
    }
    await tx.b2bOrder.update({
      where: { id: orderId },
      data: { fulfilledAt: new Date(), fulfilledProductIds: newIds },
    });
  });
}

function slugify(v: string): string {
  return v.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'item';
}
