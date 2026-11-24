import { randomUUID } from "node:crypto";
import { expect, test as base } from "@playwright/test";
import { Role, UserStatus } from "../../generated/prisma/enums";
import {
  appBasePath,
  expectOnDashboard,
  loginWithPassword,
} from "./helpers/auth";
import { seedLocalUser, updateUserStatus } from "./helpers/db";

const auditAdminPassword = "AuditTest123!";
const test = base.extend<{ auditAdminEmail: string }>({
  auditAdminEmail: async ({}, runTest) => {
    const email = `e2e-audit-${randomUUID()}@example.com`;
    seedLocalUser({
      email,
      name: "Audit Test Admin",
      role: Role.PLATFORM_ADMIN,
      password: auditAdminPassword,
      mustChangePassword: false,
    });
    try {
      await runTest(email);
    } finally {
      updateUserStatus(email, UserStatus.INACTIVE);
    }
  },
});

function auditRow(entityId: string) {
  return {
    id: entityId,
    action: "USER_CREATED",
    entityType: "User",
    entityId,
    details: "User created",
    createdAt: "2026-01-01T00:00:00Z",
    actor: null,
  };
}

test.beforeEach(async ({ page, auditAdminEmail }) => {
  await loginWithPassword(page, auditAdminEmail, auditAdminPassword);
  await expectOnDashboard(page);

  await page.route(/\/api\/audit\?/, async (route) => {
    const params = new URL(route.request().url()).searchParams;
    const requestedPage = Number(params.get("page"));
    const matches =
      params.get("action") === "USER_CREATED" &&
      params.get("entityType") === "User";
    await route.fulfill({
      json: {
        data: matches ? [auditRow(`page-${requestedPage}-user`)] : [],
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

test("keeps keyboard focus on audit pagination after rows load", async ({
  page,
}) => {
  await page.setViewportSize({ width: 900, height: 650 });
  // A one-row final page can grow into a full page when going back.
  await page.route(
    (url) =>
      url.pathname === `${appBasePath}/api/audit` &&
      url.searchParams.get("entityType") === "User",
    (route) => {
      const requestedPage = Number(
        new URL(route.request().url()).searchParams.get("page"),
      );
      return route.fulfill({
        json: {
          data:
            requestedPage === 1
              ? Array.from({ length: 25 }, (_, index) =>
                  auditRow(`full-page-user-${index + 1}`),
                )
              : [auditRow("page-2-user")],
          total: 26,
          page: requestedPage,
          limit: 25,
        },
      });
    },
  );
  const table = page.getByRole("table");
  const pageTwo = page.getByRole("button", { name: "Page 2 of 2" });
  await pageTwo.focus();
  await page.keyboard.press("Enter");
  await expect(table.getByText("page-2-user")).toBeVisible();
  await expect(pageTwo).toBeFocused();
  await expect(pageTwo).toHaveAttribute("aria-current", "page");

  const previous = page.getByRole("button", { name: "Previous", exact: true });
  await previous.focus();
  await page.keyboard.press("Enter");
  await expect(table.getByText("full-page-user-25")).toBeVisible();
  await expect(previous).toBeFocused();
  await expect(previous).toBeInViewport({ ratio: 1 });
  await expect(previous).toHaveAttribute("aria-disabled", "true");
});

for (const remainingPages of [1, 2]) {
  test(`restores audit focus when the page count shrinks to ${remainingPages}`, async ({
    page,
  }) => {
    const entityFilter = page.getByRole("textbox", { name: "Entity" });
    let total = 3;
    await page.route(
      (url) =>
        url.pathname === `${appBasePath}/api/audit` &&
        url.searchParams.get("entityType") === "Shrinking",
      (route) => {
        const requestedPage = Number(
          new URL(route.request().url()).searchParams.get("page"),
        );
        if (requestedPage === 3) total = remainingPages;
        return route.fulfill({
          json: {
            data:
              requestedPage <= total
                ? [auditRow(`remaining-page-${requestedPage}`)]
                : [],
            total,
            page: requestedPage,
            limit: 1,
          },
        });
      },
    );
    await entityFilter.fill("Shrinking");
    const removedPage = page.getByRole("button", { name: "Page 3 of 3" });
    await removedPage.focus();
    await page.keyboard.press("Enter");
    const table = page.getByRole("table");
    await expect(
      table.getByText(`remaining-page-${remainingPages}`),
    ).toBeVisible();
    if (remainingPages === 1) {
      await expect(
        page.getByRole("navigation", { name: "Audit trail pages" }),
      ).toHaveCount(0);
      await expect(table).toBeFocused();
    } else {
      await expect(
        page.getByRole("button", { name: "Page 2 of 2" }),
      ).toBeFocused();
    }
  });
}

for (const retryControl of ["Retry", "Page 2 of 2"]) {
  test(`retries the failed audit request via ${retryControl}`, async ({
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
      { times: 1 },
    );

    const pageTwo = page.getByRole("button", { name: "Page 2 of 2" });
    await pageTwo.focus();
    await page.keyboard.press("Enter");
    const error = page.getByRole("alert").filter({
      hasText: "Audit service unavailable",
    });
    await expect(error).toBeVisible();

    await page.getByRole("button", { name: retryControl, exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("table").getByText("page-2-user"),
    ).toBeVisible();
    await expect(error).toHaveCount(0);
    await expect(pageTwo).toBeFocused();
  });
}

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
