# API Contracts: Budget Planning & Core Data Model

**Date**: 2026-03-20

All endpoints require authentication. Role restrictions noted per endpoint.
Base path: `/gvi-finance` (configurable).
All responses follow `{ data: T }` or `{ error: string }` pattern.

---

## Budget Years

### `GET /api/budget-years`
**Roles**: All authenticated users
**Response**: `{ data: BudgetYear[] }`

### `POST /api/budget-years`
**Roles**: GVI_FINANCE_ADMIN
**Body**: `{ label: string, startDate: string, endDate: string }`
**Response**: `{ data: BudgetYear }` (201)

### `GET /api/budget-years/[id]`
**Roles**: All authenticated users
**Response**: `{ data: BudgetYear & { countryBudgets: CountryBudget[] } }`

### `PATCH /api/budget-years/[id]`
**Roles**: GVI_FINANCE_ADMIN
**Body**: `{ label?: string, startDate?: string, endDate?: string }`
**Response**: `{ data: BudgetYear }`

### `DELETE /api/budget-years/[id]`
**Roles**: GVI_FINANCE_ADMIN
**Response**: `204` (only if no country budgets exist)

---

## Countries

### `GET /api/countries`
**Roles**: All (country-scoped users see only assigned countries)
**Response**: `{ data: ProgramCountry[] }`

### `POST /api/countries`
**Roles**: GVI_FINANCE_ADMIN
**Body**: `{ name: string, code: string }`
**Response**: `{ data: ProgramCountry }` (201)

---

## Country Budgets

### `GET /api/country-budgets?budgetYearId=X&countryId=Y`
**Roles**: All (country-scoped)
**Response**: `{ data: CountryBudget[] }`

### `POST /api/country-budgets`
**Roles**: GVI_FINANCE_ADMIN
**Body**: `{ budgetYearId: string, countryId: string, totalAmount: number, currency: string }`
**Response**: `{ data: CountryBudget }` (201)

### `GET /api/country-budgets/[id]`
**Roles**: All (country-scoped)
**Response**: `{ data: CountryBudget & { budgetItems: BudgetItem[] } }`

### `PATCH /api/country-budgets/[id]`
**Roles**: GVI_FINANCE_ADMIN
**Body**: `{ totalAmount?: number, currency?: string }`
**Response**: `{ data: CountryBudget }`

---

## Budget Items

### `GET /api/budget-items?countryBudgetId=X`
**Roles**: All (country-scoped)
**Response**: `{ data: BudgetItem[] }` (flat list; client builds tree)

### `POST /api/budget-items`
**Roles**: GVI_FINANCE_ADMIN
**Body**: `{ countryBudgetId: string, parentId?: string, name: string, plannedAmount: number, description?: string }`
**Validation**: Child sum ≤ parent amount
**Response**: `{ data: BudgetItem }` (201)

### `PATCH /api/budget-items/[id]`
**Roles**: GVI_FINANCE_ADMIN
**Body**: `{ name?: string, plannedAmount?: number, description?: string, parentId?: string, sortOrder?: number }`
**Validation**: Child sum ≤ parent amount (after update)
**Response**: `{ data: BudgetItem }`

### `DELETE /api/budget-items/[id]`
**Roles**: GVI_FINANCE_ADMIN
**Validation**: No receipts assigned (directly or via descendants)
**Response**: `204`

### `GET /api/budget-items/[id]/overview`
**Roles**: All (country-scoped)
**Response**: `{ data: { item: BudgetItem, actualSpend: number, children: BudgetItemOverview[], receipts: Receipt[] } }`

---

## Receipts

### `GET /api/receipts?budgetItemId=X&countryId=Y`
**Roles**: All (country-scoped; Country Finance sees own uploads)
**Query params**: budgetItemId, countryId, dateFrom, dateTo
**Response**: `{ data: Receipt[] }`

