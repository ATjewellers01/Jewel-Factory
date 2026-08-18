-- O2D integration linkage on custom_design_orders (see lib/integrations/o2d.ts
-- and the send-to-o2d route in lib/api/routes/manufacturer-orders.ts) --
-- records the real O2D order created when a manufacturer assigns items to a
-- Karigar. Additive/idempotent, matches the hand-authored style used by
-- prior migrations in this project (Supabase pooler advisory-lock timeout
-- workaround for `migrate dev`, see CLAUDE.md Gotchas).

ALTER TABLE "custom_design_orders" ADD COLUMN IF NOT EXISTS "o2d_order_id" TEXT;
ALTER TABLE "custom_design_orders" ADD COLUMN IF NOT EXISTS "o2d_order_no" TEXT;
ALTER TABLE "custom_design_orders" ADD COLUMN IF NOT EXISTS "o2d_synced_at" TIMESTAMP(3);
ALTER TABLE "custom_design_orders" ADD COLUMN IF NOT EXISTS "o2d_sync_error" TEXT;
