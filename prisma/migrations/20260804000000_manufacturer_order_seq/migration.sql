-- Per-manufacturer running counters backing the new JFA-/JFC- order numbers
-- (Catalog/Kiosk orders share one sequence, Customised orders get their own),
-- shared across every retailer + their Retailer Users this manufacturer serves.
--
-- Idempotent: IF NOT EXISTS guards a safe re-run.

ALTER TABLE "manufacturers" ADD COLUMN IF NOT EXISTS "next_catalog_order_seq" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "manufacturers" ADD COLUMN IF NOT EXISTS "next_custom_order_seq" INTEGER NOT NULL DEFAULT 1;
