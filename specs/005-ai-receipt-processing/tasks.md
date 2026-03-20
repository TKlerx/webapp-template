# Tasks: AI Receipt Processing

**Input**: Design documents from `specs/005-ai-receipt-processing/`
**Prerequisites**: plan.md, spec.md, data-model.md, contracts/api.md, research.md

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)

---

## Phase 1: Setup

**Purpose**: Install dependencies and configure Azure OpenAI environment

- [ ] T001 Install `openai` npm package and add to package.json
- [ ] T002 [P] Add Azure OpenAI environment variables to `.env.example` (`AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_DEPLOYMENT`, `AZURE_OPENAI_API_VERSION`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database schema changes, AI service client, and async queue — MUST complete before user stories

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T003 Add `aiStatus` (String, default "none") and `aiProcessedAt` (DateTime?) fields to Receipt model, add AiExtractionResult, AiClassificationResult, and AiReviewNote models to `prisma/schema.prisma` per data-model.md, add AI_EXTRACTION_COMPLETE, AI_EXTRACTION_FAILED, AI_CLASSIFICATION_ACCEPTED to AuditAction enum, then run `npm run prisma:migrate`
- [ ] T004 [P] Create Azure OpenAI client wrapper in `src/lib/ai-service.ts` — lazy initialization from env vars, `isAiAvailable()` check, graceful return of null when env vars are missing
- [ ] T005 [P] Create prompt templates in `src/lib/ai-prompts.ts` — extraction prompt (expects JSON with amount, currency, date, description, confidence per field) and classification prompt (expects JSON with top 3 suggestions: budgetItemId, confidence, reasoning)
- [ ] T006 Create async processing queue in `src/lib/ai-queue.ts` — in-memory FIFO with configurable concurrency limit (default 3), retry logic (3 retries, exponential backoff), status callback to update Receipt.aiStatus in database (none → pending → processing → complete|failed), re-queue pending items on server startup by querying receipts with aiStatus "pending" or "processing" on app initialization
- [ ] T007 [P] Add i18n translation keys for AI features across all 5 locales (en, de, es, fr, pt) in `src/i18n/messages/` — keys for processing status, confidence levels, extraction labels, review note types, error messages

**Checkpoint**: Foundation ready — AI client, queue, prompts, and schema in place

---

## Phase 3: User Story 1 — Automatic Data Extraction (Priority: P1) 🎯 MVP

**Goal**: Country Finance users upload a receipt and AI automatically extracts amount, currency, date, and description with confidence scores

**Independent Test**: Upload receipt images/PDFs with known data and verify extracted values match

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T008 [P] [US1] Unit test for extraction service in `tests/unit/ai-extraction.test.ts` — mock Azure OpenAI response, verify JSON parsing of amount/currency/date/description, verify confidence score mapping, verify AiExtractionResult is saved to database, verify error handling for malformed AI response
- [ ] T009 [P] [US1] Unit test for ai-queue in `tests/unit/ai-queue.test.ts` — verify enqueue/dequeue, concurrency limit, retry with exponential backoff, aiStatus transitions (pending → processing → complete/failed)
- [ ] T010 [P] [US1] Integration test for extraction API in `tests/unit/ai-extract-api.test.ts` — mock AI service, test POST triggers extraction and returns 202, test GET returns extraction result or null, test auth checks (country-scoped access)

### Implementation

- [ ] T011 [US1] Create extraction service in `src/lib/ai-extraction.ts` — accepts receipt file path + mime type, converts image to base64, handles PDF extraction (detect embedded text vs scanned image, extract text content or convert first page to image), calls Azure OpenAI vision API with extraction prompt, parses structured JSON response, saves AiExtractionResult to database with confidence scores and processing time
- [ ] T012 [US1] Create POST and GET `/api/receipts/[id]/ai-extract` routes in `src/app/api/receipts/[id]/ai-extract/route.ts` — POST: auth check (COUNTRY_FINANCE, COUNTRY_ADMIN, GVI_FINANCE_ADMIN), validates receipt exists and belongs to user's country, enqueues extraction job via ai-queue, returns 202; GET: auth check, returns AiExtractionResult or null
- [ ] T013 [US1] Integrate AI extraction into receipt upload flow — after receipt is saved in existing POST `/api/receipts` route, auto-trigger extraction by enqueuing via ai-queue if `isAiAvailable()` returns true, set aiStatus to "pending"
- [ ] T014 [P] [US1] Create `src/components/ai/AiExtractionOverlay.tsx` — displays AI-extracted values alongside receipt form fields, shows confidence badge per field (high/medium/low), allows user to accept or override each value, visually distinguishes AI suggestions from confirmed values
- [ ] T015 [P] [US1] Create `src/components/ai/AiProcessingStatus.tsx` — inline processing indicator ("Analyzing receipt..."), polls receipt endpoint every 2-3 seconds while aiStatus is "pending" or "processing", shows completion or failure message
- [ ] T016 [P] [US1] Create `src/components/ai/ConfidenceBadge.tsx` — reusable badge component for high (green), medium (yellow), low (red) confidence display with i18n labels
- [ ] T017 [US1] Integrate AiExtractionOverlay and AiProcessingStatus into receipt detail/edit page at `src/app/(dashboard)/receipts/[id]/page.tsx` — show extraction overlay when AI results available, show processing status while pending, graceful fallback to manual-only when AI unavailable
- [ ] T018 [US1] Add audit logging for AI extraction events — log AI_EXTRACTION_COMPLETE and AI_EXTRACTION_FAILED to AuditEntry via `src/lib/audit.ts`

**Checkpoint**: Receipt upload triggers AI extraction, results pre-fill form fields with confidence indicators

---

## Phase 4: User Story 2 — Budget Item Classification (Priority: P1)

**Goal**: AI suggests which budget item a receipt belongs to based on extracted data and budget hierarchy

**Independent Test**: Upload receipts with descriptions that clearly map to budget items and verify correct suggestions

### Tests for User Story 2

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T019 [P] [US2] Unit test for classification service in `tests/unit/ai-classification.test.ts` — mock Azure OpenAI response, verify hierarchy flattening, verify top 3 suggestions parsed with confidence/reasoning, verify AiClassificationResult saved to database
- [ ] T020 [P] [US2] Unit test for accept endpoint in `tests/unit/ai-classify-accept.test.ts` — verify budgetItemId validation against country hierarchy, verify receipt budgetItemId updated, verify AI_CLASSIFICATION_ACCEPTED audit entry logged

### Implementation

- [ ] T021 [US2] Create classification service in `src/lib/ai-classification.ts` — accepts receipt data (description, amount, currency) and country budget hierarchy, flattens hierarchy to `[{ id, name, fullPath, depth }]`, includes recent similar receipts as few-shot examples, calls Azure OpenAI with classification prompt, saves AiClassificationResult with top 3 suggestions
- [ ] T022 [US2] Create GET `/api/receipts/[id]/ai-classify` route in `src/app/api/receipts/[id]/ai-classify/route.ts` — auth check, returns suggestions array `[{ budgetItemId, budgetItemName, fullPath, confidence, reasoning }]` or empty array
- [ ] T023 [US2] Create POST `/api/receipts/[id]/ai-classify/accept` route in `src/app/api/receipts/[id]/ai-classify/accept/route.ts` — auth check, validates budgetItemId exists in country's hierarchy, updates receipt's budgetItemId, records accepted suggestion in AiClassificationResult, logs AI_CLASSIFICATION_ACCEPTED audit entry
- [ ] T024 [US2] Chain classification after extraction in `src/lib/ai-queue.ts` — after successful extraction, automatically enqueue classification job for the same receipt
- [ ] T025 [P] [US2] Create `src/components/ai/AiClassificationSuggestions.tsx` — displays top 3 budget item suggestions with confidence scores and reasoning, "Accept" button per suggestion, fallback to manual budget item picker if no suggestions or user disagrees
- [ ] T026 [US2] Integrate AiClassificationSuggestions into receipt form at `src/app/(dashboard)/receipts/[id]/page.tsx` — show suggestions after extraction completes, update budget item field on accept

**Checkpoint**: After extraction, AI suggests budget items; user can accept with one click

---

## Phase 5: User Story 3 — AI-Assisted Receipt Review (Priority: P2)

**Goal**: GVI Finance admins see AI-generated review notes highlighting anomalies, duplicates, and mismatches during spot-checking

**Independent Test**: Create receipts with known anomalies (duplicates, out-of-range amounts) and verify AI flags them

### Tests for User Story 3

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T027 [P] [US3] Unit test for review analysis in `tests/unit/ai-review.test.ts` — verify duplicate detection via DB query (same amount + date + country), verify anomaly detection via AI call (amount vs typical range), verify mismatch detection via AI call (description vs budget category), verify AiReviewNote records created with correct noteType/severity/linkedReceiptId

### Implementation

- [ ] T028 [US3] Create review analysis service in `src/lib/ai-review.ts` — duplicate detection: DB query for receipts with same amount + date within same country (no AI call needed); anomaly and mismatch detection: AI call with receipt data + budget item context to assess amount range and category fit; generates AiReviewNote records with noteType ("anomaly", "duplicate", "mismatch"), severity ("info", "warning"), and linked receipt for duplicates
- [ ] T029 [US3] Create GET `/api/receipts/[id]/ai-review` route in `src/app/api/receipts/[id]/ai-review/route.ts` — auth check (GVI_FINANCE_ADMIN only), returns AiReviewNote array or empty array
- [ ] T030 [US3] Trigger review analysis — run review analysis when receipt reaches "complete" aiStatus (after extraction + classification), or on-demand via the review dashboard
- [ ] T031 [P] [US3] Create `src/components/ai/AiReviewNotes.tsx` — displays review notes grouped by severity, duplicate notes include link to the potentially duplicate receipt, anomaly notes show context (e.g., "3x average for this budget item"), mismatch notes suggest correct category, no notes displayed for clean receipts
- [ ] T032 [US3] Integrate AiReviewNotes into receipt review page — show AI notes panel alongside receipt details in the review dashboard, notes are advisory only (do not block approval/rejection)

**Checkpoint**: Reviewers see AI-generated advisory notes during spot-checking

---

## Phase 6: User Story 4 — AI Processing Status & Transparency (Priority: P2)

**Goal**: Users see processing status and can compare AI-extracted vs user-confirmed values

**Independent Test**: Upload receipts and verify status updates correctly; check AI vs confirmed values are visible

### Tests for User Story 4

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T033 [P] [US4] Unit test for status and transparency in `tests/unit/ai-status.test.ts` — verify GET /api/receipts/[id] includes aiStatus and aiProcessedAt fields, verify aiStatus filter on receipt list endpoint

### Implementation

- [ ] T034 [US4] Extend GET `/api/receipts/[id]` response in `src/app/api/receipts/[id]/route.ts` to include `aiStatus` and `aiProcessedAt` fields
- [ ] T035 [US4] Add AI extraction comparison view to receipt detail page at `src/app/(dashboard)/receipts/[id]/page.tsx` — after receipt is saved, show side-by-side: "AI extracted" vs "Confirmed" values for amount, currency, date, description, highlight differences
- [ ] T036 [US4] Add aiStatus filter to receipt list page at `src/app/(dashboard)/receipts/page.tsx` — allow filtering by AI processing status (pending, processing, complete, failed, none)

**Checkpoint**: Full transparency — users see AI status, extracted vs confirmed values

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Error handling, graceful degradation, and overall quality

- [ ] T037 [P] Implement graceful degradation in receipt upload UI — when `isAiAvailable()` is false, hide all AI-related UI components, receipt upload works as fully manual entry (no errors, no broken indicators)
- [ ] T038 [P] Add rate limit handling in `src/lib/ai-service.ts` — detect 429 responses from Azure OpenAI, implement backoff, queue requests when rate limited, surface user-friendly message via ai-queue status
- [ ] T039 [P] Verify i18n completeness for all AI components — check all 5 locales have translations for AI status messages, confidence labels, review note content, error messages (verification pass, not creation)
- [ ] T040 Run quickstart.md validation — verify AI receipt processing workflow end-to-end per quickstart scenarios

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — install packages and configure env
- **Phase 2 (Foundational)**: Depends on Phase 1 — schema, AI client, queue, prompts
- **Phase 3 (US1 - Extraction)**: Depends on Phase 2 — uses ai-service, ai-queue, ai-prompts, schema
- **Phase 4 (US2 - Classification)**: Depends on Phase 3 — chains after extraction, uses extraction results
- **Phase 5 (US3 - Review Notes)**: Depends on Phase 2 — can start after foundational but benefits from US1+US2 being complete
- **Phase 6 (US4 - Status/Transparency)**: Depends on Phase 3 — needs aiStatus fields and extraction flow
- **Phase 7 (Polish)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (Extraction)**: Foundation only — independent
- **US2 (Classification)**: Depends on US1 — classification chains after extraction
- **US3 (Review Notes)**: Foundation only — can work independently but integrates best after US1+US2
- **US4 (Status/Transparency)**: Depends on US1 — needs aiStatus and extraction results

### Parallel Opportunities

```bash
# Phase 2 parallel tasks:
T004 (ai-service.ts) | T005 (ai-prompts.ts) | T007 (i18n keys)

# Phase 3 tests (before implementation):
T008 (extraction test) | T009 (queue test) | T010 (API test)

# Phase 3 parallel UI tasks (after T011-T013):
T014 (AiExtractionOverlay) | T015 (AiProcessingStatus) | T016 (ConfidenceBadge)

# Phase 4 tests:
T019 (classification test) | T020 (accept test)

# Phase 7 parallel polish:
T037 (graceful degradation) | T038 (rate limits) | T039 (i18n verification)
```

---

## Implementation Strategy

### MVP First (US1 — Extraction Only)

1. Complete Phase 1: Setup (packages, env vars)
2. Complete Phase 2: Foundational (schema, AI client, queue, prompts)
3. Complete Phase 3: US1 — Extraction (tests first, then implementation)
4. **STOP and VALIDATE**: Upload receipts, verify extraction works
5. This alone delivers 50%+ time savings for receipt entry

### Incremental Delivery

1. Setup + Foundation → AI infrastructure ready
2. US1 (Extraction) → Core value: auto-fill receipt fields → **MVP**
3. US2 (Classification) → Budget item suggestions → reduces errors
4. US3 (Review Notes) → AI-assisted spot-checking → reviewer efficiency
5. US4 (Status/Transparency) → Trust and feedback loop
6. Polish → Production-ready with graceful degradation

---

## Summary

- **Total tasks**: 40
- **Phase 1 (Setup)**: 2 tasks
- **Phase 2 (Foundational)**: 5 tasks
- **Phase 3 (US1 - Extraction)**: 11 tasks (3 test + 8 implementation)
- **Phase 4 (US2 - Classification)**: 8 tasks (2 test + 6 implementation)
- **Phase 5 (US3 - Review Notes)**: 6 tasks (1 test + 5 implementation)
- **Phase 6 (US4 - Status/Transparency)**: 4 tasks (1 test + 3 implementation)
- **Phase 7 (Polish)**: 4 tasks
- **Parallel opportunities**: 5 groups identified
- **MVP scope**: Phases 1-3 (18 tasks)
