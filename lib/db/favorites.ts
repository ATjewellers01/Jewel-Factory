import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';

// Favorites are scoped by (storeId, branchId). branchId is null for a
// Retailer's own favorites, and set to the branch id for a Store Manager's.
// The two never see each other's list even though a Store Manager's storeId
// equals the retailer's id (branchManagerGuard sets storeId = retailerId).

export async function listFavorites(storeId: string, branchId: string | null) {
  return prisma.favoriteProduct.findMany({
    where: { storeId, branchId },
    orderBy: { createdAt: 'desc' },
    include: {
      manufacturerProduct: {
        omit: { karigarCode: true },
        include: { images: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }] } },
      },
    },
  });
}

export async function addFavorite(storeId: string, branchId: string | null, manufacturerProductId: string) {
  // Prisma's compound-unique `where` shape rejects `null` for a nullable field
  // (even though the column itself allows it), so upsert-by-compound-key isn't
  // usable here — check-then-create instead. Races just hit the real unique
  // index and no-op via P2002, which we swallow (already-favorited is fine).
  const existing = await prisma.favoriteProduct.findFirst({ where: { storeId, branchId, manufacturerProductId } });
  if (existing) return existing;
  try {
    return await prisma.favoriteProduct.create({ data: { storeId, branchId, manufacturerProductId } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return prisma.favoriteProduct.findFirstOrThrow({ where: { storeId, branchId, manufacturerProductId } });
    }
    throw e;
  }
}

export async function removeFavorite(storeId: string, branchId: string | null, manufacturerProductId: string) {
  await prisma.favoriteProduct.deleteMany({ where: { storeId, branchId, manufacturerProductId } });
  return true;
}

export async function listFavoriteIds(storeId: string, branchId: string | null): Promise<string[]> {
  const rows = await prisma.favoriteProduct.findMany({
    where: { storeId, branchId },
    select: { manufacturerProductId: true },
  });
  return rows.map((r) => r.manufacturerProductId);
}
