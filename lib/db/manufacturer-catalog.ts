import type { Prisma, ProductStatus } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { nextDesignNumber } from '@/lib/design-number';

// ── List / read ───────────────────────────────────────────────────────────────

export type CatalogFilters = {
  category?: string;
  status?: ProductStatus;
  search?: string;
  hasTryon?: boolean;
  karigarCode?: string;
};

export async function listManufacturerProducts(manufacturerId: string, filters: CatalogFilters = {}) {
  const where: Prisma.ManufacturerProductWhereInput = { manufacturerId };
  if (filters.category) where.category = filters.category;
  if (filters.status) where.status = filters.status;
  if (filters.hasTryon !== undefined) where.hasTryon = filters.hasTryon;
  if (filters.karigarCode) where.karigarCode = filters.karigarCode;
  if (filters.search) {
    where.OR = [
      { designNumber: { contains: filters.search, mode: 'insensitive' } },
      { karigarCode: { contains: filters.search, mode: 'insensitive' } },
    ];
  }
  return prisma.manufacturerProduct.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { images: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }] } },
  });
}

export async function getManufacturerProduct(manufacturerId: string, id: string) {
  return prisma.manufacturerProduct.findFirst({
    where: { id, manufacturerId },
    include: {
      images: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }] },
      tryonAssets: { where: { isActive: true } },
    },
  });
}

// Public read (kiosk / store) — no manufacturer scoping, active only.
export async function getActiveProductByDesignOrId(idOrDesign: string) {
  return prisma.manufacturerProduct.findFirst({
    where: {
      status: 'ACTIVE',
      OR: [{ id: idOrDesign }, { designNumber: idOrDesign }],
    },
    omit: { karigarCode: true },
    include: {
      images: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }] },
      tryonAssets: { where: { isActive: true } },
    },
  });
}

// karigarCode is manufacturer-internal only — never expose it to retailer/store
// manager/customer surfaces, so every public read below omits it structurally
// (not just "don't render it" in the UI, which a future call site could forget).
export async function listActiveProducts(filters: { category?: string; search?: string; hasTryon?: boolean } = {}) {
  const where: Prisma.ManufacturerProductWhereInput = { status: 'ACTIVE' };
  if (filters.category) where.category = filters.category;
  if (filters.hasTryon !== undefined) where.hasTryon = filters.hasTryon;
  if (filters.search) {
    where.OR = [{ designNumber: { contains: filters.search, mode: 'insensitive' } }];
  }
  return prisma.manufacturerProduct.findMany({
    where,
    omit: { karigarCode: true },
    orderBy: { createdAt: 'desc' },
    include: { images: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }] } },
  });
}

// ── Create / update / delete ──────────────────────────────────────────────────

export type CreateProductInput = {
  category?: string;
  subCategory?: string; // "Sub-category 1" in the Add Design form
  subCategory2?: string | null; // "Sub-category 2" — Plain | Studded
  description?: string;
  // Nullable — a Studded design (or clearing the field) sends null to wipe
  // a stale value, same reasoning as size/karigarCode below.
  weightGrams?: number | null;
  // Only meaningful when subCategory2 = "Studded" — see the schema comment.
  grossWeightGrams?: number | null;
  netWeightGrams?: number | null;
  purity?: string;
  gemstones?: string[];
  occasionTags?: string[];
  styleTags?: string[];
  minOrderQty?: number;
  pieces?: number;
  size?: string | null; // bangle size — only collected for the Bangles category
  karigarCode?: string | null;
  status?: ProductStatus;
};

export async function createManufacturerProduct(manufacturerId: string, input: CreateProductInput) {
  const designNumber = await nextDesignNumber();
  return prisma.manufacturerProduct.create({
    data: {
      manufacturerId,
      designNumber,
      category: input.category ?? null,
      subCategory: input.subCategory ?? null,
      subCategory2: input.subCategory2 ?? null,
      description: input.description ?? null,
      weightGrams: input.weightGrams ?? null,
      grossWeightGrams: input.grossWeightGrams ?? null,
      netWeightGrams: input.netWeightGrams ?? null,
      purity: input.purity ?? null,
      gemstones: input.gemstones ?? [],
      occasionTags: input.occasionTags ?? [],
      styleTags: input.styleTags ?? [],
      minOrderQty: input.minOrderQty ?? 1,
      pieces: input.pieces ?? 1,
      size: input.size ?? null,
      karigarCode: input.karigarCode ?? null,
      status: input.status ?? 'DRAFT',
    },
  });
}

/**
 * Flip the status of many designs at once (the catalogue's bulk "Make active").
 * Scoped by manufacturerId, so ids belonging to someone else are simply skipped
 * rather than trusted — the caller only ever learns how many rows it changed.
 */
export async function setManufacturerProductsStatus(
  manufacturerId: string,
  ids: string[],
  status: ProductStatus,
) {
  if (ids.length === 0) return { count: 0 };
  return prisma.manufacturerProduct.updateMany({
    where: { id: { in: ids }, manufacturerId },
    data: { status },
  });
}

export type UpdateProductInput = Partial<CreateProductInput>;

