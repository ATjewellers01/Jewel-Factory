-- Retailer-Admin bespoke Customised Order requests now defer CustomDesignOrder
-- creation until a Karigar is assigned (2026-08-10 redesign). This new table
-- holds the request's spec between submission and assignment. Additive only
-- — no existing table/column changed. Idempotent: safe to re-run.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RetailerCustomRequestStatus') THEN
        CREATE TYPE "RetailerCustomRequestStatus" AS ENUM ('PENDING', 'ASSIGNED');
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS "retailer_custom_requests" (
    "id" TEXT NOT NULL,
    "manufacturer_id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "order_number" TEXT NOT NULL,
    "store_name_snapshot" TEXT NOT NULL,
    "store_address_snapshot" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "sub_category" TEXT,
    "weight_grams_min" DECIMAL(8,3),
    "weight_grams_max" DECIMAL(8,3),
    "purity" TEXT,
    "reference_image_url" TEXT,
    "reference_image_urls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "design_notes" TEXT,
    "order_ref" TEXT,
    "delivery_date" DATE,
    "quantity" TEXT,
    "meena" TEXT,
    "length" TEXT,
    "size" TEXT,
    "broadness" TEXT,
    "screw" TEXT,
    "sample_weight_grams" DECIMAL(8,3),
    "status" "RetailerCustomRequestStatus" NOT NULL DEFAULT 'PENDING',
    "order_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "retailer_custom_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "retailer_custom_requests_order_number_key"
    ON "retailer_custom_requests"("order_number");
CREATE UNIQUE INDEX IF NOT EXISTS "retailer_custom_requests_order_id_key"
    ON "retailer_custom_requests"("order_id");
CREATE INDEX IF NOT EXISTS "retailer_custom_requests_manufacturer_id_idx"
    ON "retailer_custom_requests"("manufacturer_id");
CREATE INDEX IF NOT EXISTS "retailer_custom_requests_store_id_idx"
    ON "retailer_custom_requests"("store_id");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'retailer_custom_requests_manufacturer_id_fkey'
    ) THEN
        ALTER TABLE "retailer_custom_requests"
            ADD CONSTRAINT "retailer_custom_requests_manufacturer_id_fkey"
            FOREIGN KEY ("manufacturer_id") REFERENCES "manufacturers"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'retailer_custom_requests_store_id_fkey'
    ) THEN
        ALTER TABLE "retailer_custom_requests"
            ADD CONSTRAINT "retailer_custom_requests_store_id_fkey"
            FOREIGN KEY ("store_id") REFERENCES "stores"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'retailer_custom_requests_order_id_fkey'
    ) THEN
        ALTER TABLE "retailer_custom_requests"
            ADD CONSTRAINT "retailer_custom_requests_order_id_fkey"
            FOREIGN KEY ("order_id") REFERENCES "custom_design_orders"("id")
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
