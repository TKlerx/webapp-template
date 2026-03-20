# Feature Specification: Donor Project Reporting

**Feature Branch**: `003-donor-project-reporting`
**Created**: 2026-03-19
**Status**: Draft
**Input**: User description: "Donor Project Reporting — one-click report generation for institutional donors"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - GVI Finance Admin Generates a Donor Project Report (Priority: P1)

A GVI Finance admin needs to prepare a report for the European Union showing how their grant funds were spent in Kenya. They open the donor project "EU Grant 2026 - Kenya Education", review the summary of tagged budget items and receipts, then click "Generate Report". The system produces a formatted report showing: the donor project name, reporting period, a summary of total funds allocated vs. spent, a breakdown by budget item with planned vs. actual amounts, and a list of individual receipts with their review status. The report can be exported as PDF or Excel.

**Why this priority**: This is the core value proposition — replacing manual report compilation with one-click generation. Directly addresses goal #1 (showing donors how money was spent).

**Independent Test**: Can be tested by having a donor project with tagged budget items and receipts (from Features 1 & 2), then generating a report and verifying it contains the correct data.

**Acceptance Scenarios**:

1. **Given** a donor project "EU Grant 2026 - Kenya Education" has tagged budget items with receipts, **When** a GVI Finance admin clicks "Generate Report", **Then** the system produces a report showing the donor project name, reporting period, and a financial summary.
2. **Given** a report is being generated, **When** the donor project has tagged budget items, **Then** the report includes a breakdown by budget item showing planned amount, actual spend (sum of receipts), and variance.
3. **Given** a report is being generated, **When** tagged budget items have receipts in various review statuses, **Then** the report shows receipt counts and amounts by status (approved, pending, flagged, rejected) and clearly indicates which amounts are from approved receipts vs. total.
4. **Given** a generated report, **When** the admin clicks "Export as PDF", **Then** a formatted PDF is downloaded with the report content, GVI branding, and the generation date.
5. **Given** a generated report, **When** the admin clicks "Export as Excel", **Then** an Excel file is downloaded with the financial data in structured sheets suitable for further analysis.

---

### User Story 2 - GVI Finance Admin Configures Report Parameters (Priority: P1)

Before generating a report, the GVI Finance admin can configure the reporting period (date range) to control which receipts are included. They can also choose whether to include only approved receipts or all receipts regardless of review status. This allows them to generate interim reports (e.g., quarterly) or final reports for a completed grant period.

**Why this priority**: Donors require reports for specific periods, and the ability to filter by review status is essential for producing accurate financial reports.

**Independent Test**: Can be tested by generating reports with different date ranges and status filters, then verifying the included receipts match the criteria.

**Acceptance Scenarios**:

1. **Given** a donor project with receipts spanning January to December 2026, **When** the admin sets the reporting period to Q1 (January–March 2026), **Then** only receipts dated within Q1 are included in the report.
2. **Given** a donor project with receipts in various statuses, **When** the admin selects "Approved only", **Then** the report includes only approved receipts in the financial totals and receipt list.
3. **Given** a donor project with receipts in various statuses, **When** the admin selects "All statuses", **Then** the report includes all receipts but clearly separates approved amounts from pending/flagged/rejected amounts.
4. **Given** report parameters are configured, **When** the report is generated, **Then** the report header clearly states the reporting period and which receipt statuses were included.

---

### User Story 3 - GVI Finance Admin Reviews Report Before Export (Priority: P2)

After configuring parameters and before exporting, the admin sees an on-screen preview of the report. They can review the data, check for any issues (e.g., too many flagged receipts, missing data), and decide whether to export or adjust parameters. The preview shows the same content that will appear in the exported file.

**Why this priority**: Prevents wasted time from exporting incorrect reports. Allows the admin to catch issues before sharing with donors.

**Independent Test**: Can be tested by generating a report preview, verifying it matches the eventual exported content, and checking that parameter changes update the preview.

**Acceptance Scenarios**:

1. **Given** report parameters are configured, **When** the admin clicks "Preview", **Then** the report content is displayed on screen with the same structure as the export (summary, budget breakdown, receipt list).
2. **Given** a report preview is displayed, **When** the admin changes a parameter (e.g., date range), **Then** the preview updates to reflect the new parameters.
3. **Given** a report preview is displayed, **When** the admin is satisfied with the content, **Then** they can export directly from the preview screen.

---

### User Story 4 - Report History and Re-generation (Priority: P3)

A GVI Finance admin needs to reference a report they generated last month. They open the report history for a donor project and see a list of previously generated reports with their parameters and generation dates. They can download a previously generated report or re-generate it with the current data to see what has changed.

**Why this priority**: Useful for audit trails and donor communication history, but not critical for the initial report generation workflow.

**Independent Test**: Can be tested by generating multiple reports over time, then verifying the history list shows all previous reports and allows download or re-generation.

**Acceptance Scenarios**:

1. **Given** multiple reports have been generated for a donor project, **When** the admin opens the report history, **Then** they see a list of reports with generation date, reporting period, and parameters used.
2. **Given** a report history entry, **When** the admin clicks "Download", **Then** the previously generated report file is downloaded (the original export, not a re-generation).
3. **Given** a report history entry, **When** the admin clicks "Re-generate", **Then** a new report is produced using the same parameters but current data, and the new report is added to the history.

