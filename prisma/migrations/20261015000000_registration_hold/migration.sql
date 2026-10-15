-- AlterTable: "Hold" for store registrations. Status stays PENDING while held,
-- so login/approval logic is unchanged; these columns only park the row.
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "registration_on_hold_at" TIMESTAMP(3);
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "registration_hold_note" TEXT;
