import { expect, test } from "@playwright/test";
import { Role } from "../../../generated/prisma/enums";
import {
  appBasePath,
  expectOnDashboard,
  loginWithPassword,
  openUserMenu,
} from "../helpers/auth";
import {
  seedBackgroundJob,
  seedLocalUser,
  updateUserStatus,
  UserStatus,
} from "../helpers/db";

test("platform admin can inspect and copy ops health diagnostics", async ({
  page,
}) => {
  const adminEmail = "ops-admin@example.com";

  await seedLocalUser({
    email: adminEmail,
    name: "Ops Admin",
    role: Role.PLATFORM_ADMIN,
    password: "OpsAdminPass123",
    mustChangePassword: false,
  });

  try {
    await seedBackgroundJob({
      jobType: "ops-health-evidence",
      status: "COMPLETED",
      workerId: "worker-e2e",
      payload: { safe: true },
    });

    await loginWithPassword(page, adminEmail, "OpsAdminPass123");
    await expectOnDashboard(page);

    await openUserMenu(page);
    await page.getByRole("menuitem", { name: "Ops Health" }).click();
    await expect(page).toHaveURL(new RegExp(`${appBasePath}/admin/ops$`));
    await expect(
      page.getByRole("heading", { name: "Ops Health" }),
    ).toBeVisible();
    await expect(page.getByText("Environment", { exact: true })).toBeVisible();
    await expect(page.getByText("Runtime", { exact: true })).toBeVisible();
    await expect(page.getByText("Database", { exact: true })).toBeVisible();

    for (const viewport of [
      { width: 390, height: 844 },
      { width: 768, height: 1024 },
      { width: 1280, height: 900 },
    ]) {
      await page.setViewportSize(viewport);
      await expect(
        page.getByRole("heading", { name: "Ops Health" }),
      ).toBeVisible();
      const hasHorizontalOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1,
      );
      expect(hasHorizontalOverflow).toBe(false);
    }

    const capturedBefore = await page
      .getByText(/Captured:/)
      .first()
      .textContent();
    await page.getByRole("button", { name: "Refresh" }).click();
    await expect
      .poll(async () =>
        page
          .getByText(/Captured:/)
          .first()
          .textContent(),
      )
      .not.toBe(capturedBefore);

    await page.getByRole("button", { name: "Copy summary" }).click();
    await expect(page.getByRole("status")).toContainText(
      "Diagnostic summary copied",
    );

    await test.step("FR-017: show an error when the browser cannot copy", async () => {
      await page.evaluate(() => {
        Object.defineProperty(navigator, "clipboard", {
          configurable: true,
          value: {
            writeText: () =>
              Promise.reject(
                new DOMException("Copy denied", "NotAllowedError"),
              ),
          },
        });
        document.execCommand = () => false;
      });

      await page.getByRole("button", { name: "Copy summary" }).click();
      await expect(page.getByRole("status")).toHaveText(
        "Could not copy diagnostic summary",
      );
    });

    await page.route("**/api/admin/ops-health", (route) => route.abort(), {
      times: 1,
    });
    await page.getByRole("button", { name: "Refresh" }).click();
    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: "Could not refresh the health snapshot." }),
    ).toBeVisible();
    await page.route(
      "**/api/admin/ops-health",
      async (route) => {
        const response = await route.fetch();
        const snapshot = await response.json();
        await route.fulfill({
          response,
          json: {
            ...snapshot,
            overallStatus: "degraded",
            checks: snapshot.checks.map(
              (check: { key: string; status: string }) =>
                check.key === "worker"
                  ? { ...check, status: "unavailable" }
                  : check,
            ),
          },
        });
      },
      { times: 1 },
    );
    await page.getByRole("button", { name: "Refresh" }).click();
    await expect(
      page.getByText("Degraded", { exact: true }).first(),
    ).toBeVisible();
    await expect(
      page.getByText("Unavailable", { exact: true }).first(),
    ).toBeVisible();

    await page.context().addCookies([
      {
        name: "starter_app_locale",
        value: "de",
        domain: "localhost",
        path: "/",
      },
    ]);
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("lang", "de");
    await expect(page.getByText("Kein Problem erkannt.").first()).toBeVisible();
  } finally {
    updateUserStatus(adminEmail, UserStatus.INACTIVE);
  }
});

test("non-admin users cannot open ops health", async ({ page }) => {
  await seedLocalUser({
    email: "ops-user@example.com",
    name: "Ops User",
    role: Role.SCOPE_USER,
    password: "UserPass123",
    mustChangePassword: false,
  });

  await loginWithPassword(page, "ops-user@example.com", "UserPass123");
  await expectOnDashboard(page);
  await page.goto(`${appBasePath}/admin/ops`);

  await expect(page).toHaveURL(new RegExp(`${appBasePath}/dashboard$`));
});
