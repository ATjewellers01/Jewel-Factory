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
  return prisma.favoriteProduct.upsert({
    where: { storeId_branchId_manufacturerProductId: { storeId, branchId, manufacturerProductId } },
    create: { storeId, branchId, manufacturerProductId },
    update: {},
  });
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
