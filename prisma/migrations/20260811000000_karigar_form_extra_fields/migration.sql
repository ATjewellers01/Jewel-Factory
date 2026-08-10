-- Reference-form fields for the Karigar assignment form (2026-08-11): total
-- finished weight (distinct from the weight_grams_min/max RANGE) and a
-- Karigar-facing notes field, distinct from narration_1/narration_2.
-- Additive/nullable, no backfill, idempotent.

ALTER TABLE "custom_design_orders" ADD COLUMN IF NOT EXISTS "total_weight_grams" DECIMAL(8,3);
ALTER TABLE "custom_design_orders" ADD COLUMN IF NOT EXISTS "karigar_notes" TEXT;
