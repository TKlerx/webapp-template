# Implementation Plan: Budget Planning & Core Data Model

**Branch**: `001-budget-planning-core` | **Date**: 2026-03-20 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/001-budget-planning-core/spec.md`

## Summary

Replace the placeholder role system and empty dashboard with a complete budget planning foundation: budget years, country budgets, hierarchical budget items, receipt upload with immutable file storage, domain-specific roles (GVI Finance Admin, Country Admin, Country Finance) with country-scoped access, donor project tagging, budget overview with planned vs. actual, and audit trail. This is the core data model on which all subsequent features (review, reporting, export, AI) depend.

## Technical Context

**Language/Version**: TypeScript 5.x with Next.js 16 (App Router)
**Primary Dependencies**: Prisma 7, BetterAuth 1.5.4, next-intl 4.8, Tailwind CSS 4, bcryptjs
**Storage**: SQLite via Prisma (future: PostgreSQL or MS SQL). File storage on local filesystem (immutable, 10-year retention).
**Testing**: Vitest (unit), Playwright (E2E)
**Target Platform**: Web application (browser), served under configurable base path `/gvi-finance`
**Project Type**: Full-stack web application (Next.js App Router — unified frontend + API)
**Performance Goals**: Budget hierarchy with 50+ items loads in <3 seconds; receipt upload completes in <2 minutes end-to-end
**Constraints**: ~10 users, single instance, no horizontal scaling needed. 20 MB max file upload.
**Scale/Scope**: Up to 30 countries, ~50 budget items per country, hundreds of receipts per month

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Simplicity First | ✅ Pass | No unnecessary abstractions. Self-referencing hierarchy is the simplest model for unlimited depth. |
| II. Test Coverage | ✅ Pass | Plan includes unit tests for services, integration tests for API routes, E2E tests for user workflows. |
| III. Duplication Control | ✅ Pass | Shared validation logic for budget item constraints. Reuse existing auth infrastructure. |
| IV. Incremental Delivery | ✅ Pass | P1 stories (budget, roles, receipts) first, then P2 (donors, overview). Each independently testable. |
| V. Azure OpenAI Integration | ✅ N/A | No AI features in this feature. |
| VI. Web Application Standards | ✅ Pass | Base path respected, toast notifications for user actions. |
| VII. Internationalization | ✅ Pass | All new UI text uses next-intl translation keys across 5 locales. |
| VIII. Responsive Design | ✅ Pass | Mobile-first Tailwind, collapsible tree view for budget hierarchy. |

## Project Structure

### Documentation (this feature)

```text
specs/001-budget-planning-core/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (API contracts)
└── tasks.md             # Phase 2 output (via /speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── api/
│   │   ├── budget-years/          # CRUD for budget years
│   │   │   └── [id]/
│   │   ├── countries/             # Program country management
│   │   │   └── [id]/
│   │   ├── country-budgets/       # Country budget within a year
│   │   │   └── [id]/
│   │   ├── budget-items/          # Hierarchical budget items
│   │   │   └── [id]/
│   │   ├── receipts/              # Receipt upload and management
│   │   │   └── [id]/
│   │   ├── donors/                # Institutional donors
│   │   │   └── [id]/
│   │   ├── donor-projects/        # Donor project management + tagging
│   │   │   └── [id]/
│   │   ├── budget-proposals/      # Country Admin budget proposals
│   │   │   └── [id]/
│   │   └── audit/                 # Audit trail query
│   ├── (dashboard)/
│   │   ├── budget-years/          # Budget year list + detail pages
│   │   │   └── [id]/
│   │   ├── budgets/               # Country budget + item hierarchy view
│   │   │   └── [countryBudgetId]/
│   │   ├── receipts/              # Receipt list + upload + detail
│   │   │   └── [id]/
│   │   ├── donors/                # Donor + project management
│   │   │   └── [id]/
│   │   ├── budget-overview/       # Planned vs. actual overview
│   │   └── proposals/             # Budget change proposals (Country Admin)
│   └── ...existing auth pages
├── components/
│   ├── budget/                    # Budget-specific components
│   │   ├── BudgetItemTree.tsx     # Collapsible tree view
│   │   ├── BudgetItemForm.tsx     # Add/edit budget item
│   │   ├── BudgetOverview.tsx     # Planned vs actual display
│   │   ├── TemplateList.tsx       # Template management list
│   │   ├── TemplateEditor.tsx     # Create/edit template hierarchy
│   │   └── TemplateSelector.tsx   # Select template when creating budget
│   ├── receipts/                  # Receipt components
│   │   ├── ReceiptUploadForm.tsx  # File + metadata upload
│   │   └── ReceiptList.tsx        # Receipt table with filters
│   ├── donors/                    # Donor project components
│   └── ui/                        # Shared UI (existing + new)
├── lib/
│   ├── rbac.ts                    # Extended with new roles + country scoping
│   ├── audit.ts                   # Audit trail logging service
│   ├── file-storage.ts            # Immutable file storage service
│   ├── budget-validation.ts       # Child sum ≤ parent validation
│   └── ...existing libs
├── i18n/
│   └── messages/                  # Extended with budget/receipt/donor keys
prisma/
├── schema.prisma                  # Extended with new models
└── migrations/                    # New migrations for budget models
tests/
├── unit/
│   ├── budget-validation.test.ts
│   ├── rbac.test.ts
│   └── audit.test.ts
├── e2e/
│   ├── budget-management.spec.ts
│   ├── receipt-upload.spec.ts
│   ├── role-access.spec.ts
│   └── donor-tagging.spec.ts
uploads/                           # Immutable file storage directory (gitignored)
```

**Structure Decision**: Extends the existing Next.js App Router structure. No new top-level directories except `uploads/` for file storage. All new code follows the established `src/app/api/` + `src/app/(dashboard)/` + `src/components/` + `src/lib/` pattern.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Budget proposal workflow (FR-005a) | Country Admins need to propose changes with approval | Direct edit would bypass GVI Finance oversight |
| Audit trail service | Required by FR-017 and constitution | Inline logging would duplicate logic across all mutation endpoints |
