-- Retailer Users (branch managers) may register with a mobile number only,
-- mirroring the retailer-admin (Store) email-optional change. The login
-- username is the email when present, otherwise the mobile number (phone);
-- the password is always the mobile number. name becomes optional too since
-- the Add-Retailer-User form no longer collects a free-text name.
ALTER TABLE "branch_managers" ALTER COLUMN "name" DROP NOT NULL;
ALTER TABLE "branch_managers" ALTER COLUMN "email" DROP NOT NULL;

-- Login-by-mobile looks the branch manager up by phone, so index it.
CREATE INDEX IF NOT EXISTS "branch_managers_phone_idx" ON "branch_managers" ("phone");
