# Quickstart: Budget Planning & Core Data Model

**Date**: 2026-03-20

## Prerequisites

- Node.js 20+
- npm
- Git

## Setup

```bash
# Clone and install
git clone <repo>
cd gvi-finance
npm install

# Environment
cp .env.example .env
# Edit .env: set DATABASE_URL, BETTER_AUTH_SECRET, BASE_PATH=/gvi-finance

# Database
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed    # Creates initial GVI_FINANCE_ADMIN user

# Create uploads directory
mkdir -p uploads

# Start dev server
npm run dev
```

## Key Workflows

### 1. Create Budget Structure
1. Log in as GVI Finance Admin
2. Navigate to Budget Years → Create "2026" with date range
3. Add country "Kenya" with total budget €50,000 (EUR)
4. Build budget item hierarchy under Kenya:
   - Personnel (€30,000)
     - Salaries (€20,000)
     - Training (€10,000)
   - Mission Costs (€15,000)
     - Fuel (€8,000)
     - Accommodation (€7,000)

### 2. Assign Users to Countries
1. As GVI Finance Admin, go to Users
2. Create user with role "Country Finance"
3. Assign to country "Kenya"
4. User can now only see Kenya's data

### 3. Upload Receipt
1. Log in as Country Finance user (Kenya)
2. Navigate to Receipts → Upload
3. Select budget year, budget item "Fuel"
4. Upload PDF/image file, enter amount, date, description
5. Receipt appears under Fuel with uploaded file

### 4. Tag Donor Project
1. As GVI Finance Admin, create donor "European Union"
2. Create donor project "EU Grant 2026 - Kenya Education"
3. Tag budget item "Personnel" → all receipts under Personnel are included
4. Optionally tag individual receipts directly

### 5. View Budget Overview
1. Navigate to Budget Overview
2. Select country "Kenya", year "2026"
3. See hierarchy with planned vs. actual amounts
4. Over-budget items highlighted in red
5. Click any item to drill down to receipts

## Running Tests

```bash
# Unit tests
npm test

# E2E tests
npm run test:e2e

# All validations (typecheck + lint + duplication + semgrep + tests)
npm run validate
```

## File Storage

Receipt files are stored in `uploads/{year}/{month}/{uuid}.{ext}`. This directory is:
- Created automatically on first upload
- Excluded from git (`.gitignore`)
- Files are immutable (no delete/update API)
- Retained for 10 years per compliance requirements
