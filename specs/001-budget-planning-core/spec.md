# Feature Specification: Budget Planning & Core Data Model

**Feature Branch**: `001-budget-planning-core`
**Created**: 2026-03-19
**Status**: Draft
**Input**: User description: "Budget Planning and Core Data Model for GVI Finance"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - GVI Finance Admin Creates Budget Year and Country Budgets (Priority: P1)

A GVI Finance administrator opens the application at the start of a new budget year. They create a new budget year (e.g., 2026), then add program countries with their total allocated budgets and currencies. For each country, they build a hierarchical chart of budget items — for example, a top-level "Personnel" category containing "Salaries", "Social Contributions", and "Training" as children. Each budget item has a planned amount. The hierarchy supports unlimited nesting depth.

**Why this priority**: The budget structure is the foundation for everything else — receipts, reviews, donor reporting all reference budget items. Nothing works without this.

**Independent Test**: Can be fully tested by creating a budget year, adding countries with total budgets, and building a multi-level budget item hierarchy. Delivers value by replacing the Power App for budget planning.

**Acceptance Scenarios**:

1. **Given** a GVI Finance admin is logged in, **When** they create a new budget year "2026", **Then** the budget year is saved and appears in the budget year list.
2. **Given** a budget year exists, **When** the admin adds a country "Kenya" with total budget €50,000 (EUR), **Then** Kenya appears under that budget year with the correct total and currency.
3. **Given** a country budget exists, **When** the admin creates a top-level budget item "Personnel" with amount €30,000, **Then** it appears as a root item under that country's budget.
4. **Given** a budget item "Personnel" exists, **When** the admin adds a child item "Salaries" with amount €20,000, **Then** "Salaries" appears nested under "Personnel".
5. **Given** a budget item hierarchy exists three levels deep, **When** the admin views the hierarchy, **Then** all levels are displayed in a collapsible tree view with their amounts.

---

### User Story 2 - Roles and Country Assignment (Priority: P1)

A GVI Finance admin manages user accounts with domain-specific roles. They assign a user as "Country Finance" for Kenya, meaning that user can only see and act on Kenya's data. A "Country Admin" can manage their own country's users and data. GVI Finance staff have a global view across all countries.

**Why this priority**: Without role-based access scoped to countries, no other feature can be used securely. This is co-equal with the budget structure as a foundation.

**Independent Test**: Can be tested by creating users with different roles, assigning them to countries, and verifying they only see their permitted data.

**Acceptance Scenarios**:

1. **Given** a GVI Finance admin is logged in, **When** they create a user and assign the role "Country Finance" with country "Kenya", **Then** that user can only see Kenya's budget and data after logging in.
2. **Given** a Country Admin for Kenya is logged in, **When** they navigate to another country's data, **Then** they are denied access.
3. **Given** a GVI Finance admin is logged in, **When** they view the dashboard, **Then** they see an overview of all countries and their budgets.
4. **Given** a user exists with the "Country Finance" role, **When** the GVI Finance admin changes their country assignment, **Then** the user's data access changes accordingly.

---

### User Story 3 - Receipt Upload and Budget Item Assignment (Priority: P1)

A Country Finance user in Kenya needs to submit an expense. They open the portal, select the budget year and their country (pre-filtered to their assignment), and upload a receipt file (PDF, image, or scan). They fill in the receipt amount, date, a brief description, and select the budget item this receipt belongs to — typically a leaf-level item like "Fuel" under "Mission Costs", but they may also assign it to a higher-level item if needed. The receipt is stored revision-safe for 10 years.

**Why this priority**: This is the core action that replaces the monthly Excel reports — the primary automation goal.

**Independent Test**: Can be tested by uploading a receipt, assigning it to a budget item, and verifying it appears in the budget item's receipt list with correct metadata.

**Acceptance Scenarios**:

1. **Given** a Country Finance user for Kenya is logged in, **When** they upload a receipt file with amount, date, description, and select budget item "Fuel", **Then** the receipt is saved and appears under "Fuel" in the budget view.
2. **Given** a receipt is being uploaded, **When** the user selects a non-leaf budget item "Mission Costs", **Then** the system accepts the assignment (no leaf-only restriction).
3. **Given** a receipt has been uploaded, **When** any user attempts to modify or delete the original file, **Then** the system prevents it (revision-safe storage).
4. **Given** a receipt has been uploaded, **When** a GVI Finance admin views Kenya's budget item "Fuel", **Then** they see the receipt with its file, amount, date, and description.
5. **Given** multiple receipts are assigned to items in a hierarchy, **When** the admin views a parent item, **Then** they see the rolled-up total of all receipts in child items plus any directly assigned.

