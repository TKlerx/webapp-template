import { expect, test } from "@playwright/test";
import { Role } from "../../generated/prisma/enums";
import {
  appBasePath,
  expectOnDashboard,
  loginWithPassword,
} from "./helpers/auth";
import { seedLocalUser } from "./helpers/db";

test("audit filters and page changes request records from the server", async ({
  page,
}) => {
  const email = "e2e-audit-admin@example.com";
  const password = "AuditTest123!";
  await seedLocalUser({
    email,
    name: "Audit Test Admin",
    role: Role.PLATFORM_ADMIN,
    password,
    mustChangePassword: false,
  });
  await loginWithPassword(page, email, password);
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
  const entityFilter = page.getByRole("textbox", { name: "Entity" });
  await entityFilter.fill("User");
  await page.getByRole("textbox", { name: "Action" }).fill("USER_CREATED");
  const table = page.getByRole("table");
  await expect(table.getByText("page-1-user", { exact: true })).toBeVisible();

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
