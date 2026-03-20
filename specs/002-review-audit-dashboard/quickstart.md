# Quickstart: Receipt Review & Audit Dashboard

**Date**: 2026-03-20
**Prerequisite**: Feature 1 (Budget Planning & Core Data Model) must be implemented.

## Key Workflows

### 1. Review a Receipt
1. Log in as GVI Finance Admin
2. Navigate to Review Dashboard
3. Filter by country "Kenya", status "Pending Review"
4. Click on a receipt → see file inline + metadata
5. Click "Approve" or "Flag" (with comment) or "Reject" (with reason)

### 2. Respond to Flagged Receipt
1. Log in as Country Finance user
2. See flagged receipts marked with indicator
3. Open flagged receipt → read reviewer comment
4. Add clarification comment OR upload corrected file
5. Receipt returns to "Pending Review"

### 3. View Audit Trail
1. As GVI Finance Admin, navigate to Audit Trail
2. Filter by date range, action type, country
3. Click entry for full details (before/after values)
4. Export as CSV or PDF for external auditors

### 4. Compliance Dashboard
1. Navigate to Compliance Dashboard
2. See all countries: budget, approved spend, total spend, status counts
3. Click country → drill down to budget hierarchy
4. Over-budget items highlighted
5. Click budget item → see individual receipts with statuses

## Running Tests

```bash
npm test                    # Unit tests (review state machine, audit export)
npm run test:e2e            # E2E (review workflow, flagging, compliance)
```
