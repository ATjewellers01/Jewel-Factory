-- Purchase managers (retailers) may register with a mobile number only — older
-- shops don't use email. The login username is the email when present, otherwise
-- the mobile number (owner_phone). An email can be added later from the portal
-- profile page. The existing UNIQUE index on email keeps working: Postgres
-- treats NULLs as distinct, so many email-less stores can coexist.
ALTER TABLE "stores" ALTER COLUMN "email" DROP NOT NULL;

-- Login-by-mobile looks the store up by owner_phone, so index it.
CREATE INDEX IF NOT EXISTS "stores_owner_phone_idx" ON "stores" ("owner_phone");