---

### User Story 4 - Donor Project Tagging (Priority: P2)

A GVI Finance admin creates a donor project (e.g., "EU Grant 2026 - Kenya Education") linked to an institutional donor. They then tag specific budget items or individual receipts to that donor project. When an entire budget item is tagged, all current and future receipts under it are implicitly included. This tagging is the groundwork for one-click donor reports in a later feature.

**Why this priority**: The data model and tagging capability must exist early so that receipts uploaded from day one can be tagged to donor projects. The actual report generation is a later feature.

**Independent Test**: Can be tested by creating a donor project, tagging a budget item and an individual receipt to it, and verifying the tagged items are retrievable by donor project.

**Acceptance Scenarios**:

1. **Given** a GVI Finance admin is logged in, **When** they create a donor project "EU Grant 2026 - Kenya Education" for donor "European Union", **Then** the project is saved and appears in the donor project list.
2. **Given** a donor project exists, **When** the admin tags the budget item "Personnel" for Kenya to that project, **Then** all receipts under "Personnel" and its children are implicitly associated with the donor project.
3. **Given** a donor project exists, **When** the admin tags an individual receipt (not via its budget item) to the project, **Then** that receipt is associated regardless of its budget item's tagging status.
4. **Given** a budget item is tagged to a donor project, **When** a Country Finance user uploads a new receipt under that budget item, **Then** the receipt is automatically included in the donor project scope.
5. **Given** a donor project has tagged items, **When** the admin views the donor project, **Then** they see a summary of all tagged budget items and receipts with their total amounts.

---

### User Story 5 - Budget Overview and Compliance View (Priority: P2)

A GVI Finance admin opens the budget overview for a specific country and year. They see the full budget hierarchy with planned amounts and actual spend (sum of receipts) at each level. Items where actual exceeds planned are visually highlighted. The admin can drill down into any budget item to see its child items and receipts.

**Why this priority**: Essential for the goal of spot-checking program countries more easily. Builds on the data from stories 1 and 3.

**Independent Test**: Can be tested by creating a budget with items and uploading receipts, then verifying the overview correctly displays planned vs. actual at each hierarchy level.

**Acceptance Scenarios**:

1. **Given** a country budget has items with receipts, **When** a GVI Finance admin opens the budget overview for that country and year, **Then** they see each budget item with its planned amount and actual spend (sum of receipts).
2. **Given** a budget item "Fuel" has planned €10,000 and receipts totalling €12,000, **When** the overview is displayed, **Then** "Fuel" is visually marked as over-budget.
3. **Given** a parent item "Mission Costs" has children "Fuel" and "Accommodation", **When** the admin views "Mission Costs", **Then** the actual spend shown is the sum of all receipts in "Fuel", "Accommodation", and any directly assigned to "Mission Costs".
4. **Given** the budget overview is displayed, **When** the admin clicks on a budget item, **Then** they see the child items and/or a list of receipts assigned to that item.

---

### User Story 6 - Budget Templates (Priority: P2)

A GVI Finance admin creates reusable budget templates to speed up budget setup for new years or new countries. A template defines a hierarchy of budget items with default planned amounts. When creating a new country budget, the admin can select a template to pre-populate the entire hierarchy — then adjust names, amounts, or structure as needed. Templates can also be created from an existing country budget ("Save as template"), capturing that country's current structure and amounts as a reusable starting point for next year.

**Why this priority**: Without templates, the admin must manually recreate 50+ budget items for each country each year. Templates save significant time and reduce errors, especially when most countries share a similar budget structure.

**Independent Test**: Can be tested by creating a template with a multi-level hierarchy and amounts, then applying it to a new country budget and verifying the items are copied correctly. Also test saving an existing country budget as a template.

**Acceptance Scenarios**:

1. **Given** a GVI Finance admin is logged in, **When** they create a new budget template "Standard Country Budget" with a hierarchy of items and default amounts, **Then** the template is saved and appears in the template list.
2. **Given** a template exists with items "Personnel (€30,000) → Salaries (€20,000), Training (€10,000)", **When** the admin creates a new country budget for Kenya 2027 and selects this template, **Then** the budget items are pre-populated with the template's hierarchy and amounts.
3. **Given** a template has been applied, **When** the admin adjusts item names or amounts for Kenya, **Then** the changes only affect Kenya's budget — the template remains unchanged.
4. **Given** a country budget for Kenya 2026 exists with a complete hierarchy, **When** the admin clicks "Save as Template", **Then** a new template is created with Kenya 2026's hierarchy and amounts, which can be named and reused.
5. **Given** multiple templates exist, **When** the admin creates a new country budget, **Then** they can choose from the template list or start with an empty budget.

