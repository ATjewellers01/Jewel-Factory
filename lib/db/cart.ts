import { Prisma, CartKind } from '@prisma/client';

import { prisma } from '@/lib/prisma';

// Server-backed cart, scoped exactly like FavoriteProduct: (storeId, branchId,
// kind). branchId is null for the Retailer's own B2B cart; a Store Manager's
// kind is KIOSK or RESTOCK. Same account on a different device/browser sees
// the same cart, unlike the old localStorage-only cart.

export async function listCart(storeId: string, branchId: string | null, kind: CartKind) {
  return prisma.cartItem.findMany({
    where: { storeId, branchId, kind },
    orderBy: { createdAt: 'asc' },
    include: {
      manufacturerProduct: {
        omit: { karigarCode: true },
        include: { images: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }] } },
      },
    },
  });
}

export async function addToCart(
  storeId: string,
  branchId: string | null,
  kind: CartKind,
  manufacturerProductId: string,
  quantity = 1,
) {
  const existing = await prisma.cartItem.findFirst({ where: { storeId, branchId, kind, manufacturerProductId } });
  if (existing) {
    return prisma.cartItem.update({ where: { id: existing.id }, data: { quantity: existing.quantity + quantity } });
  }
  try {
    return await prisma.cartItem.create({ data: { storeId, branchId, kind, manufacturerProductId, quantity } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      // Race: another request just inserted the same line — add to it instead.
      const row = await prisma.cartItem.findFirstOrThrow({ where: { storeId, branchId, kind, manufacturerProductId } });
      return prisma.cartItem.update({ where: { id: row.id }, data: { quantity: row.quantity + quantity } });
    }
    throw e;
  }
}

export async function setCartQuantity(
  storeId: string,
  branchId: string | null,
  kind: CartKind,
  manufacturerProductId: string,
  quantity: number,
) {
  if (quantity <= 0) {
    await prisma.cartItem.deleteMany({ where: { storeId, branchId, kind, manufacturerProductId } });
    return null;
  }
  return prisma.cartItem.updateMany({ where: { storeId, branchId, kind, manufacturerProductId }, data: { quantity } });
}

export async function setCartItemPurity(
  storeId: string,
  branchId: string | null,
  kind: CartKind,
  manufacturerProductId: string,
  purity: string,
) {
  return prisma.cartItem.updateMany({ where: { storeId, branchId, kind, manufacturerProductId }, data: { purity } });
}

export async function removeFromCart(
  storeId: string,
  branchId: string | null,
  kind: CartKind,
  manufacturerProductId: string,
) {
  await prisma.cartItem.deleteMany({ where: { storeId, branchId, kind, manufacturerProductId } });
  return true;
}

export async function clearCart(storeId: string, branchId: string | null, kind: CartKind) {
  await prisma.cartItem.deleteMany({ where: { storeId, branchId, kind } });
  await prisma.cartNote.deleteMany({ where: { storeId, branchId, kind } });
}

export async function getCartNote(storeId: string, branchId: string | null, kind: CartKind): Promise<string> {
  const row = await prisma.cartNote.findFirst({ where: { storeId, branchId, kind } });
  return row?.note ?? '';
}

export async function setCartNote(storeId: string, branchId: string | null, kind: CartKind, note: string) {
  const existing = await prisma.cartNote.findFirst({ where: { storeId, branchId, kind } });
  if (existing) {
    return prisma.cartNote.update({ where: { id: existing.id }, data: { note } });
  }
  try {
    return await prisma.cartNote.create({ data: { storeId, branchId, kind, note } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      const row = await prisma.cartNote.findFirstOrThrow({ where: { storeId, branchId, kind } });
      return prisma.cartNote.update({ where: { id: row.id }, data: { note } });
    }
    throw e;
  }
}