---

### Edge Cases

- What happens when a donor project has no tagged budget items or receipts? The system displays a message "No data available for this donor project" and disables the report generation button.
- What happens when all receipts in the reporting period are flagged or rejected? The report is generated but the approved totals show zero, with a clear note explaining no approved receipts exist for the period.
- What happens when a budget item was tagged to the donor project after some receipts were already uploaded? Receipts uploaded before tagging are still included (since tagging a budget item includes all its receipts, past and future).
- What happens when the reporting period spans two budget years? The report includes receipts from both years and groups the budget breakdown by year.
- What happens when a previously generated report's underlying data has changed (receipts approved/rejected after report generation)? The stored report reflects the data at generation time; re-generation produces a new report with current data.

## Clarifications

### Session 2026-03-19

- Q: How should reports handle multi-currency when a donor project spans countries with different currencies? → A: Display in original currencies with subtotals grouped per currency. No conversion. Daily exchange rate conversion is a future feature.
- Q: Should reports be generated in the user's locale or a selectable language? → A: Admin selects the report language from supported locales (en, de, es, fr, pt) at generation time, independent of their UI locale.
- Q: Should PDF exports include receipt images? → A: Metadata only by default; optional toggle to include receipt images as an appendix.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow generating financial reports for any donor project.
- **FR-002**: Reports MUST include: donor project name, donor name, reporting period, generation date, and preparer identity.
- **FR-003**: Reports MUST include a financial summary showing total allocated budget (from tagged budget items) and total actual spend (from receipts). When multiple currencies are present, amounts MUST be grouped with subtotals per currency (no conversion).
- **FR-004**: Reports MUST include a budget item breakdown showing each tagged item with planned amount, actual spend, and variance.
- **FR-005**: Reports MUST include a receipt list showing individual receipts with date, amount, description, budget item, and review status.
- **FR-006**: Reports MUST support filtering by reporting period (date range).
- **FR-007**: Reports MUST support filtering by receipt review status (approved only vs. all statuses).
- **FR-008**: When "all statuses" is selected, the report MUST clearly distinguish approved amounts from non-approved amounts.
- **FR-009**: System MUST support exporting reports as PDF with appropriate formatting and GVI branding. PDF export MUST default to metadata only, with an optional toggle to include receipt images as an appendix.
- **FR-010**: System MUST support exporting reports as Excel with structured data sheets.
- **FR-011**: System MUST provide an on-screen preview of the report before export.
- **FR-012**: System MUST store generated reports and maintain a report history per donor project.
- **FR-013**: System MUST allow downloading previously generated reports from the history.
- **FR-014**: System MUST allow re-generating a report with the same parameters but current data.
- **FR-015**: Report generation MUST be recorded in the audit trail with actor, timestamp, donor project, and parameters used.
- **FR-016**: Only GVI Finance admins MUST be able to generate and access donor project reports.
- **FR-017**: All user-facing text in the reporting interface MUST be available in all supported languages (en, de, es, fr, pt).

### Key Entities

- **Donor Report**: A generated report for a donor project, containing the financial summary, budget breakdown, and receipt list for a specific reporting period and status filter.
- **Report Parameters**: The configuration for a report: donor project, reporting period (date range), receipt status filter, export format, and report language (selectable from supported locales).
- **Report History Entry**: A record of a previously generated report, including the parameters used, generation date, preparer, and the stored report file.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A GVI Finance admin can generate a complete donor project report (configure parameters, preview, export) in under 5 minutes.
- **SC-002**: Generated reports accurately reflect 100% of tagged budget items and receipts matching the specified parameters.
- **SC-003**: PDF and Excel exports are downloadable and openable without errors across standard viewers.
- **SC-004**: Report generation for a donor project with up to 500 receipts completes in under 30 seconds.
- **SC-005**: Previously generated reports are retrievable from the history for the full data retention period (10 years).
- **SC-006**: All report generation actions are captured in the audit trail with no gaps.

## Assumptions

- GVI branding for PDF reports (logo, colors, fonts) will be provided or can use a simple default template initially.
- Excel exports use a standard format (.xlsx) readable by common spreadsheet applications.
- Report storage uses the same retention policy as receipts (10 years).
- Currency in reports is displayed as stored (original currency per receipt). Multi-currency aggregation and conversion are deferred unless addressed in a prior feature.
- The report content and structure may evolve based on donor requirements; the initial implementation covers the core financial summary, budget breakdown, and receipt list.

## Scope Boundaries

**In scope**:
- Report generation for donor projects with configurable parameters
- PDF and Excel export
- On-screen report preview
- Report history with download and re-generation
- Audit trail recording of report generation

**Out of scope (later features)**:
- Automated scheduled report generation (e.g., monthly)
- Email delivery of reports to donors
- Custom report templates per donor
- Multi-currency conversion in reports (future: daily exchange rate-based conversion)
- Azure DB export of report data — Feature 4

## Dependencies

- **Feature 1 (Budget Planning & Core Data Model)**: Requires donor projects, budget item tagging, and receipt data to be in place.
- **Feature 2 (Receipt Review & Audit Dashboard)**: Requires review statuses on receipts to filter by approved/pending/flagged/rejected.
