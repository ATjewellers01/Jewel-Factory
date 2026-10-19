import { prisma } from '@/lib/prisma';

export async function getManufacturerDashboard(manufacturerId: string) {
  const [totalDesigns, activeDesigns, pendingB2b, pendingKiosk, pendingRegistrations, activeStores, recentB2b] =
    await Promise.all([
      prisma.manufacturerProduct.count({ where: { manufacturerId } }),
      prisma.manufacturerProduct.count({ where: { manufacturerId, status: 'ACTIVE' } }),
      prisma.b2bOrder.count({ where: { manufacturerId, status: 'PENDING', pendingManagerApproval: false } }),
      prisma.kioskOrder.count({ where: { manufacturerId, status: 'PENDING', pendingStoreApproval: false } }),
      prisma.store.count({ where: { manufacturerId: null, registrationStatus: 'PENDING' } }),
      prisma.store.count({ where: { manufacturerId, isActive: true } }),
      prisma.b2bOrder.findMany({
        where: { manufacturerId, pendingManagerApproval: false },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          orderNumber: true,
          status: true,
          totalItems: true,
          createdAt: true,
          store: { select: { name: true } },
        },
      }),
    ]);

  return {
    totalDesigns,
    activeDesigns,
    pendingB2b,
    pendingKiosk,
    pendingRegistrations,
    activeStores,
    recentB2b: recentB2b.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      totalItems: o.totalItems,
      createdAt: o.createdAt,
      storeName: o.store?.name ?? null,
    })),
  };
}
