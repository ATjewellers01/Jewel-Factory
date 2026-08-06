-- Server-backed cart (previously localStorage-only, so the same account saw a
-- different cart on every device/browser). Scoped exactly like favorite_products:
-- (store_id, branch_id, kind). branch_id is null for the Retailer's own B2B cart;
-- a Store Manager's kind is KIOSK or RESTOCK, mirroring their separate favorite
-- lists — the two carts must never merge.
-- Idempotent: safe to re-run (matches the hand-authored branch_hierarchy style).

DO $$ BEGIN
    CREATE TYPE "CartKind" AS ENUM ('B2B', 'KIOSK', 'RESTOCK');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "cart_items" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "kind" "CartKind" NOT NULL DEFAULT 'B2B',
    "manufacturer_product_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "purity" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cart_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "cart_items_store_id_branch_id_kind_manufacturer_product_id_key"
    ON "cart_items"("store_id", "branch_id", "kind", "manufacturer_product_id");

CREATE INDEX IF NOT EXISTS "cart_items_store_id_branch_id_kind_idx"
    ON "cart_items"("store_id", "branch_id", "kind");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'cart_items_manufacturer_product_id_fkey'
    ) THEN
        ALTER TABLE "cart_items"
            ADD CONSTRAINT "cart_items_manufacturer_product_id_fkey"
            FOREIGN KEY ("manufacturer_product_id") REFERENCES "manufacturer_products"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS "cart_notes" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "kind" "CartKind" NOT NULL DEFAULT 'B2B',
    "note" TEXT NOT NULL DEFAULT '',
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cart_notes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "cart_notes_store_id_branch_id_kind_key"
    ON "cart_notes"("store_id", "branch_id", "kind");
