-- Editable per-line size override on the cart AND on the resulting order item
-- (2026-08-24) — mirrors the existing `purity` override column on both.
-- Additive/nullable, no backfill.

ALTER TABLE "cart_items" ADD COLUMN IF NOT EXISTS "size" TEXT;
ALTER TABLE "b2b_order_items" ADD COLUMN IF NOT EXISTS "size" TEXT;
