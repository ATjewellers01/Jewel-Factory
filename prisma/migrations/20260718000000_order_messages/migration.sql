-- Order messages (HO Manager <-> Store Manager per-order chat) + a "completed"
-- flag the Store Manager sets when the piece reaches the customer/store.
-- Hand-authored + idempotent (safe partial re-run).

-- Enums
DO $$ BEGIN CREATE TYPE "OrderKind" AS ENUM ('KIOSK', 'B2B', 'CUSTOM'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "MessageSender" AS ENUM ('HO', 'STORE_MANAGER'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- order_messages
CREATE TABLE IF NOT EXISTS "order_messages" (
  "id"          TEXT PRIMARY KEY,
  "order_kind"  "OrderKind" NOT NULL,
  "order_id"    TEXT NOT NULL,
  "store_id"    TEXT NOT NULL,
  "branch_id"   TEXT,
  "sender"      "MessageSender" NOT NULL,
  "sender_name" TEXT,
  "body"        TEXT NOT NULL,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "order_messages_order_kind_order_id_idx" ON "order_messages"("order_kind", "order_id");
CREATE INDEX IF NOT EXISTS "order_messages_store_id_idx" ON "order_messages"("store_id");

-- completed flags
ALTER TABLE "kiosk_orders"            ADD COLUMN IF NOT EXISTS "completed_at" TIMESTAMP(3);
ALTER TABLE "b2b_orders"              ADD COLUMN IF NOT EXISTS "completed_at" TIMESTAMP(3);
ALTER TABLE "custom_design_requests"  ADD COLUMN IF NOT EXISTS "completed_at" TIMESTAMP(3);
