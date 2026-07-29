-- Design name removed per client request (manufacturer no longer enters/AI-generates
-- a product name — design_number is the sole identifier). Made nullable, not dropped,
-- so historical rows keep their name for reference.
-- Added karigar_code (manufacturer-internal only, never exposed to retailer/store
-- manager — used to route/filter which karigar (artisan) makes a product) and
-- pieces (how many physical pieces make up weight_grams, e.g. a bangle pair = 2).
-- Idempotent: safe to re-run (matches the hand-authored branch_hierarchy style).

ALTER TABLE "manufacturer_products" ALTER COLUMN "name" DROP NOT NULL;
ALTER TABLE "manufacturer_products" ADD COLUMN IF NOT EXISTS "pieces" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "manufacturer_products" ADD COLUMN IF NOT EXISTS "karigar_code" TEXT;
