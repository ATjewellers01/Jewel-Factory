-- Item 3: remove Sales Code + Sales Person Name feature entirely.
ALTER TABLE "kiosk_orders" DROP COLUMN IF EXISTS "sales_code";
ALTER TABLE "kiosk_orders" DROP COLUMN IF EXISTS "sales_person_name";
ALTER TABLE "custom_design_requests" DROP COLUMN IF EXISTS "sales_code";
ALTER TABLE "custom_design_requests" DROP COLUMN IF EXISTS "sales_person_name";
ALTER TABLE "custom_design_orders" DROP COLUMN IF EXISTS "sales_code";
ALTER TABLE "custom_design_orders" DROP COLUMN IF EXISTS "sales_person_name";

-- Item 6: multiple reference images for customised design requests/orders.
ALTER TABLE "custom_design_requests" ADD COLUMN IF NOT EXISTS "reference_image_urls" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "custom_design_orders" ADD COLUMN IF NOT EXISTS "reference_image_urls" TEXT[] NOT NULL DEFAULT '{}';
