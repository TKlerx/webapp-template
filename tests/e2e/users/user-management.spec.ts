import { expect, test } from "@playwright/test";
import { Role } from "../../../generated/prisma/enums";
import {
  appBasePath,
  appOrigin,
  expectOnDashboard,
  loginWithPassword,
} from "../helpers/auth";
import { seedLocalUser } from "../helpers/db";

test.setTimeout(60000);

test("admin creates a local user, user logs in and changes password", async ({
  browser,
}) => {
  const uniqueSuffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const createdUser = {
    email: `e2e-managed-${uniqueSuffix}@example.com`,
    name: `E2E Managed ${uniqueSuffix}`,
    temporaryPassword: "TempPass123",
  };

  await seedLocalUser({
    email: "e2e-admin-manage@example.com",
    name: "E2E Admin Manage",
    role: Role.GVI_FINANCE_ADMIN,
    password: "AdminPass123",
    mustChangePassword: false,
  });

  const adminContext = await browser.newContext({ baseURL: appOrigin });
  const adminPage = await adminContext.newPage();

  try {
    await loginWithPassword(adminPage, "e2e-admin-manage@example.com", "AdminPass123");
    await expectOnDashboard(adminPage);
    await adminPage.goto(`${appBasePath}/users`);

    await adminPage.getByPlaceholder("Email").fill(createdUser.email);
    await adminPage.getByPlaceholder("Name").fill(createdUser.name);
    await adminPage.locator("select").first().selectOption(Role.COUNTRY_FINANCE);
    await adminPage.getByPlaceholder("Temporary password").fill(createdUser.temporaryPassword);
    await adminPage.getByRole("button", { name: "Create user" }).click();

    const userRow = adminPage.locator("tr", { hasText: createdUser.email });
    await expect(userRow).toBeVisible();
    await expect(userRow).toContainText("Marketer");

    const userContext = await browser.newContext({ baseURL: appOrigin });
    const userPage = await userContext.newPage();

    try {
      const loginResponse = await userContext.request.post(
        `${appOrigin}${appBasePath}/api/auth/login`,
        {
          data: { email: createdUser.email, password: createdUser.temporaryPassword },
          headers: { "Content-Type": "application/json" },
        },
      );
      expect(loginResponse.status()).toBe(200);

      await userPage.goto(`${appBasePath}/change-password`);
      await userPage.getByLabel("Current password").fill(createdUser.temporaryPassword);
      await userPage.getByLabel("New password").fill("FreshPass123");
      await Promise.all([
        userPage.waitForResponse(
          (response) =>
            response.url().includes("/api/auth/change-password") &&
            response.request().method() === "POST" &&
            response.status() === 200,
        ),
        userPage.getByRole("button", { name: "Save new password" }).click(),
      ]);
      await userPage.waitForURL(new RegExp(`${appBasePath}/dashboard$`), { timeout: 30000 });
      await expectOnDashboard(userPage);
    } finally {
      await userContext.close();
    }
  } finally {
    await adminContext.close();
  }
});
