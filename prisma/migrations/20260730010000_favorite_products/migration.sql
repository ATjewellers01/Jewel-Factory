-- Favorites (heart-icon save) for Retailer and Store Manager. Scoped by
-- store_id (retailer/tenant) + branch_id (null = Retailer's own favorite,
-- set = a specific Store Manager's branch). Never shared between the two.
-- Idempotent: safe to re-run (matches the hand-authored branch_hierarchy style).

CREATE TABLE IF NOT EXISTS "favorite_products" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "manufacturer_product_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorite_products_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "favorite_products_store_id_branch_id_manufacturer_product_id_key"
    ON "favorite_products"("store_id", "branch_id", "manufacturer_product_id");

CREATE INDEX IF NOT EXISTS "favorite_products_store_id_branch_id_idx"
    ON "favorite_products"("store_id", "branch_id");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'favorite_products_manufacturer_product_id_fkey'
    ) THEN
        ALTER TABLE "favorite_products"
            ADD CONSTRAINT "favorite_products_manufacturer_product_id_fkey"
            FOREIGN KEY ("manufacturer_product_id") REFERENCES "manufacturer_products"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
