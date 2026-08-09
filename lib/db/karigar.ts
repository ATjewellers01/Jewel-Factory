import { prisma } from '@/lib/prisma';
import { nextKarigarOrderNumber } from '@/lib/db/order-number';
import { formatStoreAddress } from '@/lib/db/stores';

// ── Karigar master-list (manufacturer-scoped) ──────────────────────────────────
// Backs a shared, syncable Karigar-code dropdown: adding/removing a code here
// is reflected everywhere it's used, instead of a free-text string repeated
// per row. Scoped per order-view by the caller (only codes actually present
// among that order's items), not the full manufacturer list.

export async function listKarigars(manufacturerId: string) {
  return prisma.karigar.findMany({ where: { manufacturerId }, orderBy: { code: 'asc' } });
}

export async function addKarigar(manufacturerId: string, code: string) {
  const trimmed = code.trim();
  const existing = await prisma.karigar.findFirst({ where: { manufacturerId, code: trimmed } });
  if (existing) return existing;
  return prisma.karigar.create({ data: { manufacturerId, code: trimmed } });
}

// Removing a Karigar clears the reference on any CustomDesignOrder using it
// (onDelete: SetNull in the schema) rather than blocking the delete — the
// order itself isn't touched, only its Karigar link.
export async function removeKarigar(manufacturerId: string, id: string) {
  const result = await prisma.karigar.deleteMany({ where: { id, manufacturerId } });
  return result.count > 0;
}

// ── Karigar-code filter, scoped to one Catalog/Kiosk order's items ────────────
// Used by the "Filter by Karigar Code" dropdown — only codes actually present
// among this order's items, not the full manufacturer list.

export async function listKarigarCodesForB2bOrder(orderId: string): Promise<string[]> {
  const items = await prisma.b2bOrderItem.findMany({
    where: { orderId },
    select: { manufacturerProduct: { select: { karigarCode: true } } },
  });
  return [...new Set(items.map((i) => i.manufacturerProduct.karigarCode).filter((c): c is string => !!c))];
}

export async function listKarigarCodesForKioskOrder(orderId: string): Promise<string[]> {
  const items = await prisma.kioskOrderItem.findMany({
    where: { orderId, manufacturerProductId: { not: null } },
    select: { manufacturerProductId: true },
  });
  const productIds = [...new Set(items.map((i) => i.manufacturerProductId).filter((x): x is string => !!x))];
  if (productIds.length === 0) return [];
  const products = await prisma.manufacturerProduct.findMany({
    where: { id: { in: productIds } },
    select: { karigarCode: true },
  });
  return [...new Set(products.map((p) => p.karigarCode).filter((c): c is string => !!c))];
}

// ── Assign a Karigar to a subset of an order's items ──────────────────────────
// Creates a new CustomDesignOrder (JFC-####) covering exactly the given items,
// links each item to it (customisedOrderId), and advances those items'
// status to IN_PROCESS immediately (per the client: status changes on
// Submit, not on PDF generation — Phase 1 has no form/PDF yet, so this
// covers the bare assignment; Phase 2 replaces the auto-fill fields once the
// full form exists).
//
// karigarDeliveryDate (the Karigar PDF's date — a 3-day production buffer
// before the client's own delivery date) is computed here from the source
// order's own deliveryDate, so it can't drift out of sync with the field it
// derives from.
function minusDays(date: Date | null, days: number): Date | null {
  if (!date) return null;
  const d = new Date(date);
  d.setDate(d.getDate() - days);
  return d;
}

