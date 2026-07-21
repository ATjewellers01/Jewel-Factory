-- Add indexes for analytics queries (sales data aggregation)
-- These indexes optimize the performance of analytics queries that group by:
-- - branch_id + created_at (date range filtering per branch)
-- - forwarded_to_manufacturer status (approval gate)
-- - category + sub_category (breakdown by product type)
-- - weight_grams (weight range grouping)

-- Kiosk orders: branch + approval status + created date
CREATE INDEX IF NOT EXISTS "idx_kiosk_orders_branch_forwarded_created" ON "kiosk_orders"("branch_id", "forwarded_to_manufacturer", "created_at");

-- B2B orders: branch + status + created date
CREATE INDEX IF NOT EXISTS "idx_b2b_orders_branch_status_created" ON "b2b_orders"("branch_id", "status", "created_at");

-- Kiosk orders: just forwarded status (for global queries)
CREATE INDEX IF NOT EXISTS "idx_kiosk_orders_forwarded" ON "kiosk_orders"("forwarded_to_manufacturer");

-- B2B orders: just status (for global queries)
CREATE INDEX IF NOT EXISTS "idx_b2b_orders_status" ON "b2b_orders"("status");

-- Manufacturer products: category + sub-category (for breakdown queries)
CREATE INDEX IF NOT EXISTS "idx_manufacturer_products_category_subcategory" ON "manufacturer_products"("category", "sub_category");

-- Manufacturer products: weight (for weight range grouping)
CREATE INDEX IF NOT EXISTS "idx_manufacturer_products_weight" ON "manufacturer_products"("weight_grams");

-- Store + branch relationship (for cross-branch queries)
CREATE INDEX IF NOT EXISTS "idx_branches_store_id" ON "branches"("store_id");
