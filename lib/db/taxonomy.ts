import { prisma } from '@/lib/prisma';
import { CATEGORY_TREE, PURITIES as DEFAULT_PURITIES } from '@/lib/categories';

// ── Manufacturer-editable catalog taxonomy (2026-08-17) ─────────────────────
// Replaces the old hardcoded lib/categories.ts CATEGORY_TREE/PURITIES as the
// source of truth for the Add/Edit Design form's Category, Sub-category 1,
// Sub-category 2 and Purity dropdowns. Every level is scoped per-manufacturer;
// Sub-category 1 and Sub-category 2 are each scoped to their own parent
// Category (independent lists — Sub-category 2 is NOT a global Plain/Studded
// pair anymore). ensureDefaultTaxonomy() backfills a manufacturer's first-ever
// read from the old static list, additively, so an existing manufacturer with
// no taxonomy rows yet doesn't see an empty dropdown.

async function ensureDefaultTaxonomy(manufacturerId: string) {
  const count = await prisma.manufacturerCategory.count({ where: { manufacturerId } });
  if (count > 0) return;
  await prisma.$transaction(async (tx) => {
    // Race-safe: re-check inside the transaction in case two requests both
    // saw count === 0 (e.g. two tabs loading the form at the same time).
    const stillEmpty = (await tx.manufacturerCategory.count({ where: { manufacturerId } })) === 0;
    if (!stillEmpty) return;
    let categorySort = 0;
    for (const [name, subCategories1] of Object.entries(CATEGORY_TREE)) {
      const category = await tx.manufacturerCategory.create({
        data: { manufacturerId, name, sortOrder: categorySort++ },
      });
      let subSort = 0;
      for (const sub of subCategories1) {
        await tx.manufacturerSubCategory1.create({
          data: { manufacturerId, categoryId: category.id, name: sub, sortOrder: subSort++ },
        });
      }
    }
    let puritySort = 0;
    for (const name of DEFAULT_PURITIES) {
      await tx.manufacturerPurity.create({ data: { manufacturerId, name, sortOrder: puritySort++ } });
    }
  });
}

export type TaxonomyCategory = {
  id: string;
  name: string;
  subCategories1: { id: string; name: string }[];
  subCategories2: { id: string; name: string }[];
};

// Full tree for the manufacturer's own Add/Edit Design form (editing context).
export async function getManufacturerTaxonomy(manufacturerId: string): Promise<{
  categories: TaxonomyCategory[];
  purities: { id: string; name: string }[];
}> {
  await ensureDefaultTaxonomy(manufacturerId);
  const categories = await prisma.manufacturerCategory.findMany({
    where: { manufacturerId },
    orderBy: { sortOrder: 'asc' },
    include: {
      subCategories1: { orderBy: { sortOrder: 'asc' }, select: { id: true, name: true } },
      subCategories2: { orderBy: { sortOrder: 'asc' }, select: { id: true, name: true } },
    },
  });
  const purities = await prisma.manufacturerPurity.findMany({
    where: { manufacturerId },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, name: true },
  });
  return { categories, purities };
}

// ── Category ──────────────────────────────────────────────────────────────
export async function addManufacturerCategory(manufacturerId: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Category name is required');
  const existing = await prisma.manufacturerCategory.findFirst({ where: { manufacturerId, name: trimmed } });
  if (existing) return existing;
  const count = await prisma.manufacturerCategory.count({ where: { manufacturerId } });
  return prisma.manufacturerCategory.create({ data: { manufacturerId, name: trimmed, sortOrder: count } });
}

export async function removeManufacturerCategory(manufacturerId: string, id: string) {
  const category = await prisma.manufacturerCategory.findFirst({ where: { id, manufacturerId } });
  if (!category) return { ok: false as const, reason: 'not_found' as const };
  const inUse = await prisma.manufacturerProduct.count({ where: { manufacturerId, category: category.name } });
  if (inUse > 0) return { ok: false as const, reason: 'in_use' as const, count: inUse };
  await prisma.manufacturerCategory.delete({ where: { id } });
  return { ok: true as const };
}