export async function assignKarigarToB2bItems(input: {
  manufacturerId: string;
  b2bOrderId: string;
  itemIds: string[];
  karigarId: string | null;
  karigarCode: string | null;
}) {
  const order = await prisma.b2bOrder.findFirst({
    where: { id: input.b2bOrderId, manufacturerId: input.manufacturerId },
    select: {
      storeId: true, deliveryDate: true, requirementNote: true, branchNameSnapshot: true,
      store: { select: { name: true, addressStreet: true, addressLandmark: true, addressCity: true, addressState: true, addressPincode: true } },
    },
  });
  if (!order) return null;

  const items = await prisma.b2bOrderItem.findMany({
    where: { id: { in: input.itemIds }, orderId: input.b2bOrderId },
    include: { manufacturerProduct: { select: { category: true, subCategory: true, weightGrams: true, purity: true } } },
  });
  if (items.length === 0) return null;

  const totalQty = items.reduce((sum, i) => sum + i.quantity, 0);
  const anchor = items[0]!.manufacturerProduct;
  const orderNumber = await nextKarigarOrderNumber(input.manufacturerId);

  return prisma.$transaction(async (tx) => {
    const created = await tx.customDesignOrder.create({
      data: {
        manufacturerId: input.manufacturerId,
        storeId: order.storeId,
        sourceB2bOrderId: input.b2bOrderId,
        storeNameSnapshot: order.store.name,
        storeAddressSnapshot: formatStoreAddress(order.store),
        category: anchor?.category ?? '',
        subCategory: anchor?.subCategory ?? null,
        weightGramsMin: anchor?.weightGrams ?? null,
        weightGramsMax: anchor?.weightGrams ?? null,
        purity: anchor?.purity ?? null,
        quantity: String(totalQty),
        deliveryDate: order.deliveryDate,
        karigarDeliveryDate: minusDays(order.deliveryDate, 3),
        karigarId: input.karigarId,
        karigarCode: input.karigarCode,
        designNotes: order.requirementNote,
        orderNumber,
        status: 'IN_PROCESS',
      },
    });
    await tx.b2bOrderItem.updateMany({
      where: { id: { in: input.itemIds } },
      data: { customisedOrderId: created.id, status: 'IN_PROCESS' },
    });
    return created;
  });
}

export async function assignKarigarToKioskItems(input: {
  manufacturerId: string;
  kioskOrderId: string;
  itemIds: string[];
  karigarId: string | null;
  karigarCode: string | null;
}) {
  const order = await prisma.kioskOrder.findFirst({
    where: { id: input.kioskOrderId, manufacturerId: input.manufacturerId },
    select: {
      storeId: true, deliveryDate: true, requirementNote: true,
      store: { select: { name: true, addressStreet: true, addressLandmark: true, addressCity: true, addressState: true, addressPincode: true } },
    },
  });
  if (!order) return null;

  const items = await prisma.kioskOrderItem.findMany({
    where: { id: { in: input.itemIds }, orderId: input.kioskOrderId },
  });
  if (items.length === 0) return null;
  const productIds = [...new Set(items.map((i) => i.manufacturerProductId).filter((x): x is string => !!x))];
  const anchorProduct = productIds.length
    ? await prisma.manufacturerProduct.findUnique({
        where: { id: productIds[0]! },
        select: { category: true, subCategory: true, weightGrams: true, purity: true },
      })
    : null;

  const totalQty = items.reduce((sum, i) => sum + i.quantity, 0);
  const orderNumber = await nextKarigarOrderNumber(input.manufacturerId);

  return prisma.$transaction(async (tx) => {
    const created = await tx.customDesignOrder.create({
      data: {
        manufacturerId: input.manufacturerId,
        storeId: order.storeId,
        sourceKioskOrderId: input.kioskOrderId,
        storeNameSnapshot: order.store.name,
        storeAddressSnapshot: formatStoreAddress(order.store),
        category: anchorProduct?.category ?? items[0]!.categorySnapshot ?? '',
        subCategory: anchorProduct?.subCategory ?? null,
        weightGramsMin: anchorProduct?.weightGrams ?? null,
        weightGramsMax: anchorProduct?.weightGrams ?? null,
        purity: anchorProduct?.purity ?? null,
        quantity: String(totalQty),
        deliveryDate: order.deliveryDate,
        karigarDeliveryDate: minusDays(order.deliveryDate, 3),
        karigarId: input.karigarId,
        karigarCode: input.karigarCode,
        designNotes: order.requirementNote,
        orderNumber,
        status: 'IN_PROCESS',
      },
    });
    await tx.kioskOrderItem.updateMany({
      where: { id: { in: input.itemIds } },
      data: { customisedOrderId: created.id, status: 'IN_PROCESS' },
    });
    return created;
  });
}
