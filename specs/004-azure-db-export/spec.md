# Feature Specification: Azure DB Export for Power BI

**Feature Branch**: `004-azure-db-export`
**Created**: 2026-03-19
**Status**: Draft
**Input**: User description: "Azure DB Export — export financial data to Azure SQL Database for Power BI reporting"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - GVI Finance Admin Triggers Data Export to Azure DB (Priority: P1)

A GVI Finance admin needs to update the Power BI dashboards used by GVI leadership and the Finanzamt (German tax authority). They open the export management page and click "Export Now". The system exports the current financial data — budget years, country budgets, budget items with planned and actual amounts, receipts with review statuses, and donor project tagging — to an Azure SQL Database. The export includes all data needed for Power BI to build dashboards without querying the application database directly.

**Why this priority**: This is the core export capability that enables Power BI reporting for leadership and tax compliance. Without it, GVI staff must manually compile data for Power BI.

**Independent Test**: Can be tested by having budget and receipt data in the system, triggering an export, and verifying the Azure DB contains the expected data in the correct structure.

**Acceptance Scenarios**:

1. **Given** budget years, country budgets, budget items, and receipts exist in the system, **When** a GVI Finance admin clicks "Export Now", **Then** the system exports the financial data to the Azure SQL Database.
2. **Given** an export is triggered, **When** the export completes, **Then** the Azure DB contains: budget years, country budgets, budget items (with planned amounts), receipts (with amounts, dates, review statuses), and donor project associations.
3. **Given** an export is triggered, **When** the export completes, **Then** the admin sees a success confirmation with the number of records exported and the timestamp.
4. **Given** an export fails (e.g., Azure DB unreachable), **When** the error occurs, **Then** the admin sees a clear error message and the previous export data in Azure DB remains unchanged.

---

### User Story 2 - Automated Scheduled Export (Priority: P1)

The GVI Finance admin configures a scheduled export so that data is automatically pushed to Azure DB on a regular basis (e.g., nightly). This ensures Power BI dashboards always reflect reasonably current data without requiring manual intervention.

**Why this priority**: Manual exports are error-prone and can be forgotten. Automated exports are essential for reliable Power BI reporting.

**Independent Test**: Can be tested by configuring a schedule, waiting for the scheduled time, and verifying the export ran automatically.

**Acceptance Scenarios**:

1. **Given** a GVI Finance admin opens export settings, **When** they configure a daily export at 02:00, **Then** the schedule is saved and displayed in the settings.
2. **Given** a schedule is configured, **When** the scheduled time arrives, **Then** the export runs automatically without manual intervention.
3. **Given** a scheduled export runs, **When** it completes (success or failure), **Then** the result is logged in the export history with timestamp and outcome.
4. **Given** a schedule is configured, **When** the admin wants to change it, **Then** they can update the schedule frequency and time.

---

### User Story 3 - Export History and Monitoring (Priority: P2)

A GVI Finance admin wants to verify that exports have been running correctly. They open the export history page and see a chronological list of all exports — manual and scheduled — with their status (success/failure), timestamp, record counts, and any error messages. This gives them confidence that Power BI data is current.

**Why this priority**: Without monitoring, failed exports could go unnoticed, leading to stale Power BI dashboards.

**Independent Test**: Can be tested by running several exports (including a simulated failure), then verifying the history shows all exports with correct details.

**Acceptance Scenarios**:

1. **Given** multiple exports have been run, **When** the admin opens the export history, **Then** they see a chronological list with timestamp, trigger type (manual/scheduled), status, and record counts.
2. **Given** an export failed, **When** the admin views its history entry, **Then** they see the error message and can understand what went wrong.
3. **Given** the export history is displayed, **When** the admin filters by status "Failed", **Then** only failed exports are shown.

---

### User Story 4 - Selective Export Configuration (Priority: P3)

A GVI Finance admin wants to export only specific countries' data to Azure DB (e.g., only countries that are relevant for a particular Power BI dashboard). They configure export filters to include or exclude specific countries or budget years.

**Why this priority**: Reduces export time and Azure DB storage for targeted reporting needs, but full export covers most use cases initially.

**Independent Test**: Can be tested by configuring filters, running an export, and verifying only the filtered data appears in Azure DB.

**Acceptance Scenarios**:

1. **Given** the admin opens export configuration, **When** they select specific countries (e.g., Kenya, Mexico), **Then** only those countries' data is included in the next export.
2. **Given** the admin configures a budget year filter, **When** they select "2026", **Then** only 2026 budget data and associated receipts are exported.
3. **Given** filters are configured, **When** the export runs, **Then** the export history shows which filters were applied.

---

### Edge Cases

