/**
 * Similar-image search: OpenCLIP embedder + PostgreSQL pgvector.
 * NODE-ONLY (server). Customers search the global manufacturer catalog.
 */
import { getServerEnv } from '@/lib/env';
import { prisma } from '@/lib/prisma';

export const EMBEDDING_DIM = 512;

function embedderBase(): string {
  const url = getServerEnv().EMBEDDER_URL;
  if (!url) throw new Error('EMBEDDER_URL is not configured');
  return url.replace(/\/$/, '');
}
function embedderHeaders(): Record<string, string> {
  const key = getServerEnv().EMBEDDER_API_KEY;
  return key ? { Authorization: `Bearer ${key}` } : {};
}

export async function embedImageBase64(base64: string): Promise<number[]> {
  const bytes = Uint8Array.from(atob(base64.replace(/^data:image\/\w+;base64,/, '')), (c) => c.charCodeAt(0));
  const form = new FormData();
  form.append('file', new Blob([bytes]), 'query.jpg');
  const res = await fetch(`${embedderBase()}/embed/image`, {
    method: 'POST',
    headers: embedderHeaders(),
    body: form,
  });
  if (!res.ok) {
    // Surface a message a customer/retailer can act on, not the raw HTTP
    // status — "embedder image failed: 422" meant nothing to them. 422 is the
    // embedder rejecting the file itself (corrupt/unreadable/wrong format);
    // anything else is treated as the service being temporarily unavailable.
    if (res.status === 422) {
      throw new Error("We couldn't read that photo. Try a clearer image in JPG or PNG format.");
    }
    throw new Error('Visual search is temporarily unavailable. Please try again in a moment.');
  }
  const json = (await res.json()) as { embedding: number[] };
  return json.embedding;
}

export async function ensureCollection(): Promise<void> {
  // The pgvector extension and vector column are installed by Prisma migration.
  await prisma.$queryRawUnsafe('SELECT 1 FROM pg_extension WHERE extname = \'vector\'');
}

export async function upsertVector(pointId: string, vector: number[], payload: Record<string, unknown>): Promise<void> {
  if (vector.length !== EMBEDDING_DIM) throw new Error(`Expected ${EMBEDDING_DIM}-dimension embedding`);
  await prisma.$executeRawUnsafe(
    `UPDATE manufacturer_product_embeddings
       SET embedding = $2::vector, metadata = $3::jsonb, indexed_at = NOW()
     WHERE product_id = $1`,
    pointId,
    `[${vector.join(',')}]`,
    JSON.stringify(payload),
  );
}

export async function deleteVector(pointId: string): Promise<void> {
  await prisma.$executeRawUnsafe(
    'UPDATE manufacturer_product_embeddings SET embedding = NULL, metadata = NULL WHERE product_id = $1',
    pointId,
  );
}

export async function searchByVector(vector: number[], limit = 24): Promise<{ id: string; score: number }[]> {
  if (vector.length !== EMBEDDING_DIM) throw new Error(`Expected ${EMBEDDING_DIM}-dimension embedding`);
  const safeLimit = Math.max(1, Math.min(Math.trunc(limit), 100));
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string; score: number }>>(
    `SELECT product_id AS id, (1 - (embedding <=> $1::vector))::double precision AS score
       FROM manufacturer_product_embeddings
      WHERE embedding IS NOT NULL
      ORDER BY embedding <=> $1::vector
      LIMIT ${safeLimit}`,
    `[${vector.join(',')}]`,
  );
  return rows.map((row) => ({ id: row.id, score: Number(row.score) }));
}

// Plain nearest-neighbour search has no similarity floor, so a small catalogue
// always pads out to `limit` results no matter how distant they are — a
// necklace photo could return bangles/earrings just to fill the list. This
// wraps searchByVector with two extra passes:
//  1. Pull a wider pool (limit * 3, capped) so there's enough signal to work with.
//  2. Anchor on the #1 (highest-score) match's category and keep only same-
//     category hits — that's the customer's real intent, without needing a
//     separate image classifier.
//  3. Apply a mild score floor within that category, so even same-category
//     hits that are visually unrelated get dropped instead of padding the list.
// Returns [] when nothing clears the bar — callers should show a "no close
// matches" state rather than a misleadingly full grid.
//
// Lowered from 0.65 (2026-08-07): a raw real-world query photo (cluttered
// background, hand-held, no studio lighting) embeds much further from its
// own catalogue studio-shot than two catalogue photos embed from each other
// — the background/context dominates the vector more than the jewellery
// does. 0.65 rejected genuine matches outright on real customer photos, not
// just true negatives. This is a stopgap, not a fix: the real problem is
// that the embedding captures the whole scene, not just the jewellery — see
// the isolateSubject TODO below. Retune (probably upward again) once that
// lands and re-embed the catalogue.
const SIMILARITY_SCORE_FLOOR = 0.35;

export async function searchSimilarProducts(vector: number[], limit = 24): Promise<{ id: string; score: number }[]> {
  const pool = await searchByVector(vector, Math.min(limit * 3, 100));
  if (pool.length === 0) return [];

  const categoryById = new Map(
    (
      await prisma.manufacturerProduct.findMany({
        where: { id: { in: pool.map((p) => p.id) } },
        select: { id: true, category: true },
      })
    ).map((p) => [p.id, p.category]),
  );

  const anchorCategory = categoryById.get(pool[0]!.id) ?? null;

  return pool
    .filter((hit) => categoryById.get(hit.id) === anchorCategory && hit.score >= SIMILARITY_SCORE_FLOOR)
    .slice(0, limit);
}
