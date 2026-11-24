import { expect, test } from "@playwright/test";
import { Role, UserStatus } from "../../generated/prisma/enums";
import {
  appBasePath,
  expectOnDashboard,
  loginWithPassword,
} from "./helpers/auth";
import { seedLocalUser, updateUserStatus } from "./helpers/db";

const auditAdminEmail = "e2e-audit-admin@example.com";

test.beforeEach(async ({ page }) => {
  const password = "AuditTest123!";
  await seedLocalUser({
    email: auditAdminEmail,
    name: "Audit Test Admin",
    role: Role.PLATFORM_ADMIN,
    password,
    mustChangePassword: false,
  });
  await loginWithPassword(page, auditAdminEmail, password);
  await expectOnDashboard(page);

  await page.route(/\/api\/audit\?/, async (route) => {
    const params = new URL(route.request().url()).searchParams;
    const requestedPage = Number(params.get("page"));
    const matches =
      params.get("action") === "USER_CREATED" &&
      params.get("entityType") === "User";
    await route.fulfill({
      json: {
        data: matches
          ? [
              {
                id: `audit-${requestedPage}`,
                action: "USER_CREATED",
                entityType: "User",
                entityId: `page-${requestedPage}-user`,
                details: "User created",
                createdAt: "2026-01-01T00:00:00Z",
                actor: null,
              },
            ]
          : [],
        total: matches ? 2 : 0,
        page: requestedPage,
        limit: 1,
      },
    });
  });

  await page.goto(`${appBasePath}/audit-trail`);
  await page.getByRole("textbox", { name: "Entity" }).fill("User");
  await page.getByRole("textbox", { name: "Action" }).fill("USER_CREATED");
  await expect(page.getByRole("table").getByText("page-1-user")).toBeVisible();
});

test.afterEach(() => {
  updateUserStatus(auditAdminEmail, UserStatus.INACTIVE);
});

test("audit filters and page changes request records from the server", async ({
  page,
}) => {
  const entityFilter = page.getByRole("textbox", { name: "Entity" });
  const table = page.getByRole("table");

  await page.getByRole("button", { name: "Page 2 of 2" }).click();
  await expect(table.getByText("page-2-user", { exact: true })).toBeVisible();
  await expect(table.getByText("page-1-user", { exact: true })).toHaveCount(0);

  const resetRequest = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return (
      url.pathname === `${appBasePath}/api/audit` &&
      url.searchParams.get("entityType") === "Scope" &&
      url.searchParams.get("action") === "USER_CREATED" &&
      url.searchParams.get("page") === "1"
    );
  });
  await entityFilter.fill("Scope");
  await resetRequest;
  await expect(
    page.getByText("No audit entries match your filters."),
  ).toBeVisible();
});

test("can return to the previous audit page after a load error", async ({
  page,
}) => {
  await page.route(
    (url) =>
      url.pathname === `${appBasePath}/api/audit` &&
      url.searchParams.get("page") === "2",
    (route) =>
      route.fulfill({
        status: 503,
        json: { error: "Audit service unavailable" },
      }),
  );

  await page.getByRole("button", { name: "Page 2 of 2" }).click();
  const error = page.getByRole("alert").filter({
    hasText: "Audit service unavailable",
  });
  await expect(error).toBeVisible();

  await page.getByRole("button", { name: "Previous", exact: true }).click();
  await expect(page.getByRole("table").getByText("page-1-user")).toBeVisible();
  await expect(error).toHaveCount(0);
  await expect(page.getByRole("textbox", { name: "Action" })).toHaveValue(
    "USER_CREATED",
  );
  await expect(page.getByRole("textbox", { name: "Entity" })).toHaveValue(
    "User",
  );
});