export async function updateManufacturerProduct(
  manufacturerId: string,
  id: string,
  input: UpdateProductInput,
) {
  // Ownership check
  const existing = await prisma.manufacturerProduct.findFirst({ where: { id, manufacturerId }, select: { id: true } });
  if (!existing) return null;
  return prisma.manufacturerProduct.update({
    where: { id },
    data: {
      ...(input.category !== undefined ? { category: input.category } : {}),
      ...(input.subCategory !== undefined ? { subCategory: input.subCategory } : {}),
      ...(input.subCategory2 !== undefined ? { subCategory2: input.subCategory2 } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.weightGrams !== undefined ? { weightGrams: input.weightGrams } : {}),
      ...(input.grossWeightGrams !== undefined ? { grossWeightGrams: input.grossWeightGrams } : {}),
      ...(input.netWeightGrams !== undefined ? { netWeightGrams: input.netWeightGrams } : {}),
      ...(input.purity !== undefined ? { purity: input.purity } : {}),
      ...(input.gemstones !== undefined ? { gemstones: input.gemstones } : {}),
      ...(input.occasionTags !== undefined ? { occasionTags: input.occasionTags } : {}),
      ...(input.styleTags !== undefined ? { styleTags: input.styleTags } : {}),
      ...(input.minOrderQty !== undefined ? { minOrderQty: input.minOrderQty } : {}),
      ...(input.pieces !== undefined ? { pieces: input.pieces } : {}),
      ...(input.size !== undefined ? { size: input.size } : {}),
      ...(input.karigarCode !== undefined ? { karigarCode: input.karigarCode } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    },
  });
}

export async function deleteManufacturerProduct(manufacturerId: string, id: string) {
  const existing = await prisma.manufacturerProduct.findFirst({ where: { id, manufacturerId }, select: { id: true } });
  if (!existing) return false;
  await prisma.manufacturerProduct.delete({ where: { id } });
  return true;
}

// ── Images ────────────────────────────────────────────────────────────────────

export async function addProductImage(
  manufacturerId: string,
  productId: string,
  input: { cloudinaryPublicId: string; secureUrl: string; isPrimary?: boolean },
) {
  const product = await prisma.manufacturerProduct.findFirst({
    where: { id: productId, manufacturerId },
    select: { id: true, images: { select: { id: true } } },
  });
  if (!product) return null;

  const isPrimary = input.isPrimary ?? product.images.length === 0;
  if (isPrimary) {
    // demote existing primaries
    await prisma.manufacturerProductImage.updateMany({
      where: { productId },
      data: { isPrimary: false },
    });
  }
  return prisma.manufacturerProductImage.create({
    data: {
      productId,
      cloudinaryPublicId: input.cloudinaryPublicId,
      secureUrl: input.secureUrl,
      isPrimary,
      sortOrder: product.images.length,
    },
  });
}

export async function removeProductImage(manufacturerId: string, productId: string, imageId: string) {
  const product = await prisma.manufacturerProduct.findFirst({
    where: { id: productId, manufacturerId },
    select: { id: true },
  });
  if (!product) return false;
  await prisma.manufacturerProductImage.deleteMany({ where: { id: imageId, productId } });
  return true;
}

// ── Try-on asset (transparent PNG) ────────────────────────────────────────────

export type TryonInput = {
  cloudinaryPublicId?: string;
  assetUrl: string;
  jewelleryType: 'necklace' | 'earring_left' | 'earring_right' | 'ring_index' | 'ring_middle' | 'bangle';
  pivotX?: number;
  pivotY?: number;
  xOffset?: number;
  yOffset?: number;
  scaleMultiplier?: number;
  rotationOffsetDeg?: number;
};

export async function setProductTryon(manufacturerId: string, productId: string, input: TryonInput) {
  const product = await prisma.manufacturerProduct.findFirst({
    where: { id: productId, manufacturerId },
    select: { id: true },
  });
  if (!product) return null;

  return prisma.$transaction(async (tx) => {
    // Replace any existing tryon asset for this manufacturer product.
    await tx.tryonAsset.deleteMany({ where: { manufacturerProductId: productId } });
    const asset = await tx.tryonAsset.create({
      data: {
        manufacturerProductId: productId,
        cloudinaryPublicId: input.cloudinaryPublicId ?? null,
        assetUrl: input.assetUrl,
        jewelleryType: input.jewelleryType,
        pivotX: input.pivotX ?? 0.5,
        pivotY: input.pivotY ?? 0.5,
        xOffset: input.xOffset ?? 0,
        yOffset: input.yOffset ?? 0,
        scaleMultiplier: input.scaleMultiplier ?? 1,
        rotationOffsetDeg: input.rotationOffsetDeg ?? 0,
      },
    });
    await tx.manufacturerProduct.update({ where: { id: productId }, data: { hasTryon: true } });
    return asset;
  });
}

export async function removeProductTryon(manufacturerId: string, productId: string) {
  const product = await prisma.manufacturerProduct.findFirst({
    where: { id: productId, manufacturerId },
    select: { id: true },
  });
  if (!product) return false;
  await prisma.$transaction(async (tx) => {
    await tx.tryonAsset.deleteMany({ where: { manufacturerProductId: productId } });
    await tx.manufacturerProduct.update({ where: { id: productId }, data: { hasTryon: false } });
  });
  return true;
}
