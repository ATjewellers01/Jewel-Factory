import { prisma } from '@/lib/prisma';
import { CATEGORY_TREE, PURITIES as DEFAULT_PURITIES } from '@/lib/categories';

// ── Manufacturer-editable catalog taxonomy (2026-08-17, Sub-category 2
// re-scoped to Sub-category 1 on 2026-08-18) ────────────────────────────────
// Replaces the old hardcoded lib/categories.ts CATEGORY_TREE/PURITIES as the
// source of truth for the Add/Edit Design form's Category, Sub-category 1,
// Sub-category 2 and Purity dropdowns. Every level is scoped per-manufacturer;
// Sub-category 1 is scoped to its own parent Category, and Sub-category 2 is
// scoped to its own parent Sub-category 1 (e.g. Set's "Long Set" and "Short
// Set" each get their own independent Sub-category 2 list — NOT a global
// Plain/Studded pair, NOT shared across a whole category anymore).
// ensureDefaultTaxonomy() backfills a manufacturer's first-ever read from the
// old static list, additively, so an existing manufacturer with no taxonomy
// rows yet doesn't see an empty dropdown. It also seeds every Sub-category 1
// under "Set" with 5 default Sub-category 2 values (Antique/Handmade/Casting/
// Turkish/Temple Set) as a starting point — these are ordinary, fully
// editable/removable rows, not special-cased anywhere else.

const SET_CATEGORY_NAME = 'Set';
const SET_DEFAULT_SUB_CATEGORY_2 = ['Antique', 'Handmade', 'Casting', 'Turkish', 'Temple Set'];

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
        const subCategory1 = await tx.manufacturerSubCategory1.create({
          data: { manufacturerId, categoryId: category.id, name: sub, sortOrder: subSort++ },
        });
        if (name === SET_CATEGORY_NAME) {
          let sub2Sort = 0;
          for (const sub2 of SET_DEFAULT_SUB_CATEGORY_2) {
            await tx.manufacturerSubCategory2.create({
              data: { manufacturerId, subCategory1Id: subCategory1.id, name: sub2, sortOrder: sub2Sort++ },
            });
          }
        }
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
  subCategories1: { id: string; name: string; subCategories2: { id: string; name: string }[] }[];
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
      subCategories1: {
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true, name: true,
          subCategories2: { orderBy: { sortOrder: 'asc' }, select: { id: true, name: true } },
        },
      },
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

// ── Sub-category 2 (scoped to one Sub-category 1, own independent list) ─────
export async function addManufacturerSubCategory2(manufacturerId: string, subCategory1Id: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Sub-category name is required');
  const subCategory1 = await prisma.manufacturerSubCategory1.findFirst({ where: { id: subCategory1Id, manufacturerId } });
  if (!subCategory1) throw new Error('Sub-category 1 not found');
  const existing = await prisma.manufacturerSubCategory2.findFirst({ where: { subCategory1Id, name: trimmed } });
  if (existing) return existing;
  const count = await prisma.manufacturerSubCategory2.count({ where: { subCategory1Id } });
  return prisma.manufacturerSubCategory2.create({
    data: { manufacturerId, subCategory1Id, name: trimmed, sortOrder: count },
  });
}

export async function removeManufacturerSubCategory2(manufacturerId: string, id: string) {
  const sub = await prisma.manufacturerSubCategory2.findFirst({
    where: { id, manufacturerId },
    include: { subCategory1: { select: { name: true, category: { select: { name: true } } } } },
  });
  if (!sub) return { ok: false as const, reason: 'not_found' as const };
  const inUse = await prisma.manufacturerProduct.count({
    where: {
      manufacturerId,
      category: sub.subCategory1.category.name,
      subCategory: sub.subCategory1.name,
      subCategory2: sub.name,
    },
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
