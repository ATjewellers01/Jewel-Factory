-- Manufacturer-editable catalog taxonomy (2026-08-17) — replaces the old
-- hardcoded lib/categories.ts CATEGORY_TREE/PURITIES as the source of truth
-- for Category / Sub-category 1 / Sub-category 2 / Purity. All new tables,
-- additive only — no existing data (manufacturer_products, categories, etc.)
-- is dropped, backfilled, or altered here. A separate one-off script backfills
-- each existing manufacturer's default rows from the old static list.
-- Idempotent: safe to re-run (matches the hand-authored branch_hierarchy style).

CREATE TABLE IF NOT EXISTS "manufacturer_categories" (
    "id" TEXT NOT NULL,
    "manufacturer_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "manufacturer_categories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "manufacturer_categories_manufacturer_id_name_key"
    ON "manufacturer_categories"("manufacturer_id", "name");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'manufacturer_categories_manufacturer_id_fkey'
    ) THEN
        ALTER TABLE "manufacturer_categories"
            ADD CONSTRAINT "manufacturer_categories_manufacturer_id_fkey"
            FOREIGN KEY ("manufacturer_id") REFERENCES "manufacturers"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS "manufacturer_sub_categories_1" (
    "id" TEXT NOT NULL,
    "manufacturer_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "manufacturer_sub_categories_1_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "manufacturer_sub_categories_1_category_id_name_key"
    ON "manufacturer_sub_categories_1"("category_id", "name");
CREATE INDEX IF NOT EXISTS "manufacturer_sub_categories_1_manufacturer_id_idx"
    ON "manufacturer_sub_categories_1"("manufacturer_id");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'manufacturer_sub_categories_1_manufacturer_id_fkey'
    ) THEN
        ALTER TABLE "manufacturer_sub_categories_1"
            ADD CONSTRAINT "manufacturer_sub_categories_1_manufacturer_id_fkey"
            FOREIGN KEY ("manufacturer_id") REFERENCES "manufacturers"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'manufacturer_sub_categories_1_category_id_fkey'
    ) THEN
        ALTER TABLE "manufacturer_sub_categories_1"
            ADD CONSTRAINT "manufacturer_sub_categories_1_category_id_fkey"
            FOREIGN KEY ("category_id") REFERENCES "manufacturer_categories"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS "manufacturer_sub_categories_2" (
    "id" TEXT NOT NULL,
    "manufacturer_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "manufacturer_sub_categories_2_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "manufacturer_sub_categories_2_category_id_name_key"
    ON "manufacturer_sub_categories_2"("category_id", "name");
CREATE INDEX IF NOT EXISTS "manufacturer_sub_categories_2_manufacturer_id_idx"
    ON "manufacturer_sub_categories_2"("manufacturer_id");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'manufacturer_sub_categories_2_manufacturer_id_fkey'
    ) THEN
        ALTER TABLE "manufacturer_sub_categories_2"
            ADD CONSTRAINT "manufacturer_sub_categories_2_manufacturer_id_fkey"
            FOREIGN KEY ("manufacturer_id") REFERENCES "manufacturers"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'manufacturer_sub_categories_2_category_id_fkey'
    ) THEN
        ALTER TABLE "manufacturer_sub_categories_2"
            ADD CONSTRAINT "manufacturer_sub_categories_2_category_id_fkey"
            FOREIGN KEY ("category_id") REFERENCES "manufacturer_categories"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS "manufacturer_purities" (
    "id" TEXT NOT NULL,
    "manufacturer_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "manufacturer_purities_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "manufacturer_purities_manufacturer_id_name_key"
    ON "manufacturer_purities"("manufacturer_id", "name");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'manufacturer_purities_manufacturer_id_fkey'
    ) THEN
        ALTER TABLE "manufacturer_purities"
            ADD CONSTRAINT "manufacturer_purities_manufacturer_id_fkey"
            FOREIGN KEY ("manufacturer_id") REFERENCES "manufacturers"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