// ── Sub-category 1 (scoped to one category) ─────────────────────────────────
export async function addManufacturerSubCategory1(manufacturerId: string, categoryId: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Sub-category name is required');
  const category = await prisma.manufacturerCategory.findFirst({ where: { id: categoryId, manufacturerId } });
  if (!category) throw new Error('Category not found');
  const existing = await prisma.manufacturerSubCategory1.findFirst({ where: { categoryId, name: trimmed } });
  if (existing) return existing;
  const count = await prisma.manufacturerSubCategory1.count({ where: { categoryId } });
  return prisma.manufacturerSubCategory1.create({
    data: { manufacturerId, categoryId, name: trimmed, sortOrder: count },
  });
}

export async function removeManufacturerSubCategory1(manufacturerId: string, id: string) {
  const sub = await prisma.manufacturerSubCategory1.findFirst({
    where: { id, manufacturerId },
    include: { category: { select: { name: true } } },
  });
  if (!sub) return { ok: false as const, reason: 'not_found' as const };
  const inUse = await prisma.manufacturerProduct.count({
    where: { manufacturerId, category: sub.category.name, subCategory: sub.name },
  });
  if (inUse > 0) return { ok: false as const, reason: 'in_use' as const, count: inUse };
  await prisma.manufacturerSubCategory1.delete({ where: { id } });
  return { ok: true as const };
}

// ── Sub-category 2 (scoped to one category, own independent list) ──────────
export async function addManufacturerSubCategory2(manufacturerId: string, categoryId: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Sub-category name is required');
  const category = await prisma.manufacturerCategory.findFirst({ where: { id: categoryId, manufacturerId } });
  if (!category) throw new Error('Category not found');
  const existing = await prisma.manufacturerSubCategory2.findFirst({ where: { categoryId, name: trimmed } });
  if (existing) return existing;
  const count = await prisma.manufacturerSubCategory2.count({ where: { categoryId } });
  return prisma.manufacturerSubCategory2.create({
    data: { manufacturerId, categoryId, name: trimmed, sortOrder: count },
  });
}

export async function removeManufacturerSubCategory2(manufacturerId: string, id: string) {
  const sub = await prisma.manufacturerSubCategory2.findFirst({
    where: { id, manufacturerId },
    include: { category: { select: { name: true } } },
  });
  if (!sub) return { ok: false as const, reason: 'not_found' as const };
  const inUse = await prisma.manufacturerProduct.count({
    where: { manufacturerId, category: sub.category.name, subCategory2: sub.name },
  });
  if (inUse > 0) return { ok: false as const, reason: 'in_use' as const, count: inUse };
  await prisma.manufacturerSubCategory2.delete({ where: { id } });
  return { ok: true as const };
}

// ── Purity ───────────────────────────────────────────────────────────────
export async function addManufacturerPurity(manufacturerId: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Purity is required');
  const existing = await prisma.manufacturerPurity.findFirst({ where: { manufacturerId, name: trimmed } });
  if (existing) return existing;
  const count = await prisma.manufacturerPurity.count({ where: { manufacturerId } });
  return prisma.manufacturerPurity.create({ data: { manufacturerId, name: trimmed, sortOrder: count } });
}

export async function removeManufacturerPurity(manufacturerId: string, id: string) {
  const purity = await prisma.manufacturerPurity.findFirst({ where: { id, manufacturerId } });
  if (!purity) return { ok: false as const, reason: 'not_found' as const };
  const inUse = await prisma.manufacturerProduct.count({ where: { manufacturerId, purity: purity.name } });
  if (inUse > 0) return { ok: false as const, reason: 'in_use' as const, count: inUse };
  await prisma.manufacturerPurity.delete({ where: { id } });
  return { ok: true as const };
}

// ── Read-only, for retailer/kiosk/store-manager consumers ──────────────────
// Resolves the manufacturer id for a store/branch context, then returns the
// same tree — used by catalog/search/analytics filter dropdowns that need to
// reflect a specific manufacturer's current taxonomy (not the DB-editing
// manufacturer's own session).
export async function getTaxonomyForManufacturer(manufacturerId: string) {
  return getManufacturerTaxonomy(manufacturerId);
}

// storeId here is the RETAILER's own id (Store.id) — every retailer/branch is
// linked to exactly one manufacturer via Store.manufacturerId (same pattern
// used by placeB2bOrder/placeKioskOrder to resolve which manufacturer an
// order goes to).
export async function getTaxonomyForStoreId(storeId: string) {
  const store = await prisma.store.findUnique({ where: { id: storeId }, select: { manufacturerId: true } });
  if (!store?.manufacturerId) return { categories: [], purities: [] };
  return getManufacturerTaxonomy(store.manufacturerId);
}
