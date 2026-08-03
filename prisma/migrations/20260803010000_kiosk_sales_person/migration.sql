-- Sales Code + Sales Person Name, captured from the Retailer User at
-- "Add to Cart" on the kiosk, surfaced to the Retailer Admin on the order.
--
-- Idempotent: IF NOT EXISTS guards a safe re-run.

ALTER TABLE "kiosk_orders" ADD COLUMN IF NOT EXISTS "sales_code" TEXT;
ALTER TABLE "kiosk_orders" ADD COLUMN IF NOT EXISTS "sales_person_name" TEXT;
