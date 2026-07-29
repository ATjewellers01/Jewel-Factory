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
  subCategory?: string;
  description?: string;
  weightGrams?: number;
  purity?: string;
  gemstones?: string[];
  occasionTags?: string[];
  styleTags?: string[];
  minOrderQty?: number;
  pieces?: number;
  karigarCode?: string;
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
      description: input.description ?? null,
      weightGrams: input.weightGrams ?? null,
      purity: input.purity ?? null,
      gemstones: input.gemstones ?? [],
      occasionTags: input.occasionTags ?? [],
      styleTags: input.styleTags ?? [],
      minOrderQty: input.minOrderQty ?? 1,
      pieces: input.pieces ?? 1,
      karigarCode: input.karigarCode ?? null,
      status: input.status ?? 'DRAFT',
    },
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
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.weightGrams !== undefined ? { weightGrams: input.weightGrams } : {}),
      ...(input.purity !== undefined ? { purity: input.purity } : {}),
      ...(input.gemstones !== undefined ? { gemstones: input.gemstones } : {}),
      ...(input.occasionTags !== undefined ? { occasionTags: input.occasionTags } : {}),
      ...(input.styleTags !== undefined ? { styleTags: input.styleTags } : {}),
      ...(input.minOrderQty !== undefined ? { minOrderQty: input.minOrderQty } : {}),
      ...(input.pieces !== undefined ? { pieces: input.pieces } : {}),
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
