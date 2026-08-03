-- Sales Code + Sales Person Name for Customised orders, mirroring the Kiosk
-- version (kiosk_sales_person migration) — captured from the Retailer User at
-- submission, copied through to the manufacturer-facing order on forward.
-- Restock is intentionally excluded (client decision).
--
-- Idempotent: IF NOT EXISTS guards a safe re-run.

ALTER TABLE "custom_design_requests" ADD COLUMN IF NOT EXISTS "sales_code" TEXT;
ALTER TABLE "custom_design_requests" ADD COLUMN IF NOT EXISTS "sales_person_name" TEXT;
ALTER TABLE "custom_design_orders" ADD COLUMN IF NOT EXISTS "sales_code" TEXT;
ALTER TABLE "custom_design_orders" ADD COLUMN IF NOT EXISTS "sales_person_name" TEXT;
