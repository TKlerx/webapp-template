# Quickstart: AI Receipt Processing

**Date**: 2026-03-20
**Prerequisites**: Features 1 and 2 implemented. Azure OpenAI provisioned with GPT-4o deployment.

## Setup

```bash
npm install openai
```

Add to `.env`:
```
AZURE_OPENAI_ENDPOINT=https://your-instance.openai.azure.com
AZURE_OPENAI_API_KEY=...
AZURE_OPENAI_DEPLOYMENT=gpt-4o
AZURE_OPENAI_API_VERSION=2024-12-01-preview
```

Run migration:
```bash
npm run prisma:migrate
```

## Key Workflow

1. Country Finance user uploads a receipt image/PDF
2. Receipt form appears immediately for manual entry
3. System enqueues AI extraction → status shows "Analyzing receipt..."
4. AI extracts amount, currency, date, description → fields auto-populate with confidence badges
5. AI suggests budget item classification → user accepts or overrides
6. User confirms all values and saves receipt
7. During GVI Finance admin review → AI review notes appear (anomalies, duplicates)

## Graceful Degradation

If Azure OpenAI env vars are not configured or the service is unavailable:
- Receipt upload works normally (manual entry only)
- No AI status indicators shown
- No classification suggestions
- No review notes
- No errors — AI features simply don't appear