### `POST /api/receipts`
**Roles**: GVI_FINANCE_ADMIN, COUNTRY_FINANCE
**Content-Type**: `multipart/form-data`
**Fields**: `file` (binary), `budgetItemId`, `amount`, `currency`, `date`, `description`
**Validation**: File type (PDF/JPEG/PNG), file size (≤20 MB)
**Response**: `{ data: Receipt }` (201)

### `GET /api/receipts/[id]`
**Roles**: All (country-scoped)
**Response**: `{ data: Receipt & { budgetItem: BudgetItem, uploadedBy: User } }`

### `PATCH /api/receipts/[id]`
**Roles**: GVI_FINANCE_ADMIN, COUNTRY_FINANCE (own receipts)
**Body**: `{ amount?: number, currency?: string, date?: string, description?: string, budgetItemId?: string }`
**Note**: File cannot be changed. All changes recorded in audit trail.
**Response**: `{ data: Receipt }`

### `GET /api/receipts/[id]/file`
**Roles**: All (country-scoped)
**Response**: Binary file stream with correct Content-Type and Content-Disposition headers

---

## Donors & Donor Projects

### `GET /api/donors`
**Roles**: GVI_FINANCE_ADMIN
**Response**: `{ data: InstitutionalDonor[] }`

### `POST /api/donors`
**Roles**: GVI_FINANCE_ADMIN
**Body**: `{ name: string, description?: string }`
**Response**: `{ data: InstitutionalDonor }` (201)

### `GET /api/donor-projects?donorId=X`
**Roles**: GVI_FINANCE_ADMIN
**Response**: `{ data: DonorProject[] }`

### `POST /api/donor-projects`
**Roles**: GVI_FINANCE_ADMIN
**Body**: `{ donorId: string, name: string, description?: string }`
**Response**: `{ data: DonorProject }` (201)

### `GET /api/donor-projects/[id]`
**Roles**: GVI_FINANCE_ADMIN
**Response**: `{ data: DonorProject & { tags: DonorProjectTag[], summary: { totalPlanned: number, totalActual: number, receiptCount: number } } }`

### `POST /api/donor-projects/[id]/tags`
**Roles**: GVI_FINANCE_ADMIN
**Body**: `{ budgetItemId?: string, receiptId?: string }` (exactly one)
**Response**: `{ data: DonorProjectTag }` (201)

### `DELETE /api/donor-projects/[id]/tags/[tagId]`
**Roles**: GVI_FINANCE_ADMIN
**Response**: `204`

---

## Budget Proposals

### `GET /api/budget-proposals?countryBudgetId=X&status=Y`
**Roles**: GVI_FINANCE_ADMIN (all), COUNTRY_ADMIN (own country)
**Response**: `{ data: BudgetProposal[] }`

### `POST /api/budget-proposals`
**Roles**: COUNTRY_ADMIN
**Body**: `{ countryBudgetId: string, type: "ADD"|"EDIT"|"REMOVE", targetBudgetItemId?: string, payload: { name?: string, plannedAmount?: number, parentId?: string, description?: string } }`
**Response**: `{ data: BudgetProposal }` (201)

### `PATCH /api/budget-proposals/[id]`
**Roles**: GVI_FINANCE_ADMIN
**Body**: `{ status: "APPROVED"|"REJECTED", reviewComment?: string }`
**Note**: On APPROVED, the proposed change is applied to budget items automatically.
**Response**: `{ data: BudgetProposal }`

---

## Audit Trail

### `GET /api/audit?action=X&entityType=Y&countryId=Z&dateFrom=A&dateTo=B&actorId=C`
**Roles**: GVI_FINANCE_ADMIN
**Response**: `{ data: AuditEntry[], total: number }`

---

## User Country Assignments (extends existing user management)

### `GET /api/users/[id]/countries`
**Roles**: GVI_FINANCE_ADMIN
**Response**: `{ data: ProgramCountry[] }`

### `PUT /api/users/[id]/countries`
**Roles**: GVI_FINANCE_ADMIN
**Body**: `{ countryIds: string[] }`
**Response**: `{ data: ProgramCountry[] }`
