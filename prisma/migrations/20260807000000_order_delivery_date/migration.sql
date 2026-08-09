-- Optional order-level delivery date on Catalog/Restock (B2B) and Store
-- Customer (Kiosk) orders, set by the Retailer Admin when placing their own
-- order or approving a branch's order. Forwarded to the manufacturer.
-- Nullable, no default — every existing row simply gets NULL, no backfill.
-- Idempotent: safe to re-run (matches the hand-authored branch_hierarchy style).

ALTER TABLE "b2b_orders" ADD COLUMN IF NOT EXISTS "delivery_date" DATE;
ALTER TABLE "kiosk_orders" ADD COLUMN IF NOT EXISTS "delivery_date" DATE;
