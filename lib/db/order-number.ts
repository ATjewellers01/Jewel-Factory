import { prisma } from '@/lib/prisma';

/**
 * Next JFA-#### (Catalog/Kiosk) or JFC-#### (Customised) order number for this
 * manufacturer. One counter per manufacturer, shared across every retailer
 * (and their Retailer Users) the manufacturer serves — Kiosk and Catalog/B2B
 * orders draw from the SAME `nextCatalogOrderSeq` counter (they're merged into
 * one "Catalogue Orders" list everywhere), Customised orders use their own.
 *
 * Uses an atomic UPDATE ... RETURNING (not read-then-write) so two orders
 * placed in the same instant never collide on the same number.
 */
async function nextManufacturerSeq(manufacturerId: string, column: 'next_catalog_order_seq' | 'next_custom_order_seq'): Promise<number> {
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

export async function nextCustomOrderNumber(manufacturerId: string): Promise<string> {
  const n = await nextManufacturerSeq(manufacturerId, 'next_custom_order_seq');
  return `JFC-${String(n).padStart(4, '0')}`;
}
