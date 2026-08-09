-- Phase 1 of Karigar-assignment: schema only, no UI/PDF yet. All changes are
-- additive/nullable — no existing data is dropped, backfilled, or altered in
-- a way that could break current reads.
-- Idempotent: safe to re-run (matches the hand-authored branch_hierarchy style).

-- custom_design_orders.request_id becomes nullable — a CustomDesignOrder can
-- now originate from assigning a Karigar to a subset of an existing Catalog/
-- Kiosk order's items (no CustomDesignRequest at all), not only from a
-- bespoke design request. Every existing row already has a request_id, so
-- widening NOT NULL -> nullable touches zero existing values.
ALTER TABLE "custom_design_orders" ALTER COLUMN "request_id" DROP NOT NULL;

-- New Karigar master-list table (manufacturer-scoped) — backs the shared,
-- syncable Karigar-code dropdown (add/remove reflected everywhere).
CREATE TABLE IF NOT EXISTS "karigars" (
    "id" TEXT NOT NULL,
    "manufacturer_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "karigars_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "karigars_manufacturer_id_code_key"
    ON "karigars"("manufacturer_id", "code");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'karigars_manufacturer_id_fkey'
    ) THEN
        ALTER TABLE "karigars"
            ADD CONSTRAINT "karigars_manufacturer_id_fkey"
            FOREIGN KEY ("manufacturer_id") REFERENCES "manufacturers"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- custom_design_orders: Origin-2 linkage (source Catalog/Kiosk order this
-- Customised Order was spawned from), Karigar FK, and the assignment-form's
-- new fields — all nullable/optional, no default that would touch existing rows.
ALTER TABLE "custom_design_orders" ADD COLUMN IF NOT EXISTS "source_b2b_order_id" TEXT;
ALTER TABLE "custom_design_orders" ADD COLUMN IF NOT EXISTS "source_kiosk_order_id" TEXT;
ALTER TABLE "custom_design_orders" ADD COLUMN IF NOT EXISTS "karigar_id" TEXT;
ALTER TABLE "custom_design_orders" ADD COLUMN IF NOT EXISTS "karigar_delivery_date" DATE;
ALTER TABLE "custom_design_orders" ADD COLUMN IF NOT EXISTS "narration_1" TEXT;
ALTER TABLE "custom_design_orders" ADD COLUMN IF NOT EXISTS "narration_2" TEXT;
ALTER TABLE "custom_design_orders" ADD COLUMN IF NOT EXISTS "qc" TEXT;
ALTER TABLE "custom_design_orders" ADD COLUMN IF NOT EXISTS "order_type" TEXT;
ALTER TABLE "custom_design_orders" ADD COLUMN IF NOT EXISTS "order_stage" TEXT;
ALTER TABLE "custom_design_orders" ADD COLUMN IF NOT EXISTS "urgent" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "custom_design_orders_source_b2b_order_id_idx"
    ON "custom_design_orders"("source_b2b_order_id");
CREATE INDEX IF NOT EXISTS "custom_design_orders_source_kiosk_order_id_idx"
    ON "custom_design_orders"("source_kiosk_order_id");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'custom_design_orders_source_b2b_order_id_fkey'
    ) THEN
        ALTER TABLE "custom_design_orders"
            ADD CONSTRAINT "custom_design_orders_source_b2b_order_id_fkey"
            FOREIGN KEY ("source_b2b_order_id") REFERENCES "b2b_orders"("id")
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'custom_design_orders_source_kiosk_order_id_fkey'
    ) THEN
        ALTER TABLE "custom_design_orders"
            ADD CONSTRAINT "custom_design_orders_source_kiosk_order_id_fkey"
            FOREIGN KEY ("source_kiosk_order_id") REFERENCES "kiosk_orders"("id")
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'custom_design_orders_karigar_id_fkey'
    ) THEN
        ALTER TABLE "custom_design_orders"
            ADD CONSTRAINT "custom_design_orders_karigar_id_fkey"
            FOREIGN KEY ("karigar_id") REFERENCES "karigars"("id")
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- b2b_order_items / kiosk_order_items: per-item link to the CustomDesignOrder
-- (JFC-####) it was assigned into, once the manufacturer assigns a Karigar.
ALTER TABLE "b2b_order_items" ADD COLUMN IF NOT EXISTS "customised_order_id" TEXT;
CREATE INDEX IF NOT EXISTS "b2b_order_items_customised_order_id_idx"
    ON "b2b_order_items"("customised_order_id");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'b2b_order_items_customised_order_id_fkey'
    ) THEN
        ALTER TABLE "b2b_order_items"
            ADD CONSTRAINT "b2b_order_items_customised_order_id_fkey"
            FOREIGN KEY ("customised_order_id") REFERENCES "custom_design_orders"("id")
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

ALTER TABLE "kiosk_order_items" ADD COLUMN IF NOT EXISTS "customised_order_id" TEXT;
CREATE INDEX IF NOT EXISTS "kiosk_order_items_customised_order_id_idx"
    ON "kiosk_order_items"("customised_order_id");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'kiosk_order_items_customised_order_id_fkey'
    ) THEN
        ALTER TABLE "kiosk_order_items"
            ADD CONSTRAINT "kiosk_order_items_customised_order_id_fkey"
            FOREIGN KEY ("customised_order_id") REFERENCES "custom_design_orders"("id")
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
