# Feature Specification: Receipt Review & Audit Dashboard

**Feature Branch**: `002-review-audit-dashboard`
**Created**: 2026-03-19
**Status**: Draft
**Input**: User description: "Receipt Review and Audit Dashboard"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - GVI Finance Admin Reviews Receipts (Priority: P1)

A GVI Finance admin opens the receipt review dashboard. They see a filterable list of all receipts across countries, showing key metadata (country, budget item, amount, date, submitter, review status). They filter by country "Kenya" and status "Pending Review". They open a receipt, view the uploaded file alongside the metadata, and decide whether the receipt is valid. They approve it, and the receipt status changes to "Approved". For another receipt where the amount seems incorrect, they flag it with a comment explaining what needs correction.

**Why this priority**: This is the core spot-checking workflow — the primary mechanism for GVI Finance to control program country spending. Directly addresses goal #2.

**Independent Test**: Can be tested by having receipts in the system (from Feature 1), then filtering, viewing, and changing review status. Delivers value as the central review tool.

**Acceptance Scenarios**:

1. **Given** receipts exist across multiple countries, **When** a GVI Finance admin opens the review dashboard, **Then** they see a list of all receipts with columns for country, budget item, amount, date, submitter, and review status.
2. **Given** the review dashboard is displayed, **When** the admin filters by country "Kenya" and status "Pending Review", **Then** only Kenya's unreviewed receipts are shown.
3. **Given** a filtered receipt list, **When** the admin clicks on a receipt, **Then** they see the full receipt detail: uploaded file (viewable inline for images/PDFs), amount, currency, date, description, budget item path, and submitter name.
4. **Given** a receipt detail is open, **When** the admin clicks "Approve", **Then** the receipt status changes to "Approved" and the action is recorded in the audit trail.
5. **Given** a receipt detail is open, **When** the admin clicks "Flag" and enters a comment "Amount does not match the invoice total", **Then** the receipt status changes to "Flagged" with the comment visible, and the action is recorded in the audit trail.
6. **Given** a receipt detail is open, **When** the admin clicks "Reject" and enters a reason, **Then** the receipt status changes to "Rejected" with the reason visible, and the action is recorded.

---

### User Story 2 - Country Finance User Responds to Flagged Receipts (Priority: P1)

A Country Finance user for Kenya logs in and sees a notification or indicator that some of their submitted receipts have been flagged for correction. They open a flagged receipt, read the reviewer's comment, and respond — either by adding a clarification comment or by uploading a corrected receipt that replaces the flagged submission. Once they respond, the receipt moves back to "Pending Review" for re-review.

**Why this priority**: Without this feedback loop, flagging is a dead end. The review workflow is incomplete unless submitters can respond to flags.

**Independent Test**: Can be tested by flagging a receipt (from US1), then logging in as the Country Finance user and responding. Delivers value as the two-way communication channel for spot-checking.

**Acceptance Scenarios**:

1. **Given** a Country Finance user has flagged receipts, **When** they log in and view their receipt list, **Then** flagged receipts are clearly marked with a visual indicator and the reviewer's comment is visible.
2. **Given** a flagged receipt is open, **When** the user adds a clarification comment, **Then** the comment is saved and the receipt status changes to "Pending Review" for re-review.
3. **Given** a flagged receipt is open, **When** the user uploads a corrected receipt file, **Then** the new file is stored (the original flagged file is retained for audit purposes) and the receipt status changes to "Pending Review".
4. **Given** a receipt has been resubmitted after flagging, **When** a GVI Finance admin opens it for review, **Then** they see both the original and corrected files, all comments in chronological order, and the full review history.

---

### User Story 3 - Audit Trail Viewing (Priority: P2)

A GVI Finance admin needs to review the history of actions for an upcoming external audit. They open the audit trail view and filter by date range, action type (e.g., "receipt reviewed", "budget changed"), country, or specific user. They see a chronological log of all recorded actions with who performed them, when, and what changed.

**Why this priority**: Audit trails are required for institutional donors and the tax authority (Finanzamt). Critical for compliance but not needed for day-to-day operations.

**Independent Test**: Can be tested by performing various actions (upload, review, budget edits) and verifying they appear in the audit trail with correct details.

**Acceptance Scenarios**:

