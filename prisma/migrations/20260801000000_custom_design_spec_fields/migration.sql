-- Customised orders now carry the full counter spec the Retailer User writes
-- down with the customer (order number, delivery date, pieces, meena, length,
-- size, broadness, screw, sample weight) plus a proper sub-category column.
--
-- Everything is nullable: existing requests keep working untouched, and a
-- request can still be just a photo and a rough weight.
--
-- `order_ref` is the SHOP's own order number. It is NOT `custom_design_orders.
-- order_number`, which this system generates (CD-YYYYMMDD-XXXX).

ALTER TABLE "custom_design_requests"
  ADD COLUMN IF NOT EXISTS "sub_category"        TEXT,
  ADD COLUMN IF NOT EXISTS "order_ref"           TEXT,
  ADD COLUMN IF NOT EXISTS "delivery_date"       DATE,
  ADD COLUMN IF NOT EXISTS "quantity"            INTEGER,
  ADD COLUMN IF NOT EXISTS "meena"               TEXT,
  ADD COLUMN IF NOT EXISTS "length"              TEXT,
  ADD COLUMN IF NOT EXISTS "size"                TEXT,
  ADD COLUMN IF NOT EXISTS "broadness"           TEXT,
  ADD COLUMN IF NOT EXISTS "screw"               TEXT,
  ADD COLUMN IF NOT EXISTS "sample_weight_grams" DECIMAL(8,3);

ALTER TABLE "custom_design_orders"
  ADD COLUMN IF NOT EXISTS "sub_category"        TEXT,
  ADD COLUMN IF NOT EXISTS "order_ref"           TEXT,
  ADD COLUMN IF NOT EXISTS "delivery_date"       DATE,
  ADD COLUMN IF NOT EXISTS "quantity"            INTEGER,
  ADD COLUMN IF NOT EXISTS "meena"               TEXT,
  ADD COLUMN IF NOT EXISTS "length"              TEXT,
  ADD COLUMN IF NOT EXISTS "size"                TEXT,
  ADD COLUMN IF NOT EXISTS "broadness"           TEXT,
  ADD COLUMN IF NOT EXISTS "screw"               TEXT,
  ADD COLUMN IF NOT EXISTS "sample_weight_grams" DECIMAL(8,3);
