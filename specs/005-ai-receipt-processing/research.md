# Research: AI Receipt Processing

**Date**: 2026-03-20

## R1: Azure OpenAI Client Library

**Decision**: Use the `openai` npm package configured for Azure OpenAI endpoint.

**Rationale**: The official `openai` package supports Azure OpenAI via the `AzureOpenAI` class (or by setting `baseURL` and `apiVersion`). This is the recommended approach from both OpenAI and Azure documentation. No additional Azure-specific SDK needed.

**Alternatives considered**:
- `@azure/openai` → rejected: Microsoft deprecated this package in favor of using the standard `openai` SDK with Azure configuration
- Direct HTTP calls → rejected: unnecessary when a well-maintained SDK exists

**Implementation**:
- `ai-service.ts` wraps the Azure OpenAI client with project-specific configuration
- Environment variables: `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_DEPLOYMENT` (for GPT-4o with vision), `AZURE_OPENAI_API_VERSION`
- Client is initialized lazily; if env vars are missing, AI features degrade gracefully

## R2: Vision API for Receipt Extraction

**Decision**: Use GPT-4o vision capabilities to extract structured data from receipt images. Send the receipt image as a base64-encoded data URL in a chat completion request with a structured extraction prompt.

**Rationale**: GPT-4o has strong OCR and document understanding capabilities. A single API call can extract amount, currency, date, and description from a receipt image. No separate OCR service needed.

**Alternatives considered**:
- Azure Document Intelligence (Form Recognizer) → rejected: adds a separate Azure service and billing; GPT-4o vision is sufficient for our volume (~10 users, hundreds of receipts/month)
- Tesseract.js (client-side OCR) → rejected: lower accuracy for receipts, especially for varied formats and languages
- Two-step OCR + LLM → rejected: unnecessary complexity when GPT-4o handles both

**Implementation**:
- Convert uploaded image to base64 (or use file URL if stored accessibly)
- For PDFs: extract first page as image using a lightweight converter, or send text content if PDF has embedded text
- Prompt asks for JSON response: `{ amount: number, currency: string, date: string, description: string, confidence: { amount: "high"|"medium"|"low", ... } }`
- Use `response_format: { type: "json_object" }` for reliable JSON output

## R3: Budget Item Classification Approach

**Decision**: Use GPT-4o text completion with the country's budget hierarchy as context. Send the receipt description, amount, and the flattened budget tree; ask the model to rank the top 3 matching budget items with confidence scores.

**Rationale**: The budget hierarchy is small enough (typically <100 items per country) to include in a single prompt. The model can match receipt descriptions to budget item names effectively without fine-tuning.

**Alternatives considered**:
- Embedding similarity search → rejected: over-engineering for <100 items; prompt-based approach is simpler and more explainable
- Rule-based keyword matching → rejected: too brittle; would need constant maintenance as budget structures change
- Fine-tuned classification model → rejected: explicitly out of scope per spec

**Implementation**:
- Flatten budget hierarchy into `[{ id, name, fullPath, depth }]` array
- Include recent receipts for the same budget items as few-shot examples (if available)
- Response format: `{ suggestions: [{ budgetItemId: string, confidence: number, reasoning: string }] }`
- Top 3 suggestions returned to the user

## R4: Async Processing Queue

**Decision**: Use an in-memory queue with database-backed status tracking. On receipt upload, enqueue AI processing; update status in the database as processing progresses. Client polls for status updates.

**Rationale**: For ~10 users and low volume, an in-memory queue is sufficient. No need for Redis or a dedicated job queue system. Database status tracking ensures the UI can always show the current state, even after server restart (pending items re-queued on startup).

**Alternatives considered**:
- BullMQ with Redis → rejected: adds Redis dependency for a low-volume use case
- Server-Sent Events (SSE) for real-time updates → viable enhancement but polling is simpler to implement first
- Synchronous processing → rejected: 15s blocking would degrade UX

**Implementation**:
- `ai-queue.ts`: simple FIFO queue with concurrency limit (e.g., 3 concurrent)
- Receipt model gets `aiStatus` field: `pending`, `processing`, `complete`, `failed`
- On upload: set `aiStatus = "pending"`, enqueue extraction job
- Queue worker: set `aiStatus = "processing"`, call extraction → classification, set `aiStatus = "complete"` or `"failed"`
- Retry logic: up to 3 retries with exponential backoff for transient errors
- Client: poll `/api/receipts/[id]` every 2-3 seconds while status is `pending` or `processing`

## R5: Duplicate Detection Strategy

**Decision**: Use database-level querying for exact/near matches on amount + date + vendor, combined with AI-based similarity assessment for the review notes.

**Rationale**: Simple database queries catch exact duplicates efficiently. For near-matches (similar vendor names, close dates), the AI review step can assess similarity during the review phase.

**Implementation**:
- During AI review: query receipts with same amount and date within same country
- If matches found, include them in the AI review prompt for similarity assessment
- AI review note: "Potential duplicate: Receipt #X from [date] has the same amount (€150) and a similar vendor ([vendor])"
- Link to the potentially duplicate receipt in the review UI

## R6: AI Result Storage

**Decision**: Store AI extraction results in a dedicated `AiExtractionResult` model linked to the receipt. This preserves the original AI output alongside the user-confirmed values on the receipt itself.

**Rationale**: Keeping AI results separate from the receipt's confirmed fields enables: (1) transparency — users see what AI suggested vs. what was confirmed, (2) accuracy tracking — compare AI values to final values for improvement metrics, (3) no schema pollution of the core Receipt model.

**Implementation**:
- `AiExtractionResult`: receipt relation, extractedAmount, extractedCurrency, extractedDate, extractedDescription, confidence scores, raw JSON response, processing time
- `AiClassificationResult`: receipt relation, top 3 suggestions with scores, accepted suggestion
- `AiReviewNote`: receipt relation, note type (anomaly, duplicate, mismatch), content, severity, linked receipt (for duplicates)
