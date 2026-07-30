-- Manually-assigned Karigar Code on custom design orders. Custom orders have
-- no existing catalog product to look one up from (bespoke request: category,
-- weight range, reference image) — the manufacturer sets it directly after
-- reviewing the request. Idempotent: safe to re-run.

ALTER TABLE "custom_design_orders" ADD COLUMN IF NOT EXISTS "karigar_code" TEXT;