---

### Edge Cases

- What happens when a budget item is deleted that has receipts assigned? The system must prevent deletion or require reassignment first.
- What happens when a budget item's planned amount is changed after receipts exist? The planned amount updates; receipts and their amounts are unaffected.
- What happens when a country's currency differs from the receipt currency? The system stores the receipt in its original currency; conversion handling is deferred to a later feature.
- What happens when a budget item is moved in the hierarchy? Its receipts move with it; rolled-up totals recalculate automatically.
- What happens when a user's country assignment is removed? They lose access to that country's data immediately; their previously uploaded receipts remain.
- What happens when a receipt file upload fails mid-transfer? The receipt record is not created; the user is informed and can retry.
- What happens when a template is deleted that was previously applied to country budgets? The country budgets are unaffected — template application is a copy operation, not a link. The template can be safely deleted.
- What happens when a template's amounts exceed the country budget's total? The system applies the template and then the normal child sum ≤ parent validation applies. The admin must adjust amounts to fit within the country's total budget.

## Clarifications

### Session 2026-03-19

- Q: Should child budget items' planned amounts be constrained relative to the parent? → A: Children must sum to ≤ parent amount (block if over, warn if under).
- Q: Can receipt metadata (amount, date, description, budget item) be edited after upload? → A: Yes, editable with full audit trail (who, when, old→new value). File remains immutable.
- Q: Can Country Admins create/edit budget items for their country? → A: Country Admins can propose budget item changes; GVI Finance Admins must approve before they take effect.
- Q: Can a donor project span multiple countries? → A: Yes, a donor project can cover budget items and receipts across multiple countries.
- Q: Can a user hold a country-scoped role for multiple countries? → A: Yes, a single user can be assigned the same role (Country Admin or Country Finance) for multiple countries.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST support creating budget years with a label (e.g., "2026") and date range.
- **FR-002**: System MUST support adding program countries to a budget year, each with a total budget amount and currency.
- **FR-003**: System MUST support creating budget items in a multi-level hierarchy (unlimited depth) with self-referencing parent-child relationships.
- **FR-004**: Each budget item MUST have a name, planned amount, and optional description.
- **FR-004a**: The sum of child items' planned amounts MUST NOT exceed the parent item's planned amount. The system MUST block saving if exceeded and MUST display a warning if the sum is less than the parent amount (indicating unallocated budget).
- **FR-005**: System MUST support the following user roles: GVI Finance Admin (global access, full edit), Country Admin (manages assigned countries, can propose budget changes), Country Finance (uploads receipts for assigned countries, read-only on budget items).
- **FR-005a**: Country Admins MUST be able to propose budget item changes (add, edit, remove) for their country. Proposals MUST be reviewed and approved by a GVI Finance Admin before taking effect. Proposals and their approval/rejection MUST be recorded in the audit trail.
- **FR-006**: Users with country-scoped roles MUST be assigned to one or more specific countries and can only access data for those countries.
- **FR-007**: System MUST allow uploading receipt files (PDF, JPEG, PNG) with metadata: amount, currency, date, description.
- **FR-008**: Receipts MUST be assignable to any budget item in the hierarchy, not only leaf-level items.
- **FR-009**: Uploaded receipt files MUST be stored revision-safe (immutable once uploaded) with a retention period of 10 years.
- **FR-010**: System MUST calculate rolled-up actual spend at each hierarchy level by summing receipts of the item itself and all descendant items.
- **FR-011**: System MUST support creating institutional donors and donor-funded projects.
- **FR-012**: System MUST allow tagging individual receipts or entire budget items to a donor project.
- **FR-013**: When a budget item is tagged to a donor project, all receipts under that item and its descendants MUST be implicitly included in the donor project scope.
- **FR-014**: System MUST display a budget overview showing planned vs. actual spend per budget item with visual indicators for over-budget items.
- **FR-015**: System MUST provide a drill-down view from any budget item to its children and assigned receipts.
- **FR-016**: System MUST prevent deletion of budget items that have receipts assigned (directly or via descendants).
- **FR-017**: System MUST maintain audit trails for budget changes, receipt uploads, role changes, and donor project tagging.
- **FR-018**: All user-facing text MUST be available in all supported languages (en, de, es, fr, pt).
- **FR-019**: System MUST support creating named budget templates with a hierarchical structure of items and default planned amounts.
- **FR-020**: GVI Finance admins MUST be able to apply a template when creating a new country budget, pre-populating all budget items and amounts from the template.
- **FR-021**: Applying a template MUST be a copy operation — changes to the country budget MUST NOT affect the template, and vice versa.
- **FR-022**: System MUST support creating a template from an existing country budget ("Save as Template"), capturing the current hierarchy and amounts.
- **FR-023**: System MUST support multiple named templates. GVI Finance admins MUST be able to create, edit, and delete templates.

