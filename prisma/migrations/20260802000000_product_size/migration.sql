-- Bangle size (2.2, 2.4, 2.6 …). Optional free text: the manufacturer's Add
-- Design form only shows the field when the category is Bangles, but the column
-- itself is unconstrained so other categories can use it later if needed.
ALTER TABLE "manufacturer_products" ADD COLUMN IF NOT EXISTS "size" TEXT;
