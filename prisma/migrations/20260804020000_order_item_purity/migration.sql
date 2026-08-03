-- Per-line melting/purity on Kiosk + B2B order items — defaults to the
-- product's own purity in the UI, but overridable per order line since the
-- same design is sometimes wanted in a different melting.
--
-- Idempotent: IF NOT EXISTS guards a safe re-run.

ALTER TABLE "kiosk_order_items" ADD COLUMN IF NOT EXISTS "purity" TEXT;
ALTER TABLE "b2b_order_items" ADD COLUMN IF NOT EXISTS "purity" TEXT;
