/**
 * One-off backfill — seeds the 5 default Sub-category 2 values (Antique,
 * Handmade, Casting, Turkish, Temple Set) onto every existing "Set" category
 * Sub-category 1 row (Long Set, Short Set, Choker Set, Pendent Set) whose
 * Sub-category 2 list is still empty.
 *
 * Why this is needed: ensureDefaultTaxonomy() (lib/db/taxonomy.ts) only seeds
 * a manufacturer's taxonomy the FIRST time it's ever read for that
 * manufacturer. Any manufacturer who already opened the Add Design form
 * before Sub-category 2 was re-scoped from Category to Sub-category 1
 * (migration 20260818000000_subcategory2_per_subcategory1) was already
 * marked "seeded" back when Set's Sub-category 2 list didn't exist in this
 * shape yet, so they never get the new defaults automatically. This script
 * fills that gap for existing manufacturers, once.
 *
 * Purely additive — only INSERTs into manufacturer_sub_categories_2 for rows
 * that currently have zero Sub-category 2 children. Never updates or deletes
 * anything. Safe to re-run: a Sub-category 1 that already has ANY
 * Sub-category 2 value (including a manually-added one) is left untouched.
 *
 * Run once, after deploying migration 20260818000000_subcategory2_per_subcategory1:
 *   pnpm backfill:set-subcategory2
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SET_CATEGORY_NAME = 'Set';
const DEFAULT_SUB_CATEGORY_2 = ['Antique', 'Handmade', 'Casting', 'Turkish', 'Temple Set'];

async function main() {
  const setSubCategories1 = await prisma.manufacturerSubCategory1.findMany({
    where: { category: { name: SET_CATEGORY_NAME } },
    include: {
      _count: { select: { subCategories2: true } },
      category: { select: { name: true } },
      manufacturer: { select: { name: true } },
    },
  });

  let seeded = 0;
  let skipped = 0;

  for (const sub1 of setSubCategories1) {
    if (sub1._count.subCategories2 > 0) {
      skipped++;
      continue;
    }
    await prisma.$transaction(async (tx) => {
      // Race-safe re-check, same pattern as ensureDefaultTaxonomy.
      const stillEmpty = (await tx.manufacturerSubCategory2.count({ where: { subCategory1Id: sub1.id } })) === 0;
      if (!stillEmpty) return;
      let sortOrder = 0;
      for (const name of DEFAULT_SUB_CATEGORY_2) {
        await tx.manufacturerSubCategory2.create({
          data: { manufacturerId: sub1.manufacturerId, subCategory1Id: sub1.id, name, sortOrder: sortOrder++ },
        });
      }
    });
    seeded++;
    console.log(`  seeded "${sub1.name}" (manufacturer: ${sub1.manufacturer.name}) with 5 defaults`);
  }

  console.log(`\nDone. Seeded ${seeded} Sub-category 1 row(s), skipped ${skipped} (already had values).`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
