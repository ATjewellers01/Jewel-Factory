-- Split a Store Manager's favorites into separate Kiosk vs Restock lists
-- (previously one shared list per branch). The Retailer's own favorites
-- (branch_id IS NULL) always use kind='KIOSK' — the only value that applies
-- to them, since Retailer has no Kiosk/Restock distinction.
-- Idempotent: safe to re-run.

DO $$ BEGIN
    CREATE TYPE "FavoriteKind" AS ENUM ('KIOSK', 'RESTOCK');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "favorite_products" ADD COLUMN IF NOT EXISTS "kind" "FavoriteKind" NOT NULL DEFAULT 'KIOSK';

DROP INDEX IF EXISTS "favorite_products_store_id_branch_id_manufacturer_product_id_key";
DROP INDEX IF EXISTS "favorite_products_store_id_branch_id_idx";

CREATE UNIQUE INDEX IF NOT EXISTS "favorite_products_store_id_branch_id_kind_manufacturer_produc_key"
    ON "favorite_products"("store_id", "branch_id", "kind", "manufacturer_product_id");

CREATE INDEX IF NOT EXISTS "favorite_products_store_id_branch_id_kind_idx"
    ON "favorite_products"("store_id", "branch_id", "kind");
