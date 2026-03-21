# Starter Template Extraction

## Goal

Create a reusable business-app starter from the current codebase while preserving the `gvi-finance` product history on `main`.

Working branch: `starter-template-extraction`

## Keep In Template

- authentication foundation:
  - Azure SSO
  - local login
  - change-password flow
  - pending approval flow
  - sign out
- session and route protection:
  - session provider
  - auth helpers
  - route auth helpers
  - RBAC foundation
- user administration:
  - create local users
  - approve/deactivate/reactivate users
  - role changes
- signed-in home experience:
  - dashboard remains the default authenticated landing page
  - dashboard acts as the user home screen
  - keep a reusable dashboard shell with role-aware summary cards/sections
- UI platform:
  - app shell
  - dashboard shell
  - top bar and navigation
  - toast notifications
  - dark/light theme
  - locale switcher
  - responsive layout patterns
- platform services:
  - generic audit logging
  - generic audit export foundation if renamed away from finance-specific semantics
  - file storage helpers
  - file upload foundation
  - generic file/document preview foundation
  - base-path support
  - validation and hook workflow
- scoped access foundation:
  - keep the current country-assignment pattern if generalized into org/tenant/team assignment
- data and deployment foundation:
  - Prisma migration/generate/seed workflow
  - Docker deployment setup
- quality/tooling:
  - Playwright
  - Vitest
  - Semgrep
  - duplication checks
  - continuity workflow
  - `.specify` constitution/spec/task workflow

## Remove Or Extract From Template

- finance domain schema and flows:
  - budgets
  - country budgets
  - budget items
  - receipts
  - receipt review
  - compliance dashboard
  - donor and project tagging
  - budget proposals
  - budget templates
- finance pages and APIs:
  - `/review`
  - `/compliance`
  - receipt APIs
  - compliance APIs
- finance-specific services:
  - `src/lib/review.ts`
  - `src/lib/receipts.ts`
  - `src/lib/compliance.ts`
  - `src/lib/budget-validation.ts`
  - `src/lib/audit-export.ts`
- finance-specific tests and specs:
  - `specs/001-*`
  - `specs/002-*`
  - review/compliance/receipt tests

## Generalize Before Extraction

- branding:
  - app name `GVI Finance`
  - package name `gvi-finance`
  - any GVI-specific copy in docs and translations
- base path:
  - replace `/gvi-finance` default assumptions with configurable neutral defaults
- roles:
  - current roles are still product-shaped:
    - `GVI_FINANCE_ADMIN`
    - `COUNTRY_ADMIN`
    - `COUNTRY_FINANCE`
  - likely replace with neutral starter roles such as:
    - `PLATFORM_ADMIN`
    - `ORG_ADMIN`
    - `STANDARD_USER`
- audit types:
  - keep generic audit logging
  - remove finance-specific action enums from the starter
- dashboard content:
  - keep dashboard/home behavior
  - replace finance-specific dashboard widgets with generic starter widgets

## Likely Reusable Core Files

- app shell and providers:
  - `src/app/layout.tsx`
  - `src/app/(dashboard)/layout.tsx`
  - `src/app/(dashboard)/dashboard/page.tsx`
  - `src/components/providers/*`
- auth and session:
  - `src/app/(auth)/*`
  - `src/app/api/auth/*`
  - `src/lib/auth.ts`
  - `src/lib/better-auth.ts`
  - `src/lib/better-auth-route.ts`
  - `src/lib/better-auth-http.ts`
  - `src/lib/azure-auth.ts`
  - `src/lib/route-auth.ts`
- shared UI:
  - `src/components/ui/*`
  - `src/components/auth/*`
- shared infra:
  - `src/lib/audit.ts`
  - `src/lib/audit-export.ts` after generalization
  - `src/lib/db.ts`
  - `src/lib/file-storage.ts`
  - `src/lib/http.ts`
  - `src/lib/base-path.ts`
  - `src/lib/user-management.ts`
- i18n and theme:
  - `src/i18n/*`
  - theme/session/locale APIs and components

## Likely First Removal Slice

1. Remove feature specs and continuity references that assume finance work is still active.
2. Replace app branding and package metadata with neutral starter branding.
3. Rename roles and update seed/auth/user-management flows accordingly.
4. Remove finance-only navigation entries and dashboard widgets.
5. Remove finance-only Prisma models, APIs, services, components, and tests.
6. Regenerate Prisma client and rebuild seed data around generic auth/admin bootstrapping.

## Important Notes

- The Prisma schema is currently the biggest coupling point.
- The navigation and translation files mix reusable platform labels with finance domain labels.
- The starter should preserve generic audit logging, but not finance-specific audit action names.
- The starter should keep a role-aware dashboard as the post-login home screen rather than dropping users into a blank shell.
- `specs/004-*` and `specs/005-*` are also finance-oriented and should not stay in a neutral starter template.