1. **Given** various actions have been performed in the system, **When** a GVI Finance admin opens the audit trail, **Then** they see a chronological list of all actions with actor, timestamp, action type, and affected entity.
2. **Given** the audit trail is displayed, **When** the admin filters by date range "2026-01-01 to 2026-03-31" and country "Kenya", **Then** only matching entries are shown.
3. **Given** the audit trail is displayed, **When** the admin filters by action type "Receipt Reviewed", **Then** only review actions (approve, flag, reject) are shown.
4. **Given** an audit trail entry for a receipt review, **When** the admin clicks on it, **Then** they see the full details: which receipt, what the previous status was, what it changed to, any comments, and the reviewer's identity.

---

### User Story 4 - Budget Compliance Dashboard with Review Status (Priority: P2)

A GVI Finance admin opens the compliance dashboard to get a high-level view across all countries. They see each country with total budget, total spend (from receipts), percentage used, and a breakdown of review statuses (how many receipts are pending, approved, flagged, rejected). They can drill down into a country to see the budget hierarchy with planned vs. actual and review status aggregated at each level.

**Why this priority**: Extends the budget overview from Feature 1 with review status data. Essential for efficient spot-checking at scale, but requires the review workflow (US1) to be in place first.

**Independent Test**: Can be tested by having budgets with receipts in various review statuses, then verifying the dashboard aggregates correctly.

**Acceptance Scenarios**:

1. **Given** multiple countries have budgets and receipts, **When** a GVI Finance admin opens the compliance dashboard, **Then** they see a summary per country: total budget, total spend, percentage used, and receipt status counts (pending/approved/flagged/rejected).
2. **Given** the compliance dashboard is displayed, **When** the admin clicks on country "Kenya", **Then** they see Kenya's budget hierarchy with planned vs. actual at each level and review status counts per budget item.
3. **Given** a budget item has receipts totalling more than the planned amount, **When** the dashboard is displayed, **Then** that item is visually highlighted as over-budget.
4. **Given** a budget item in the drill-down view, **When** the admin clicks on it, **Then** they see the list of receipts assigned to that item with their review statuses.

---

### User Story 5 - Country Admin Views Review Status for Their Country (Priority: P3)

A Country Admin for Kenya logs in and sees a summary of their country's receipt submission and review status. They see how many receipts are pending review, approved, flagged, or rejected. They can view flagged receipts to understand what needs attention from their Country Finance staff.

**Why this priority**: Gives country leadership visibility into their own review status without requiring GVI Finance involvement. Useful but not critical for the core review workflow.

**Independent Test**: Can be tested by logging in as a Country Admin and verifying they see only their country's review status summary and can access flagged receipts.

**Acceptance Scenarios**:

1. **Given** a Country Admin for Kenya is logged in, **When** they view the dashboard, **Then** they see Kenya's receipt status summary: counts and amounts for pending, approved, flagged, and rejected receipts.
2. **Given** the Country Admin views flagged receipts, **When** they open one, **Then** they see the reviewer's comment and can see whether the Country Finance user has responded.
3. **Given** the Country Admin is logged in, **When** they attempt to approve or reject a receipt, **Then** the system denies the action (only GVI Finance admins can review).

---

### Edge Cases

