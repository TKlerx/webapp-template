-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "name" TEXT NOT NULL,
    "image" TEXT,
    "role" TEXT NOT NULL DEFAULT 'COUNTRY_FINANCE',
    "status" TEXT NOT NULL DEFAULT 'PENDING_APPROVAL',
    "authMethod" TEXT NOT NULL,
    "passwordHash" TEXT,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
    "themePreference" TEXT NOT NULL DEFAULT 'LIGHT',
    "locale" TEXT NOT NULL DEFAULT 'en',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" DATETIME,
    "refreshTokenExpiresAt" DATETIME,
    "scope" TEXT,
    "password" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Verification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ProgramCountry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "UserCountryAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserCountryAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserCountryAssignment_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "ProgramCountry" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BudgetYear" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "label" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CountryBudget" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "budgetYearId" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,
    "totalAmount" DECIMAL NOT NULL,
    "currency" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CountryBudget_budgetYearId_fkey" FOREIGN KEY ("budgetYearId") REFERENCES "BudgetYear" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CountryBudget_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "ProgramCountry" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BudgetItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "countryBudgetId" TEXT NOT NULL,
    "parentId" TEXT,
    "name" TEXT NOT NULL,
    "plannedAmount" DECIMAL NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BudgetItem_countryBudgetId_fkey" FOREIGN KEY ("countryBudgetId") REFERENCES "CountryBudget" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BudgetItem_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "BudgetItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Receipt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "budgetItemId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "amount" DECIMAL NOT NULL,
    "currency" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "description" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Receipt_budgetItemId_fkey" FOREIGN KEY ("budgetItemId") REFERENCES "BudgetItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Receipt_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InstitutionalDonor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "DonorProject" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "donorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DonorProject_donorId_fkey" FOREIGN KEY ("donorId") REFERENCES "InstitutionalDonor" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DonorProjectTag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "donorProjectId" TEXT NOT NULL,
    "budgetItemId" TEXT,
    "receiptId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DonorProjectTag_donorProjectId_fkey" FOREIGN KEY ("donorProjectId") REFERENCES "DonorProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DonorProjectTag_budgetItemId_fkey" FOREIGN KEY ("budgetItemId") REFERENCES "BudgetItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DonorProjectTag_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "Receipt" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BudgetProposal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "countryBudgetId" TEXT NOT NULL,
    "proposedById" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "targetBudgetItemId" TEXT,
    "payload" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewComment" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BudgetProposal_countryBudgetId_fkey" FOREIGN KEY ("countryBudgetId") REFERENCES "CountryBudget" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BudgetProposal_proposedById_fkey" FOREIGN KEY ("proposedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BudgetProposal_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BudgetProposal_targetBudgetItemId_fkey" FOREIGN KEY ("targetBudgetItemId") REFERENCES "BudgetItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "countryId" TEXT,
    "details" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditEntry_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AuditEntry_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "ProgramCountry" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BudgetTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BudgetTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BudgetTemplateItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateId" TEXT NOT NULL,
    "parentId" TEXT,
    "name" TEXT NOT NULL,
    "defaultAmount" DECIMAL NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "BudgetTemplateItem_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "BudgetTemplate" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BudgetTemplateItem_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "BudgetTemplateItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_providerId_accountId_key" ON "Account"("providerId", "accountId");

-- CreateIndex
CREATE INDEX "Verification_identifier_idx" ON "Verification"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramCountry_name_key" ON "ProgramCountry"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramCountry_code_key" ON "ProgramCountry"("code");

-- CreateIndex
CREATE INDEX "UserCountryAssignment_countryId_idx" ON "UserCountryAssignment"("countryId");

-- CreateIndex
CREATE UNIQUE INDEX "UserCountryAssignment_userId_countryId_key" ON "UserCountryAssignment"("userId", "countryId");

-- CreateIndex
CREATE UNIQUE INDEX "BudgetYear_label_key" ON "BudgetYear"("label");

-- CreateIndex
CREATE INDEX "CountryBudget_countryId_idx" ON "CountryBudget"("countryId");

-- CreateIndex
CREATE UNIQUE INDEX "CountryBudget_budgetYearId_countryId_key" ON "CountryBudget"("budgetYearId", "countryId");

-- CreateIndex
CREATE INDEX "BudgetItem_countryBudgetId_idx" ON "BudgetItem"("countryBudgetId");

-- CreateIndex
CREATE INDEX "BudgetItem_parentId_idx" ON "BudgetItem"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "Receipt_filePath_key" ON "Receipt"("filePath");

-- CreateIndex
CREATE INDEX "Receipt_budgetItemId_idx" ON "Receipt"("budgetItemId");

-- CreateIndex
CREATE INDEX "Receipt_uploadedById_idx" ON "Receipt"("uploadedById");

-- CreateIndex
CREATE INDEX "Receipt_date_idx" ON "Receipt"("date");

-- CreateIndex
CREATE UNIQUE INDEX "InstitutionalDonor_name_key" ON "InstitutionalDonor"("name");

-- CreateIndex
CREATE INDEX "DonorProject_donorId_idx" ON "DonorProject"("donorId");

-- CreateIndex
CREATE INDEX "DonorProjectTag_donorProjectId_idx" ON "DonorProjectTag"("donorProjectId");

-- CreateIndex
CREATE INDEX "DonorProjectTag_budgetItemId_idx" ON "DonorProjectTag"("budgetItemId");

-- CreateIndex
CREATE INDEX "DonorProjectTag_receiptId_idx" ON "DonorProjectTag"("receiptId");

-- CreateIndex
CREATE INDEX "BudgetProposal_countryBudgetId_idx" ON "BudgetProposal"("countryBudgetId");

-- CreateIndex
CREATE INDEX "BudgetProposal_proposedById_idx" ON "BudgetProposal"("proposedById");

-- CreateIndex
CREATE INDEX "BudgetProposal_reviewedById_idx" ON "BudgetProposal"("reviewedById");

-- CreateIndex
CREATE INDEX "BudgetProposal_targetBudgetItemId_idx" ON "BudgetProposal"("targetBudgetItemId");

-- CreateIndex
CREATE INDEX "BudgetProposal_status_idx" ON "BudgetProposal"("status");

-- CreateIndex
CREATE INDEX "AuditEntry_action_idx" ON "AuditEntry"("action");

-- CreateIndex
CREATE INDEX "AuditEntry_entityType_entityId_idx" ON "AuditEntry"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditEntry_actorId_idx" ON "AuditEntry"("actorId");

-- CreateIndex
CREATE INDEX "AuditEntry_countryId_idx" ON "AuditEntry"("countryId");

-- CreateIndex
CREATE INDEX "AuditEntry_createdAt_idx" ON "AuditEntry"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BudgetTemplate_name_key" ON "BudgetTemplate"("name");

-- CreateIndex
CREATE INDEX "BudgetTemplateItem_templateId_idx" ON "BudgetTemplateItem"("templateId");

-- CreateIndex
CREATE INDEX "BudgetTemplateItem_parentId_idx" ON "BudgetTemplateItem"("parentId");
