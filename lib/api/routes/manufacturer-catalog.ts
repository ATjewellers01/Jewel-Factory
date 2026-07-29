import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';

import {
  listManufacturerProducts,
  getManufacturerProduct,
  createManufacturerProduct,
  updateManufacturerProduct,
  deleteManufacturerProduct,
  addProductImage,
  removeProductImage,
  setProductTryon,
  removeProductTryon,
} from '@/lib/db/manufacturer-catalog';
import { signUpload, manufacturerFolder } from '@/lib/storage';
import { getManufacturerDashboard } from '@/lib/db/manufacturer-dashboard';
import { indexManufacturerProduct } from '@/lib/db/indexing';
import { sendData, sendError } from '../envelope';
import { manufacturerGuard, type AppEnv } from '../guards';
import type { ProductStatus } from '@prisma/client';

// All routes here are manufacturer-gated.
export const manufacturerCatalogRoutes = new Hono<AppEnv>();
manufacturerCatalogRoutes.use('*', manufacturerGuard);

// ── Dashboard summary ─────────────────────────────────────────────────────────
manufacturerCatalogRoutes.get('/dashboard', async (c) => {
  const data = await getManufacturerDashboard(c.get('manufacturerId'));
  return sendData(c, data);
});

// ── List / read ───────────────────────────────────────────────────────────────

const ListQuery = z.object({
  category: z.string().optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']).optional(),
  search: z.string().optional(),
  hasTryon: z.enum(['true', 'false']).optional(),
  karigarCode: z.string().optional(),
});

manufacturerCatalogRoutes.get('/products', zValidator('query', ListQuery), async (c) => {
  const q = c.req.valid('query');
  const products = await listManufacturerProducts(c.get('manufacturerId'), {
    category: q.category,
    status: q.status as ProductStatus | undefined,
    search: q.search,
    hasTryon: q.hasTryon === undefined ? undefined : q.hasTryon === 'true',
    karigarCode: q.karigarCode,
  });
  return sendData(c, products);
});

manufacturerCatalogRoutes.get('/products/:id', async (c) => {
  const product = await getManufacturerProduct(c.get('manufacturerId'), c.req.param('id'));
  if (!product) return sendError(c, 'not_found', 'Product not found', 404);
  return sendData(c, product);
});

// ── Create / update / delete ──────────────────────────────────────────────────
// NOTE: no price, no metal — per Jewel Factory rules.

const ProductBody = z.object({
  category: z.string().optional(),
  subCategory: z.string().optional(),
  description: z.string().optional(),
  weightGrams: z.number().positive().optional(),
  purity: z.string().optional(),
  gemstones: z.array(z.string()).optional(),
  occasionTags: z.array(z.string()).optional(),
  styleTags: z.array(z.string()).optional(),
  minOrderQty: z.number().int().positive().optional(),
  pieces: z.number().int().positive().optional(),
  karigarCode: z.string().optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']).optional(),
});

manufacturerCatalogRoutes.post('/products', zValidator('json', ProductBody), async (c) => {
  const product = await createManufacturerProduct(c.get('manufacturerId'), c.req.valid('json'));
  return sendData(c, product, 201);
});

manufacturerCatalogRoutes.patch('/products/:id', zValidator('json', ProductBody.partial()), async (c) => {
  const updated = await updateManufacturerProduct(
    c.get('manufacturerId'),
    c.req.param('id'),
    c.req.valid('json'),
  );
  if (!updated) return sendError(c, 'not_found', 'Product not found', 404);
  return sendData(c, updated);
});

manufacturerCatalogRoutes.delete('/products/:id', async (c) => {
  const ok = await deleteManufacturerProduct(c.get('manufacturerId'), c.req.param('id'));
  if (!ok) return sendError(c, 'not_found', 'Product not found', 404);
  return sendData(c, { ok: true });
});

// ── Images ────────────────────────────────────────────────────────────────────

// POST /products/:id/images/sign — signed Cloudinary upload params
manufacturerCatalogRoutes.post('/products/:id/images/sign', async (c) => {
  const mfrId = c.get('manufacturerId');
  const product = await getManufacturerProduct(mfrId, c.req.param('id'));
  if (!product) return sendError(c, 'not_found', 'Product not found', 404);
  try {
    const signed = await signUpload({ folder: manufacturerFolder(mfrId, 'catalog'), bucket: 'catalog' });
    return sendData(c, signed);
  } catch (err) {
    return sendError(c, 'upstream_failed', err instanceof Error ? err.message : 'Object storage not configured', 503);
  }
});

const SaveImageBody = z.object({
  cloudinaryPublicId: z.string().min(1),
  secureUrl: z.string().url(),
  isPrimary: z.boolean().optional(),
});

// POST /products/:id/images — save uploaded image
manufacturerCatalogRoutes.post('/products/:id/images', zValidator('json', SaveImageBody), async (c) => {
  const productId = c.req.param('id');
  const img = await addProductImage(c.get('manufacturerId'), productId, c.req.valid('json'));
  if (!img) return sendError(c, 'not_found', 'Product not found', 404);
  // Fire-and-forget: index the image for similar-image search (needs embedder).
  void indexManufacturerProduct(productId).catch((e) => console.warn('[index] failed:', e));
  return sendData(c, img, 201);
});

manufacturerCatalogRoutes.delete('/products/:id/images/:imageId', async (c) => {
  const ok = await removeProductImage(c.get('manufacturerId'), c.req.param('id'), c.req.param('imageId'));
  if (!ok) return sendError(c, 'not_found', 'Product not found', 404);
  return sendData(c, { ok: true });
});

// ── Try-on asset (transparent PNG) ────────────────────────────────────────────

// POST /products/:id/tryon/sign
manufacturerCatalogRoutes.post('/products/:id/tryon/sign', async (c) => {
  const mfrId = c.get('manufacturerId');
  const product = await getManufacturerProduct(mfrId, c.req.param('id'));
  if (!product) return sendError(c, 'not_found', 'Product not found', 404);
  try {
    const signed = await signUpload({ folder: manufacturerFolder(mfrId, 'tryon'), bucket: 'tryon' });
    return sendData(c, signed);
  } catch (err) {
    return sendError(c, 'upstream_failed', err instanceof Error ? err.message : 'Object storage not configured', 503);
  }
});

const TryonBody = z.object({
  cloudinaryPublicId: z.string().optional(),
  assetUrl: z.string().url(),
  jewelleryType: z.enum(['necklace', 'earring_left', 'earring_right', 'ring_index', 'ring_middle', 'bangle']),
  pivotX: z.number().optional(),
  pivotY: z.number().optional(),
  xOffset: z.number().optional(),
  yOffset: z.number().optional(),
  scaleMultiplier: z.number().optional(),
  rotationOffsetDeg: z.number().optional(),
});

// POST /products/:id/tryon — set/replace try-on asset
manufacturerCatalogRoutes.post('/products/:id/tryon', zValidator('json', TryonBody), async (c) => {
  const asset = await setProductTryon(c.get('manufacturerId'), c.req.param('id'), c.req.valid('json'));
  if (!asset) return sendError(c, 'not_found', 'Product not found', 404);
  return sendData(c, asset, 201);
});

manufacturerCatalogRoutes.delete('/products/:id/tryon', async (c) => {
  const ok = await removeProductTryon(c.get('manufacturerId'), c.req.param('id'));
  if (!ok) return sendError(c, 'not_found', 'Product not found', 404);
  return sendData(c, { ok: true });
});