- What happens when a GVI Finance admin tries to review their own uploaded receipt (if they also have an upload role)? The system allows it but records it in the audit trail for transparency.
- What happens when a receipt is flagged but the Country Finance user's account is deactivated? The flagged receipt remains flagged; the Country Admin or GVI Finance admin can reassign or resolve it.
- What happens when multiple GVI Finance admins try to review the same receipt simultaneously? The first review action wins; the second reviewer sees the updated status and can still add their own review if needed.
- What happens when a receipt is approved and then the reviewer realizes it should have been flagged? The reviewer can change the status from "Approved" to "Flagged" with a comment; the original approval is retained in the audit trail.
- What happens when filtering produces zero results? The system displays a clear "No receipts match your filters" message.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST support receipt review statuses: Pending Review, Approved, Flagged, Rejected.
- **FR-002**: Newly uploaded receipts MUST automatically receive the status "Pending Review".
- **FR-003**: GVI Finance admins MUST be able to change a receipt's review status to Approved, Flagged, or Rejected.
- **FR-004**: When flagging or rejecting a receipt, the reviewer MUST provide a comment explaining the reason.
- **FR-005**: Country Finance users MUST be able to see the review status and reviewer comments on their submitted receipts.
- **FR-006**: Country Finance users MUST be able to respond to flagged receipts by adding a comment or uploading a corrected file.
- **FR-007**: When a Country Finance user responds to a flagged receipt, the status MUST revert to "Pending Review" for re-review.
- **FR-008**: Original receipt files MUST be retained even when a corrected file is uploaded (for audit purposes).
- **FR-009**: The review dashboard MUST support filtering by: country, budget item, date range, review status, and submitter.
- **FR-010**: The receipt detail view MUST display the uploaded file inline (images and PDFs) alongside all metadata and review history.
- **FR-011**: System MUST record all review actions in the audit trail: actor, timestamp, action type, previous status, new status, and any comments.
- **FR-012**: System MUST record all significant actions in the audit trail: receipt uploads, review decisions, budget changes, role changes, and donor project tagging.
- **FR-013**: The audit trail MUST be viewable and filterable by GVI Finance admins by date range, action type, country, and user.
- **FR-014**: The compliance dashboard MUST show per-country summary: total budget, total spend, percentage used, and receipt status counts.
- **FR-015**: The compliance dashboard MUST support drill-down from country to budget hierarchy to individual receipts.
- **FR-016**: Budget items where actual spend exceeds the planned amount MUST be visually highlighted.
- **FR-017**: Country Admins MUST be able to view their country's review status summary but MUST NOT be able to perform review actions.
- **FR-018**: Review status changes MUST be reversible (e.g., approved can be changed to flagged) with full audit trail.
- **FR-019**: All user-facing text in the review and audit interfaces MUST be available in all supported languages (en, de, es, fr, pt).

### Key Entities

- **Review Status**: A state on a receipt (Pending Review, Approved, Flagged, Rejected) indicating its review progress.
- **Review Action**: A recorded decision by a GVI Finance admin on a receipt, including the new status, comment, and timestamp.
- **Review Comment**: A comment attached to a receipt by either a reviewer (when flagging/rejecting) or a submitter (when responding to a flag).
- **Receipt Revision**: When a corrected file is uploaded in response to a flag, the new file linked to the same receipt while retaining the original.
- **Audit Entry**: A logged action recording who did what, when, on which entity, with before/after state where applicable.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: GVI Finance admins can review a receipt (view file, read metadata, approve/flag/reject) in under 1 minute per receipt.
- **SC-002**: Filtering receipts by any combination of country, budget item, date range, and status returns results in under 3 seconds.
- **SC-003**: Country Finance users can see the review status of all their receipts and respond to a flagged receipt in under 3 minutes.
- **SC-004**: The compliance dashboard loads a summary across all countries (up to 30) in under 5 seconds.
- **SC-005**: 100% of review actions, receipt uploads, and significant data changes are captured in the audit trail with no gaps.
- **SC-006**: Audit trail entries are queryable by date range spanning up to 10 years of data.
- **SC-007**: A GVI Finance admin can identify all over-budget items for a country within 2 clicks from the compliance dashboard.

## Assumptions

- Feature 1 (Budget Planning & Core Data Model) is implemented: budget years, countries, budget item hierarchies, receipts, and roles exist.
- The review workflow is sequential (not parallel approval chains) — a single GVI Finance admin reviews a receipt, not a committee.
- There is no automatic escalation if a receipt remains in "Pending Review" for too long. Notification features may be added in a later feature.
- The audit trail covers actions within this application only, not external systems.
- Receipt file inline viewing supports PDF and common image formats (JPEG, PNG). Other file types show a download link.

## Scope Boundaries

**In scope**:
- Receipt review workflow (approve, flag, reject) with comments
- Country Finance response to flagged receipts (comment or corrected file upload)
- Review dashboard with filtering
- Audit trail recording and viewing with filtering
- Compliance dashboard with per-country summary and budget hierarchy drill-down
- Review status visibility for Country Admins

**Out of scope (later features)**:
- Donor project report generation — Feature 4
- Azure DB export of review data — Feature 5
- AI-assisted review suggestions — Feature 6
- Email notifications for flagged receipts
- Automatic escalation of unreviewed receipts
- Batch review (approve/reject multiple receipts at once)

## Dependencies

- **Feature 1 (Budget Planning & Core Data Model)**: This feature requires the budget hierarchy, receipt upload, roles, and donor project tagging to be in place. The audit trail framework (FR-017 from Feature 1) is extended here.
