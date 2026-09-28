-- Manufacturer "Customer Activity" audit log (2026-09-28) — append-only
-- LOGIN/LOGOUT events for the Retailer (store) and Store Manager
-- (branch_manager) portals. Additive, no backfill; plain string ids like
-- tryon_events/product_sales (no FK to stores/branch_managers/manufacturers).

DO $$ BEGIN
  CREATE TYPE "LoginEventUserType" AS ENUM ('RETAILER', 'BRANCH_MANAGER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "LoginEventKind" AS ENUM ('LOGIN', 'LOGOUT');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "login_events" (
  "id" TEXT NOT NULL,
  "user_type" "LoginEventUserType" NOT NULL,
  "event" "LoginEventKind" NOT NULL,
  "store_id" TEXT NOT NULL,
  "branch_manager_id" TEXT,
  "branch_id" TEXT,
  "manufacturer_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "login_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "login_events_manufacturer_id_created_at_idx" ON "login_events" ("manufacturer_id", "created_at");
CREATE INDEX IF NOT EXISTS "login_events_store_id_created_at_idx" ON "login_events" ("store_id", "created_at");
CREATE INDEX IF NOT EXISTS "login_events_branch_manager_id_created_at_idx" ON "login_events" ("branch_manager_id", "created_at");
