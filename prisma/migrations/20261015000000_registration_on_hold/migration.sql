-- Adds an ON_HOLD value to RegistrationStatus so the manufacturer can set a
-- registration aside without approving or rejecting it yet. Existing
-- PENDING/APPROVED/REJECTED rows are untouched. Idempotent.
ALTER TYPE "RegistrationStatus" ADD VALUE IF NOT EXISTS 'ON_HOLD';
