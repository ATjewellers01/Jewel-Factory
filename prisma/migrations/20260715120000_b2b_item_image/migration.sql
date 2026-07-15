-- B2B order item image + design snapshots (shown in order views).
ALTER TABLE "b2b_order_items" ADD COLUMN "product_image_snapshot" TEXT;
ALTER TABLE "b2b_order_items" ADD COLUMN "product_design_snapshot" TEXT;
