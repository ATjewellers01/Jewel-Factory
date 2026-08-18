-- Sub-category 2 moves from CATEGORY-level to SUB-CATEGORY-1-level (2026-08-18)
-- — e.g. Set's "Long Set" and "Short Set" each get their own independent
-- Sub-category 2 list instead of sharing one per-category list. Additive/
-- idempotent, matches the hand-authored style used by prior migrations.
--
-- manufacturer_sub_categories_2 currently has no rows in production as of
-- this write (the category-level version shipped with an empty list — no
-- manufacturer had added anything to it yet), so the backfill step below is
-- a safety net for any environment where rows DO already exist: each
-- existing row is re-parented onto the FIRST Sub-category 1 under its old
-- category (alphabetically by name) rather than being dropped, so no data
-- is silently lost. If a category has zero Sub-category 1 rows to attach
-- to, the orphaned Sub-category 2 row is deleted (nothing to parent it to).

ALTER TABLE "manufacturer_sub_categories_2"
    ADD COLUMN IF NOT EXISTS "sub_category_1_id" TEXT;

UPDATE "manufacturer_sub_categories_2" AS sc2
SET "sub_category_1_id" = (
    SELECT sc1.id FROM "manufacturer_sub_categories_1" sc1
    WHERE sc1.category_id = sc2.category_id
    ORDER BY sc1.sort_order ASC, sc1.name ASC
    LIMIT 1
)
WHERE sc2."sub_category_1_id" IS NULL;

DELETE FROM "manufacturer_sub_categories_2" WHERE "sub_category_1_id" IS NULL;

ALTER TABLE "manufacturer_sub_categories_2"
    ALTER COLUMN "sub_category_1_id" SET NOT NULL;

DROP INDEX IF EXISTS "manufacturer_sub_categories_2_category_id_name_key";

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'manufacturer_sub_categories_2_category_id_fkey'
    ) THEN
        ALTER TABLE "manufacturer_sub_categories_2"
            DROP CONSTRAINT "manufacturer_sub_categories_2_category_id_fkey";
    END IF;
END $$;

ALTER TABLE "manufacturer_sub_categories_2" DROP COLUMN IF EXISTS "category_id";

CREATE UNIQUE INDEX IF NOT EXISTS "manufacturer_sub_categories_2_sub_category_1_id_name_key"
    ON "manufacturer_sub_categories_2"("sub_category_1_id", "name");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'manufacturer_sub_categories_2_sub_category_1_id_fkey'
    ) THEN
        ALTER TABLE "manufacturer_sub_categories_2"
            ADD CONSTRAINT "manufacturer_sub_categories_2_sub_category_1_id_fkey"
            FOREIGN KEY ("sub_category_1_id") REFERENCES "manufacturer_sub_categories_1"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
