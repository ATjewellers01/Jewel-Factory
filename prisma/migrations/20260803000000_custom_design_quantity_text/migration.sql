-- Client wants "quantity" on custom design requests/orders to accept free
-- text like "2 pcs", not a strict integer count. Widen the column from
-- INTEGER to TEXT on both tables, preserving any existing numeric values
-- (2 -> "2") via an explicit cast.
--
-- Idempotent: only runs the ALTER if the column is still an integer type, so
-- a re-run (or a DB that already has TEXT here) is a no-op.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'custom_design_requests' AND column_name = 'quantity' AND data_type <> 'text'
  ) THEN
    ALTER TABLE "custom_design_requests" ALTER COLUMN "quantity" TYPE TEXT USING "quantity"::TEXT;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'custom_design_orders' AND column_name = 'quantity' AND data_type <> 'text'
  ) THEN
    ALTER TABLE "custom_design_orders" ALTER COLUMN "quantity" TYPE TEXT USING "quantity"::TEXT;
  END IF;
END $$;