### Key Entities

- **Budget Year**: Represents a fiscal year with a label and date range. Contains country budgets.
- **Country Budget**: Links a program country to a budget year with a total allocated amount and currency. Contains budget items.
- **Program Country**: A country where GVI operates. Has assigned users and budgets per year.
- **Budget Item**: A line in the budget hierarchy. Has a name, planned amount, optional description, and optional parent (self-referencing for unlimited depth). Belongs to a country budget.
- **Receipt**: An uploaded expense record. Has an amount, currency, date, description, uploaded file reference, and is assigned to one budget item. File is immutable; metadata (amount, date, description, budget item assignment) is editable with full audit trail.
- **Receipt File**: The stored file (PDF/image) associated with a receipt. Immutable, retained for 10 years.
- **Institutional Donor**: An organization that funds projects (e.g., "European Union").
- **Donor Project**: A funded project by a donor, with a name and description. Can span multiple countries. Receipts and budget items from any country can be tagged to it.
- **Donor Project Tag**: The association between a donor project and either a budget item or an individual receipt.
- **Budget Template**: A reusable blueprint for a budget hierarchy with default planned amounts. Has a name and description. Contains template items.
- **Budget Template Item**: A line in a template's hierarchy. Has a name, default planned amount, optional description, and optional parent (self-referencing). Belongs to a budget template.
- **User**: An application user with a role and optional country assignment(s).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: GVI Finance admins can create a complete country budget (year, country, 50+ hierarchical budget items) in under 30 minutes, replacing the Power App workflow.
- **SC-002**: Country Finance staff can upload and assign a receipt to a budget item in under 2 minutes.
- **SC-003**: GVI Finance admins can see planned vs. actual spend for any country within 3 clicks from the dashboard.
- **SC-004**: All uploaded receipt files are retained immutably for 10 years and cannot be modified or deleted by any user.
- **SC-005**: Users with country-scoped roles cannot access any data outside their assigned countries (100% access isolation).
- **SC-006**: Budget item hierarchy supports at least 5 levels of nesting with correct roll-up calculations at every level.
- **SC-007**: Donor project tagging of a budget item correctly includes all current and future descendant receipts without manual re-tagging.
- **SC-008**: Applying a budget template to a new country budget pre-populates all items in under 5 seconds, reducing budget setup time by at least 75% compared to manual creation.

## Assumptions

- Receipt currency may differ from the budget currency. For this feature, amounts are stored as-is in their original currency. Currency conversion and multi-currency aggregation are deferred to a later feature.
- The existing Power App data (budget items from Azure DB) will be migrated manually or via a one-time import script, not as part of this feature's UI.
- The application's existing authentication system (BetterAuth + Azure SSO) is reused. The existing placeholder roles (ADMIN, MARKETER_LEAD, MARKETER, REVIEWER) will be replaced with the domain roles defined in FR-005.
- Receipt file size limit is 20 MB per file, which accommodates high-resolution scans.
- A receipt is assigned to exactly one budget item (not multiple).
- Budget years do not overlap for the same country.

## Scope Boundaries

**In scope**:
- Budget year and country budget management
- Hierarchical budget item CRUD
- Receipt upload with file storage and budget item assignment
- Domain-specific user roles with country-scoped access
- Donor and donor project management with tagging
- Budget templates (create, apply, save from existing budget)
- Budget overview with planned vs. actual and drill-down
- Audit trail for all data mutations

**Out of scope (later features)**:
- Donor project report generation (one-click PDF/export) — Feature 4
- Azure DB export for Power BI — Feature 5
- AI-powered receipt classification and OCR — Feature 6
- Mobile camera capture workflow — Feature 7
- Currency conversion between receipt and budget currencies
- Budget approval workflows between GVI and countries
- Bulk import of budget data from the existing Power App/Azure DB
