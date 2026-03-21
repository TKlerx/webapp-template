# Business App Starter

A reusable internal web-app starter built from the extracted platform core of the original product.

## Includes

- Next.js 16 app router
- Prisma + SQLite starter data model
- Azure SSO and local login
- role-based access control
- user administration
- dashboard home screen
- audit trail and export
- i18n, theme toggle, responsive UI
- Vitest, Playwright, Semgrep, duplication checks
- continuity workflow with `CONTINUE.md` and `CONTINUE_LOG.md`

## Validation

```powershell
.\validate.ps1 all
.\validate.ps1 e2e
.\validate.ps1 full
```

## Suggested Next Step

Create a new repository from the `starter-template-extraction` branch and continue product-specific work there.
