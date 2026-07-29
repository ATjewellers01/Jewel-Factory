-- Deleting a retailer (Store row) from the manufacturer's list must remove
-- everything belonging to it. b2b_orders/kiosk_orders/custom_design_orders
-- were ON DELETE RESTRICT (the original schema default), which made
-- deleteStoreByManufacturer() fail with a foreign-key violation the moment a
-- retailer had ANY order history — the delete silently only worked for
-- brand-new retailers with zero orders. Switch all three to CASCADE so the
-- order (and its own child rows: order items, status history, order
-- messages tied to that order — all already CASCADE from the order) go with
-- the retailer. Idempotent: safe to re-run.

ALTER TABLE "b2b_orders" DROP CONSTRAINT IF EXISTS "b2b_orders_store_id_fkey";
ALTER TABLE "b2b_orders" ADD CONSTRAINT "b2b_orders_store_id_fkey"
    FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "kiosk_orders" DROP CONSTRAINT IF EXISTS "kiosk_orders_store_id_fkey";
ALTER TABLE "kiosk_orders" ADD CONSTRAINT "kiosk_orders_store_id_fkey"
    FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "custom_design_orders" DROP CONSTRAINT IF EXISTS "custom_design_orders_store_id_fkey";
ALTER TABLE "custom_design_orders" ADD CONSTRAINT "custom_design_orders_store_id_fkey"
    FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
