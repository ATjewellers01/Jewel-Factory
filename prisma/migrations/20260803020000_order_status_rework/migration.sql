-- Replaces the order-status workflow (client request): the old
-- Pending/Confirmed/Packed/Shipped/Delivered/Cancelled chain becomes
-- Pending/In Process/Ghat Received/Ready For Delivery/Dispatched/Completed/
-- Cancelled, on both OrderStatus (kiosk_orders, b2b_orders) and
-- CustomOrderStatus (custom_design_orders).
--
-- Postgres can't drop/rename enum values in place, so each enum is recreated
-- and every affected column is cast through a CASE map that carries existing
-- rows forward onto the closest new stage (old Delivered -> new Completed is
-- also the "order actually fulfilled" signal fulfillB2bOrder / the analytics
-- queries key off, so that mapping matters beyond just cosmetics).
--
-- Idempotent: guarded on the old enum still containing 'CONFIRMED' — a
-- database already migrated (or created fresh with the new enum) is a no-op.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'OrderStatus' AND e.enumlabel = 'CONFIRMED'
  ) THEN
    ALTER TYPE "OrderStatus" RENAME TO "OrderStatus_old";
    CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'IN_PROCESS', 'GHAT_RECEIVED', 'READY_FOR_DELIVERY', 'DISPATCHED', 'COMPLETED', 'CANCELLED');

    ALTER TABLE "kiosk_orders" ALTER COLUMN "status" DROP DEFAULT;
    ALTER TABLE "kiosk_orders" ALTER COLUMN "status" TYPE "OrderStatus" USING (
      CASE "status"::text
        WHEN 'CONFIRMED' THEN 'IN_PROCESS'
        WHEN 'PACKED' THEN 'GHAT_RECEIVED'
        WHEN 'SHIPPED' THEN 'DISPATCHED'
        WHEN 'DELIVERED' THEN 'COMPLETED'
        ELSE "status"::text
      END
    )::"OrderStatus";
    ALTER TABLE "kiosk_orders" ALTER COLUMN "status" SET DEFAULT 'PENDING'::"OrderStatus";

    ALTER TABLE "b2b_orders" ALTER COLUMN "status" DROP DEFAULT;
    ALTER TABLE "b2b_orders" ALTER COLUMN "status" TYPE "OrderStatus" USING (
      CASE "status"::text
        WHEN 'CONFIRMED' THEN 'IN_PROCESS'
        WHEN 'PACKED' THEN 'GHAT_RECEIVED'
        WHEN 'SHIPPED' THEN 'DISPATCHED'
        WHEN 'DELIVERED' THEN 'COMPLETED'
        ELSE "status"::text
      END
    )::"OrderStatus";
    ALTER TABLE "b2b_orders" ALTER COLUMN "status" SET DEFAULT 'PENDING'::"OrderStatus";

    DROP TYPE "OrderStatus_old";
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'CustomOrderStatus' AND e.enumlabel = 'CONFIRMED'
  ) THEN
    ALTER TYPE "CustomOrderStatus" RENAME TO "CustomOrderStatus_old";
    CREATE TYPE "CustomOrderStatus" AS ENUM ('PENDING', 'IN_PROCESS', 'GHAT_RECEIVED', 'READY_FOR_DELIVERY', 'DISPATCHED', 'COMPLETED', 'CANCELLED');

    ALTER TABLE "custom_design_orders" ALTER COLUMN "status" DROP DEFAULT;
    ALTER TABLE "custom_design_orders" ALTER COLUMN "status" TYPE "CustomOrderStatus" USING (
      CASE "status"::text
        WHEN 'CONFIRMED' THEN 'IN_PROCESS'
        WHEN 'IN_PRODUCTION' THEN 'IN_PROCESS'
        WHEN 'PACKED' THEN 'GHAT_RECEIVED'
        WHEN 'SHIPPED' THEN 'DISPATCHED'
        WHEN 'DELIVERED' THEN 'COMPLETED'
        ELSE "status"::text
      END
    )::"CustomOrderStatus";
    ALTER TABLE "custom_design_orders" ALTER COLUMN "status" SET DEFAULT 'PENDING'::"CustomOrderStatus";

    DROP TYPE "CustomOrderStatus_old";
  END IF;
END $$;
