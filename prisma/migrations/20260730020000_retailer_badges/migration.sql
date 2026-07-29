-- Manufacturer-defined retailer badges (e.g. "Gold Customer", "Premium").
-- retailer_badge_labels: the manufacturer's own custom dropdown options (starts
-- empty, manufacturer adds values manually). badge_label on stores: which one
-- (if any) is assigned to that retailer.
-- Idempotent: safe to re-run (matches the hand-authored branch_hierarchy style).

ALTER TABLE "manufacturers" ADD COLUMN IF NOT EXISTS "retailer_badge_labels" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "badge_label" TEXT;
