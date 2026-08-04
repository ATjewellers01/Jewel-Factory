import { prisma } from '@/lib/prisma';

/**
 * Next JFA-#### order number for this manufacturer. One counter per
 * manufacturer, shared across every retailer (and their Retailer Users) the
 * manufacturer serves, and across every order kind — Kiosk, Catalog/B2B, and
 * Customised orders all draw from this SAME `next_catalog_order_seq` counter
 * (2026-08-04: Customised orders previously had their own JFC-#### counter;
 * unified per client request so every order type shares one ID sequence).
 *
 * Uses an atomic UPDATE ... RETURNING (not read-then-write) so two orders
 * placed in the same instant never collide on the same number.
 */
async function nextManufacturerSeq(manufacturerId: string, column: 'next_catalog_order_seq'): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<{ seq: number }[]>(
    `UPDATE "manufacturers" SET "${column}" = "${column}" + 1 WHERE "id" = $1 RETURNING "${column}" - 1 AS seq`,
    manufacturerId,
  );
  return Number(rows[0]?.seq ?? 1);
}

export async function nextCatalogOrderNumber(manufacturerId: string): Promise<string> {
  const n = await nextManufacturerSeq(manufacturerId, 'next_catalog_order_seq');
  return `JFA-${String(n).padStart(4, '0')}`;
}
