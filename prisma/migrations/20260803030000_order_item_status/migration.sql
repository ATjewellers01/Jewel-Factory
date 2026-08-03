-- Per-line-item status on Catalog/Kiosk order items — a single order can have
-- products at different stages (one piece Ghat Received while another is
-- Dispatched), independent of the order-level status the manufacturer also
-- advances. Custom design orders are excluded (generally a single design).
--
-- Idempotent: IF NOT EXISTS guards a safe re-run.

ALTER TABLE "kiosk_order_items" ADD COLUMN IF NOT EXISTS "status" "OrderStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "b2b_order_items" ADD COLUMN IF NOT EXISTS "status" "OrderStatus" NOT NULL DEFAULT 'PENDING';
