import { jsonValidator } from '../validation';
import { Hono } from 'hono';
import { z } from 'zod';

import {
  getManufacturerTaxonomy,
  addManufacturerCategory, removeManufacturerCategory,
  addManufacturerSubCategory1, removeManufacturerSubCategory1,
  addManufacturerSubCategory2, removeManufacturerSubCategory2,
  addManufacturerPurity, removeManufacturerPurity,
} from '@/lib/db/taxonomy';
import { sendData, sendError } from '../envelope';
import { manufacturerGuard, type AppEnv } from '../guards';

/**
 * Manufacturer-editable catalog taxonomy (2026-08-17) — Category, Sub-category
 * 1, Sub-category 2 (each scoped to its own parent category) and Purity.
 * Manufacturer-only: add/remove drives the Add/Edit Design form's dropdowns.
 * A remove is rejected with 409 if any product currently uses that value
 * (see lib/db/taxonomy.ts) — no destructive edits to existing product rows.
 */
export const manufacturerTaxonomyRoutes = new Hono<AppEnv>();
manufacturerTaxonomyRoutes.use('*', manufacturerGuard);

manufacturerTaxonomyRoutes.get('/taxonomy', async (c) => {
  return sendData(c, await getManufacturerTaxonomy(c.get('manufacturerId')));
});

const NameBody = z.object({ name: z.string().min(1).max(80) });

// ── Category ─────────────────────────────────────────────────────────────
manufacturerTaxonomyRoutes.post('/taxonomy/categories', jsonValidator(NameBody), async (c) => {
  const { name } = c.req.valid('json');
  return sendData(c, await addManufacturerCategory(c.get('manufacturerId'), name), 201);
});

manufacturerTaxonomyRoutes.delete('/taxonomy/categories/:id', async (c) => {
  const result = await removeManufacturerCategory(c.get('manufacturerId'), c.req.param('id'));
  if (!result.ok) {
    if (result.reason === 'not_found') return sendError(c, 'not_found', 'Category not found', 404);
    return sendError(c, 'conflict', `This category is used by ${result.count} design(s) — move them first.`, 409);
  }
  return sendData(c, { ok: true });
});

// ── Sub-category 1 (scoped to a category) ───────────────────────────────────
const SubCategoryBody = z.object({ categoryId: z.string().uuid(), name: z.string().min(1).max(80) });

manufacturerTaxonomyRoutes.post('/taxonomy/sub-categories-1', jsonValidator(SubCategoryBody), async (c) => {
  const { categoryId, name } = c.req.valid('json');
  try {
    return sendData(c, await addManufacturerSubCategory1(c.get('manufacturerId'), categoryId, name), 201);
  } catch (e) {
    return sendError(c, 'bad_request', e instanceof Error ? e.message : 'Could not add sub-category', 400);
  }
});

manufacturerTaxonomyRoutes.delete('/taxonomy/sub-categories-1/:id', async (c) => {
  const result = await removeManufacturerSubCategory1(c.get('manufacturerId'), c.req.param('id'));
  if (!result.ok) {
    if (result.reason === 'not_found') return sendError(c, 'not_found', 'Sub-category not found', 404);
    return sendError(c, 'conflict', `This sub-category is used by ${result.count} design(s) — move them first.`, 409);
  }
  return sendData(c, { ok: true });
});

// ── Sub-category 2 (scoped to a category, its own independent list) ─────────
manufacturerTaxonomyRoutes.post('/taxonomy/sub-categories-2', jsonValidator(SubCategoryBody), async (c) => {
  const { categoryId, name } = c.req.valid('json');
  try {
    return sendData(c, await addManufacturerSubCategory2(c.get('manufacturerId'), categoryId, name), 201);
  } catch (e) {
    return sendError(c, 'bad_request', e instanceof Error ? e.message : 'Could not add sub-category', 400);
  }
});

manufacturerTaxonomyRoutes.delete('/taxonomy/sub-categories-2/:id', async (c) => {
  const result = await removeManufacturerSubCategory2(c.get('manufacturerId'), c.req.param('id'));
  if (!result.ok) {
    if (result.reason === 'not_found') return sendError(c, 'not_found', 'Sub-category not found', 404);
    return sendError(c, 'conflict', `This sub-category is used by ${result.count} design(s) — move them first.`, 409);
  }
  return sendData(c, { ok: true });
});

// ── Purity ───────────────────────────────────────────────────────────────
manufacturerTaxonomyRoutes.post('/taxonomy/purities', jsonValidator(NameBody), async (c) => {
  const { name } = c.req.valid('json');
  return sendData(c, await addManufacturerPurity(c.get('manufacturerId'), name), 201);
});

manufacturerTaxonomyRoutes.delete('/taxonomy/purities/:id', async (c) => {
  const result = await removeManufacturerPurity(c.get('manufacturerId'), c.req.param('id'));
  if (!result.ok) {
    if (result.reason === 'not_found') return sendError(c, 'not_found', 'Purity not found', 404);
    return sendError(c, 'conflict', `This purity is used by ${result.count} design(s) — move them first.`, 409);
  }
  return sendData(c, { ok: true });
});
