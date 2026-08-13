-- Add Design form gets a second sub-category selector ("Sub-category 2":
-- Plain / Studded, free text, not DB-enforced) plus Gross/Net weight fields
-- used only when Studded is picked (weight_grams stays the field of record
-- for Plain). Additive/nullable, no backfill, idempotent.

ALTER TABLE "manufacturer_products" ADD COLUMN IF NOT EXISTS "sub_category_2" TEXT;
ALTER TABLE "manufacturer_products" ADD COLUMN IF NOT EXISTS "gross_weight_grams" DECIMAL(8,3);
ALTER TABLE "manufacturer_products" ADD COLUMN IF NOT EXISTS "net_weight_grams" DECIMAL(8,3);
