# Implementation Plan: AI Receipt Processing

**Branch**: `005-ai-receipt-processing` | **Date**: 2026-03-20 | **Spec**: [spec.md](spec.md)

## Summary

Add asynchronous AI-powered receipt processing: OCR data extraction (amount, currency, date, description), budget item classification suggestions, and AI-assisted review notes (anomaly detection, duplicate flagging). Uses Azure OpenAI exclusively. Graceful degradation when AI is unavailable.

## Technical Context

**Language/Version**: TypeScript 5.x with Next.js 16 (App Router)
**Primary Dependencies**: Existing stack + new: `openai` npm package (configured for Azure OpenAI endpoint), image-to-base64 conversion for vision API.
**Storage**: SQLite via Prisma. AI results stored alongside receipt records.
**Testing**: Vitest (unit with mocked Azure OpenAI), E2E for extraction flow
**Performance Goals**: AI processing <15s per receipt, 85% amount accuracy
**Constraints**: Azure OpenAI rate limits, async processing, graceful degradation

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Simplicity First | ✅ Pass | Single service wrapping Azure OpenAI. No custom model training. |
| II. Test Coverage | ✅ Pass | Mocked AI responses for unit tests. Integration tests with real API if configured. |
| III. Duplication Control | ✅ Pass | Single AI service used by upload flow and review flow. |
| IV. Incremental Delivery | ✅ Pass | P1 extraction first, then classification, then review notes. |
| V. Azure OpenAI | ✅ Pass | Exclusively Azure OpenAI. Encapsulated in ai-service.ts. |
| VI. Web App Standards | ✅ Pass | Processing status shown via toast + inline indicator. |
| VII. i18n | ✅ Pass | AI status messages translated. |
| VIII. Responsive | ✅ Pass | |

## Project Structure

```text
src/
├── app/
│   ├── api/
│   │   └── receipts/[id]/
│   │       ├── ai-extract/       # POST: trigger extraction (or auto on upload)
│   │       ├── ai-classify/      # GET: classification suggestions
│   │       └── ai-review/        # GET: review notes for this receipt
│   ├── (dashboard)/
│   │   └── receipts/
│   │       └── [id]/             # Enhanced with AI extraction display
├── components/
│   ├── ai/
│   │   ├── AiExtractionOverlay.tsx  # Shows AI-extracted vs confirmed values
│   │   ├── AiClassificationSuggestions.tsx # Top 3 budget item suggestions
│   │   ├── AiReviewNotes.tsx     # Advisory notes during review
│   │   ├── AiProcessingStatus.tsx # Processing indicator
│   │   └── ConfidenceBadge.tsx   # High/medium/low confidence display
├── lib/
│   ├── ai-service.ts            # Azure OpenAI client wrapper
│   ├── ai-extraction.ts         # Receipt data extraction via vision API
│   ├── ai-classification.ts     # Budget item classification logic
│   ├── ai-review.ts             # Anomaly detection + duplicate checking
│   ├── ai-queue.ts              # Async processing queue with retry
│   └── ai-prompts.ts            # Prompt templates for extraction/classification
```
