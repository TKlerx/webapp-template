# Dependency Compatibility

## Better Auth and Prisma

The application currently pins `better-auth` to `1.6.30` while retaining Prisma `7.10.0`.

Better Auth 1.7 is not a drop-in dependency update for this repository. Version 1.7 changes account identity to the `(issuer, accountId)` contract. Credential accounts use `issuer = "local:credential"` and the linked user ID as `accountId`. The current Prisma schemas intentionally use the Better Auth 1.6 account shape without `Account.issuer`, and existing credential rows store the normalized email as `Account.accountId`.

Updating Better Auth from 1.6 to 1.7 without the required schema and data migration makes password sign-in reject valid seeded users as `User not found`. Prisma 7.10 itself remains supported by Better Auth 1.6.30 and is not constrained.

Do not relax the exact Better Auth pin until a dedicated migration has:

1. inventoried existing account providers and identities;
2. added and backfilled `Account.issuer` in both SQLite and PostgreSQL schemas;
3. re-keyed credential account IDs from email addresses to stable user IDs;
4. added the required unique `(issuer, accountId)` constraint;
5. updated seed and E2E fixture writers; and
6. verified password login, Microsoft account linking, and existing sessions in a reviewed migration rollout.

The contract test at `tests/unit/auth/better-auth-compatibility.test.ts` prevents an accidental 1.7 upgrade while the legacy schema remains in use.