- What happens when the Azure DB connection is unavailable during a scheduled export? The export fails gracefully, logs the error, and retries at the next scheduled interval. No partial data is written.
- What happens when the export data volume is very large (e.g., 10 years of data)? The export processes data in batches to avoid timeout issues and provides progress feedback.
- What happens when the Azure DB schema needs to change (e.g., new fields added in a future feature)? The export includes a schema version identifier; schema migrations are handled as part of feature development.
- What happens when a manual export is triggered while a scheduled export is already running? The manual export is queued and runs after the current export completes.
- What happens when Azure DB credentials expire or change? The admin can update credentials in the export settings; the system validates the connection before saving.

## Clarifications

### Session 2026-03-19

- Q: Should the Azure DB export include audit trail data? → A: Yes, include audit trail data alongside financial data for compliance dashboards in Power BI.
- Q: Should the export strategy be full-replace or configurable? → A: Configurable — admin selects which data categories to include (budgets, receipts, donor projects, audit trail) and a date range ("since" filter). Full-replace per selected category within the date range.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST support exporting financial data to an Azure SQL Database.
- **FR-002**: Exported data MUST include: budget years, country budgets, budget items (with hierarchy), receipts (with metadata and review statuses), donor project associations, and audit trail entries.
- **FR-003**: System MUST support manual (on-demand) export triggered by a GVI Finance admin.
- **FR-004**: System MUST support scheduled automatic exports with configurable frequency and time.
- **FR-005**: Exports MUST be atomic — either all data is written successfully or no changes are made to Azure DB (no partial exports).
- **FR-006**: System MUST maintain an export history log showing timestamp, trigger type, status, record counts, and error details.
- **FR-007**: System MUST handle Azure DB connection failures gracefully with clear error messages and no data corruption.
- **FR-008**: System MUST support configuring Azure DB connection credentials (stored securely, not in source control).
- **FR-009**: System MUST validate the Azure DB connection when credentials are saved or updated.
- **FR-010**: System MUST support filtering exports by country, budget year, and date range ("export data since" filter).
- **FR-010a**: System MUST allow the admin to select which data categories to include in the export: budgets, receipts, donor projects, and audit trail. Each category can be independently toggled on/off.
- **FR-011**: Export data MUST be structured in a format optimized for Power BI consumption (denormalized where appropriate for dashboard performance).
- **FR-012**: All export actions (manual triggers, schedule changes, credential updates) MUST be recorded in the audit trail.
- **FR-013**: Only GVI Finance admins MUST be able to configure and trigger exports.
- **FR-014**: All user-facing text in the export interface MUST be available in all supported languages (en, de, es, fr, pt).

### Key Entities

- **Export Configuration**: The settings for Azure DB export, including connection credentials, schedule, filters (country, budget year, date range), and data category selection (budgets, receipts, donor projects, audit trail).
- **Export Run**: A single execution of the export process, with status, timestamp, record counts, and error details.
- **Export Schedule**: The configured frequency and time for automatic exports.
- **Azure DB Schema**: The target table structure in Azure SQL Database, designed for Power BI consumption.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A GVI Finance admin can trigger a manual export and have data available in Azure DB within 5 minutes (for up to 10,000 receipts).
- **SC-002**: Scheduled exports run automatically within 5 minutes of the configured time with 99% reliability.
- **SC-003**: Power BI can connect to the Azure DB and build dashboards from the exported data without additional data transformation.
- **SC-004**: 100% of export events (success and failure) are logged in the export history and audit trail.
- **SC-005**: Failed exports leave Azure DB in a consistent state with no partial data.
- **SC-006**: A GVI Finance admin can configure the export schedule and verify it is working in under 10 minutes.

## Assumptions

- An Azure SQL Database instance is provisioned and accessible from the application's deployment environment. Provisioning is outside the scope of this feature.
- Azure DB credentials are managed via environment variables or secure configuration, consistent with the project's configuration approach.
- The Power BI dashboards themselves are created and maintained outside this application; this feature only provides the data.
- The export replaces (overwrites) the previous export data in Azure DB for the selected categories and date range. Within each category, the export is a full replace of that slice (not incremental append).
- Export frequency is at most daily; near-real-time replication is not required.
- The Azure DB schema is designed and maintained as part of this feature's implementation.

## Scope Boundaries

**In scope**:
- Manual and scheduled export to Azure SQL Database
- Export configuration (credentials, schedule, filters)
- Export history and monitoring
- Atomic export with error handling
- Audit trail for export actions

**Out of scope (later features)**:
- Power BI dashboard creation and maintenance
- Azure DB provisioning and infrastructure setup
- Real-time data replication
- Export to other database types (PostgreSQL, etc.)
- AI-powered data analysis in Power BI — Feature 5

## Dependencies

- **Feature 1 (Budget Planning & Core Data Model)**: Requires budget data, receipts, and donor project tagging as the source data for export.
- **Feature 2 (Receipt Review & Audit Dashboard)**: Requires review statuses to be included in exported data.
- **Azure SQL Database**: External dependency — must be provisioned and network-accessible.
