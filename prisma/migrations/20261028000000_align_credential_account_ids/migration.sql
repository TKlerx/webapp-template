-- Better Auth 1.7 identifies password accounts by their owning user ID.
-- Preserve password hashes, account row IDs and all external provider identities.
UPDATE "Account"
SET "accountId" = "userId"
WHERE "providerId" = 'credential' AND "accountId" <> "userId";
