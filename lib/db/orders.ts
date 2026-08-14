import type { OrderStatus, Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { nextCatalogOrderNumber } from '@/lib/db/order-number';

// ─────────────────────────────────────────────────────────────────────────────
// KIOSK ORDERS (customer, guest)
// ─────────────────────────────────────────────────────────────────────────────

export type KioskItemInput = {
  manufacturerProductId: string | null;
  productNameSnapshot: string;
  productImageSnapshot?: string;
  categorySnapshot?: string;
  quantity: number;
  purity?: string | null;
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
  const orderNum = await nextCatalogOrderNumber(input.manufacturerId);
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
      orderNumber: orderNum,
      totalItems,
      items: {
        create: input.items.map((i) => ({
          manufacturerProductId: i.manufacturerProductId,
          productNameSnapshot: i.productNameSnapshot,
          productImageSnapshot: i.productImageSnapshot ?? null,
          categorySnapshot: i.categorySnapshot ?? null,
          quantity: i.quantity,
          purity: i.purity ?? null,
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
  const orders = await prisma.kioskOrder.findMany({
    where: { storeId, ...(pendingOnly ? { pendingStoreApproval: true, status: { not: 'CANCELLED' } } : {}) },
    orderBy: { createdAt: 'desc' },
    include: { items: true },
  });
  return Promise.all(orders.map(async (o) => ({ ...o, items: await hydrateItemsForStoreManager(o.items) })));
}

export async function getKioskOrderForStore(storeId: string, id: string) {
  const order = await prisma.kioskOrder.findFirst({
    where: { id, storeId },
    include: { items: true, history: { orderBy: { createdAt: 'asc' } } },
  });
  if (!order) return null;
  return { ...order, items: await hydrateItemsForStoreManager(order.items) };
}

export async function approveKioskOrder(storeId: string, id: string, approvedById: string | null, deliveryDate?: Date | null) {
  const o = await prisma.kioskOrder.findFirst({ where: { id, storeId }, select: { id: true } });
  if (!o) return false;
  await prisma.kioskOrder.update({
    where: { id },
    data: {
      pendingStoreApproval: false,
      forwardedToManufacturer: true,
      storeApprovedById: approvedById,
      storeApprovedAt: new Date(),
      ...(deliveryDate !== undefined ? { deliveryDate } : {}),
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
// Store-manager-facing product hydration — never includes karigarCode (that's
// manufacturer-internal only; see hydrateItemsWithProduct for the
// manufacturer-side equivalent that does include it). Uses `select` (a
// whitelist) rather than `omit`, so karigarCode structurally can't leak here
// regardless of future field additions to ManufacturerProduct.
async function hydrateItemsForStoreManager<T extends { manufacturerProductId: string | null }>(
  items: T[],
) {
  const ids = [...new Set(items.map((i) => i.manufacturerProductId).filter((x): x is string => !!x))];
  const products = ids.length
    ? await prisma.manufacturerProduct.findMany({
        where: { id: { in: ids } },
        select: {
          id: true, category: true, subCategory: true, subCategory2: true,
          weightGrams: true, grossWeightGrams: true, netWeightGrams: true, size: true,
          purity: true, description: true, designNumber: true, hasTryon: true,
          images: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }], select: { secureUrl: true, isPrimary: true } },
        },
      })
    : [];
  const byId = new Map(products.map((p) => [p.id, p]));
  return items.map((i) => ({ ...i, product: i.manufacturerProductId ? byId.get(i.manufacturerProductId) ?? null : null }));
}

export async function getKioskOrdersByBranch(branchId: string) {
  const orders = await prisma.kioskOrder.findMany({
    where: { branchId },
    orderBy: { createdAt: 'desc' },
    include: { items: true },
  });
  return Promise.all(orders.map(async (o) => ({ ...o, items: await hydrateItemsForStoreManager(o.items) })));
}
export async function getB2bOrdersByBranch(branchId: string) {
  const orders = await prisma.b2bOrder.findMany({
    where: { branchId },
    orderBy: { createdAt: 'desc' },
    include: { items: true },
  });
  return Promise.all(orders.map(async (o) => ({ ...o, items: await hydrateItemsForStoreManager(o.items) })));
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
  const orders = await prisma.kioskOrder.findMany({
    where: { manufacturerId, pendingStoreApproval: false, forwardedToManufacturer: true },
    orderBy: { createdAt: 'desc' },
    include: { items: { select: { manufacturerProductId: true, quantity: true, status: true } } },
  });
  const allIds = [...new Set(orders.flatMap((o) => o.items.map((i) => i.manufacturerProductId).filter((x): x is string => !!x)))];
  const karigarByProductId = allIds.length
    ? new Map(
        (await prisma.manufacturerProduct.findMany({ where: { id: { in: allIds } }, select: { id: true, karigarCode: true } }))
          .map((p) => [p.id, p.karigarCode]),
      )
    : new Map<string, string | null>();
  return orders.map(({ items, ...o }) => ({
    ...o,
    karigarCodes: [...new Set(items.map((i) => i.manufacturerProductId && karigarByProductId.get(i.manufacturerProductId)).filter((x): x is string => !!x))],
    totalQuantity: items.reduce((sum, i) => sum + i.quantity, 0),
    // "Pending" = items whose own per-line status is still PENDING (the
    // Order Stage shown per row), not whether a Karigar has been assigned —
    // an item can be Karigar-assigned (customisedOrderId set) yet still sit
    // at PENDING until the manufacturer advances its status.
    pendingQuantity: items.filter((i) => i.status === 'PENDING').reduce((sum, i) => sum + i.quantity, 0),
  }));
}

export async function getKioskOrderForManufacturer(manufacturerId: string, id: string) {
  const order = await prisma.kioskOrder.findFirst({
    where: { id, manufacturerId, forwardedToManufacturer: true },
    include: { items: true, history: { orderBy: { createdAt: 'asc' } } },
  });
  if (!order) return null;
  return { ...order, items: await hydrateItemsWithProduct(order.items) };
}

// Manufacturer-only: join order-item snapshots (manufacturerProductId, no FK)
// back to the live ManufacturerProduct for karigarCode + full spec detail.
// karigarCode is manufacturer-internal — this join is only ever used on
// manufacturer-facing routes, never retailer/store-manager ones.
async function hydrateItemsWithProduct<T extends { manufacturerProductId: string | null }>(
  items: T[],
): Promise<Array<T & { product: null | { karigarCode: string | null; category: string | null; subCategory: string | null; subCategory2: string | null; weightGrams: unknown; grossWeightGrams: unknown; netWeightGrams: unknown; pieces: number; size: string | null; purity: string | null; description: string | null; designNumber: string; images: { secureUrl: string; isPrimary: boolean }[] } }>> {
  const ids = [...new Set(items.map((i) => i.manufacturerProductId).filter((x): x is string => !!x))];
  if (ids.length === 0) return items.map((i) => ({ ...i, product: null }));
  const products = await prisma.manufacturerProduct.findMany({
    where: { id: { in: ids } },
    select: {
      id: true, karigarCode: true, category: true, subCategory: true, subCategory2: true,
      weightGrams: true, grossWeightGrams: true, netWeightGrams: true, pieces: true, size: true,
      purity: true, description: true, designNumber: true,
      images: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }], select: { secureUrl: true, isPrimary: true } },
    },
  });
  const byId = new Map(products.map((p) => [p.id, p]));
  return items.map((i) => ({ ...i, product: i.manufacturerProductId ? byId.get(i.manufacturerProductId) ?? null : null }));
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

// Per-line-item status — an order can have products at different stages.
// Scoped by manufacturerId through the parent order so a manufacturer can't
// touch another manufacturer's item by guessing an item id.
export async function advanceKioskOrderItemStatus(manufacturerId: string, orderId: string, itemId: string, status: OrderStatus) {
  const item = await prisma.kioskOrderItem.findFirst({
    where: { id: itemId, orderId, order: { manufacturerId } },
    select: { id: true },
  });
  if (!item) return false;
  await prisma.kioskOrderItem.update({ where: { id: itemId }, data: { status } });
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
  // Optional — set when the Retailer Admin places this order directly.
  deliveryDate?: Date | null;
  // Store-Manager-originated orders need the Retailer (Head Office) to approve
  // (defaults true). The Retailer's own direct catalog order has no one above
  // it to approve, so its route passes false — pre-approved, goes straight to
  // the manufacturer queue.
  pendingManagerApproval?: boolean;
  items: { manufacturerProductId: string; quantity: number; productNameSnapshot?: string; productImageSnapshot?: string; productDesignSnapshot?: string; purity?: string | null }[];
}) {
  const totalItems = input.items.reduce((s, i) => s + i.quantity, 0);
  const preApproved = input.pendingManagerApproval === false;
  const orderNum = await nextCatalogOrderNumber(input.manufacturerId);
  return prisma.b2bOrder.create({
    data: {
      storeId: input.storeId,
      manufacturerId: input.manufacturerId,
      branchId: input.branchId ?? null,
      branchNameSnapshot: input.branchNameSnapshot ?? null,
      orderNumber: orderNum,
      deliveryAddress: input.deliveryAddress,
      notes: input.notes ?? null,
      requirementNote: input.requirementNote ?? null,
      deliveryDate: input.deliveryDate ?? null,
      totalItems,
      ...(preApproved ? { pendingManagerApproval: false, managerApprovedAt: new Date() } : {}),
      items: {
        create: input.items.map((i) => ({
          manufacturerProductId: i.manufacturerProductId,
          quantity: i.quantity,
          productNameSnapshot: i.productNameSnapshot ?? null,
          productImageSnapshot: i.productImageSnapshot ?? null,
          productDesignSnapshot: i.productDesignSnapshot ?? null,
          purity: i.purity ?? null,
        })),
      },
      history: { create: { status: 'PENDING', note: preApproved ? 'Order placed (auto-approved — placed directly by Retailer)' : 'Order placed' } },
    },
    select: { id: true, orderNumber: true },
  });
}

export async function getB2bOrdersByStore(storeId: string, pendingOnly = false) {
  const orders = await prisma.b2bOrder.findMany({
    where: { storeId, ...(pendingOnly ? { pendingManagerApproval: true, status: { not: 'CANCELLED' } } : {}) },
    orderBy: { createdAt: 'desc' },
    include: { items: true },
  });
  return Promise.all(orders.map(async (o) => ({ ...o, items: await hydrateItemsForStoreManager(o.items) })));
}

export async function getB2bOrderForStore(storeId: string, id: string) {
  const order = await prisma.b2bOrder.findFirst({
    where: { id, storeId },
    include: { items: true, history: { orderBy: { createdAt: 'asc' } } },
  });
  if (!order) return null;
  return { ...order, items: await hydrateItemsForStoreManager(order.items) };
}

export async function approveB2bOrder(storeId: string, id: string, approvedById: string | null, deliveryDate?: Date | null) {
  const o = await prisma.b2bOrder.findFirst({ where: { id, storeId }, select: { id: true } });
  if (!o) return false;
  await prisma.b2bOrder.update({
    where: { id },
    data: {
      pendingManagerApproval: false,
      managerApprovedById: approvedById,
      managerApprovedAt: new Date(),
      ...(deliveryDate !== undefined ? { deliveryDate } : {}),
    },
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

// Manufacturer view (approved only). Only the store's business NAME is
// exposed (client wants to identify who placed the order) — city/branch
// name stay hidden, and the manufacturer still ships to the order's own
// delivery address, not by looking up the store (2026-08-05).
export async function getB2bOrdersByManufacturer(manufacturerId: string) {
  const rows = await prisma.b2bOrder.findMany({
    where: { manufacturerId, pendingManagerApproval: false },
    orderBy: { createdAt: 'desc' },
    include: {
      store: { select: { name: true } },
      items: { select: { quantity: true, status: true, manufacturerProduct: { select: { karigarCode: true } } } },
    },
  });
  return rows.map(({ items, store, ...o }) => ({
    ...o,
    storeName: store?.name ?? null,
    karigarCodes: [...new Set(items.map((i) => i.manufacturerProduct.karigarCode).filter((x): x is string => !!x))],
    totalQuantity: items.reduce((sum, i) => sum + i.quantity, 0),
    // "Pending" = items whose own per-line status is still PENDING (the
    // Order Stage shown per row), not whether a Karigar has been assigned —
    // see the matching note on getKioskOrdersByManufacturer.
    pendingQuantity: items.filter((i) => i.status === 'PENDING').reduce((sum, i) => sum + i.quantity, 0),
  }));
}

export async function getB2bOrderForManufacturer(manufacturerId: string, id: string) {
  const o = await prisma.b2bOrder.findFirst({
    where: { id, manufacturerId, pendingManagerApproval: false },
    include: {
      items: {
        include: {
          manufacturerProduct: {
            select: {
              id: true, karigarCode: true, category: true, subCategory: true, subCategory2: true,
              weightGrams: true, grossWeightGrams: true, netWeightGrams: true, pieces: true,
              purity: true, description: true, designNumber: true,
              images: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }], select: { secureUrl: true, isPrimary: true } },
            },
          },
        },
      },
      history: { orderBy: { createdAt: 'asc' } },
      store: { select: { name: true } },
    },
  });
  if (!o) return null;
  const { store, ...safe } = o;
  return { ...safe, storeName: store?.name ?? null };
}

export async function advanceB2bOrderStatus(manufacturerId: string, id: string, status: OrderStatus, trackingNumber?: string) {
  const o = await prisma.b2bOrder.findFirst({ where: { id, manufacturerId }, select: { id: true } });
  if (!o) return false;
  await prisma.$transaction([
    prisma.b2bOrder.update({ where: { id }, data: { status, ...(trackingNumber ? { trackingNumber } : {}) } }),
    prisma.b2bOrderStatusHistory.create({ data: { orderId: id, status } }),
  ]);
  // On completion, materialize into store inventory (fulfillment).
  if (status === 'COMPLETED') await fulfillB2bOrder(id);
  return true;
}

// Per-line-item status — see the matching note on advanceKioskOrderItemStatus.
export async function advanceB2bOrderItemStatus(manufacturerId: string, orderId: string, itemId: string, status: OrderStatus) {
  const item = await prisma.b2bOrderItem.findFirst({
    where: { id: itemId, orderId, order: { manufacturerId } },
    select: { id: true },
  });
  if (!item) return false;
  await prisma.b2bOrderItem.update({ where: { id: itemId }, data: { status } });
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
      const slug = `${slugify(mp.name ?? mp.designNumber)}-${mp.designNumber.toLowerCase()}`;
      const created = await tx.product.create({
        data: {
          storeId: order.storeId,
          manufacturerProductId: mp.id,
          slug,
          name: mp.name ?? mp.designNumber,
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
