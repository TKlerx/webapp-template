-- Align password identities with Better Auth 1.7; preserve hashes and external accounts.
UPDATE "Account" SET "accountId" = "userId"
WHERE "providerId" = 'credential' AND "accountId" <> "userId";
