import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';

import {
  listManufacturerProducts,
  getManufacturerProduct,
  createManufacturerProduct,
  updateManufacturerProduct,
  setManufacturerProductsStatus,
  deleteManufacturerProduct,
  addProductImage,
  removeProductImage,
  setProductTryon,
  removeProductTryon,
} from '@/lib/db/manufacturer-catalog';
import { signUpload, manufacturerFolder, getPublicBaseUrl } from '@/lib/storage';
import { getManufacturerDashboard } from '@/lib/db/manufacturer-dashboard';
import { indexManufacturerProduct } from '@/lib/db/indexing';
import { sendData, sendError } from '../envelope';
import { manufacturerGuard, type AppEnv } from '../guards';
import { jsonValidator } from '../validation';
import type { ProductStatus } from '@prisma/client';

// All routes here are manufacturer-gated.
export const manufacturerCatalogRoutes = new Hono<AppEnv>();
manufacturerCatalogRoutes.use('*', manufacturerGuard);

// ── Dashboard summary ─────────────────────────────────────────────────────────
manufacturerCatalogRoutes.get('/dashboard', async (c) => {
  const data = await getManufacturerDashboard(c.get('manufacturerId'));
  return sendData(c, data);
});

// Server-side image fetch for the catalogue PDF export — the browser's own
// fetch() to S3/CloudFront is subject to CORS, which isn't configured there,
// so jsPDF's client-side image-to-dataURL conversion silently fails and the
// PDF ships with blank image boxes. Proxying through our own origin sidesteps
// that. Restricted to our own S3/CloudFront domain to avoid an open proxy.
manufacturerCatalogRoutes.get('/catalog-pdf-image', async (c) => {
  const url = c.req.query('url');
  if (!url) return sendError(c, 'bad_request', 'Missing url', 400);

  if (!url.startsWith(getPublicBaseUrl())) {
    return sendError(c, 'bad_request', 'Invalid image URL', 400);
  }

  const upstream = await fetch(url);
  if (!upstream.ok || !upstream.body) return sendError(c, 'not_found', 'Image not found', 404);

  return new Response(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': upstream.headers.get('content-type') ?? 'image/jpeg',
      'Cache-Control': 'public, max-age=86400',
    },
  });
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
  // "Sub-category 2" — Plain | Studded. Nullable so switching back to Plain
  // (or clearing it) actually wipes the stored value, same reasoning as
  // karigarCode/size below.
  subCategory2: z.string().nullish(),
  description: z.string().optional(),
  // Nullable — switching a design to Studded (or clearing the field) sends
  // null to wipe a stale value, same reasoning as size/karigarCode below.
  weightGrams: z.number().positive().nullish(),
  // Only meaningful when subCategory2 = "Studded" — manually entered,
  // independent of each other and of weightGrams. Nullable for the same
  // clear-on-switch-back reason as subCategory2.
  grossWeightGrams: z.number().positive().nullish(),
  netWeightGrams: z.number().positive().nullish(),
  purity: z.string().optional(),
  gemstones: z.array(z.string()).optional(),
  occasionTags: z.array(z.string()).optional(),
  styleTags: z.array(z.string()).optional(),
  minOrderQty: z.number().int().positive().optional(),
  pieces: z.number().int().positive().optional(),
  // Bangle size. Nullable so clearing the field on a category change wipes it.
  size: z.string().max(40).nullish(),
  // Nullable so clearing the field in Edit actually wipes the stored code —
  // undefined would mean "don't touch this field" (see updateManufacturerProduct).
  karigarCode: z.string().nullish(),
  status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']).optional(),
});

manufacturerCatalogRoutes.post('/products', jsonValidator(ProductBody), async (c) => {
  const product = await createManufacturerProduct(c.get('manufacturerId'), c.req.valid('json'));
  return sendData(c, product, 201);
});

manufacturerCatalogRoutes.patch('/products/:id', jsonValidator(ProductBody.partial()), async (c) => {
  const updated = await updateManufacturerProduct(
    c.get('manufacturerId'),
    c.req.param('id'),
    c.req.valid('json'),
  );
  if (!updated) return sendError(c, 'not_found', 'Product not found', 404);
  return sendData(c, updated);
});

// Bulk status change from the catalogue list — one request instead of one PATCH
// per design, so activating a filtered page of drafts is a single round trip.
const BulkStatusBody = z.object({
  ids: z.array(z.string().uuid()).min(1).max(500),
  status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']),
});

manufacturerCatalogRoutes.post('/products/bulk-status', jsonValidator(BulkStatusBody), async (c) => {
  const { ids, status } = c.req.valid('json');
  const result = await setManufacturerProductsStatus(c.get('manufacturerId'), ids, status);
  return sendData(c, { updated: result.count });
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
manufacturerCatalogRoutes.post('/products/:id/images', jsonValidator(SaveImageBody), async (c) => {
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
manufacturerCatalogRoutes.post('/products/:id/tryon', jsonValidator(TryonBody), async (c) => {
  const asset = await setProductTryon(c.get('manufacturerId'), c.req.param('id'), c.req.valid('json'));
  if (!asset) return sendError(c, 'not_found', 'Product not found', 404);
  return sendData(c, asset, 201);
});

manufacturerCatalogRoutes.delete('/products/:id/tryon', async (c) => {
  const ok = await removeProductTryon(c.get('manufacturerId'), c.req.param('id'));
  if (!ok) return sendError(c, 'not_found', 'Product not found', 404);
  return sendData(c, { ok: true });
});
