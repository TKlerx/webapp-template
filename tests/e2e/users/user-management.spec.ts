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
    role: Role.PLATFORM_ADMIN,
    password: "AdminPass123",
    mustChangePassword: false,
  });

  const adminContext = await browser.newContext({ baseURL: appOrigin });
  const adminPage = await adminContext.newPage();

  try {
    await loginWithPassword(
      adminPage,
      "e2e-admin-manage@example.com",
      "AdminPass123",
    );
    await expectOnDashboard(adminPage);
    await adminPage.goto(`${appBasePath}/users`);

    await adminPage
      .getByRole("button", { name: "Create user" })
      .first()
      .click();
    const createUserDialog = adminPage.getByRole("dialog");
    await expect(createUserDialog).toBeVisible();

    await createUserDialog.getByPlaceholder("Email").fill(createdUser.email);
    await createUserDialog.getByPlaceholder("Name").fill(createdUser.name);
    await createUserDialog.getByRole("combobox", { name: "Role" }).click();
    await adminPage.getByRole("option", { name: "Scoped User" }).click();
    await createUserDialog
      .getByPlaceholder("Temporary password")
      .fill(createdUser.temporaryPassword);
    await Promise.all([
      adminPage.waitForResponse(
        (response) =>
          response.url().includes("/api/users") &&
          response.request().method() === "POST" &&
          response.status() === 201,
      ),
      createUserDialog.getByRole("button", { name: "Create user" }).click(),
    ]);
    await adminPage.reload();

    const userRow = adminPage.locator("tr", { hasText: createdUser.email });
    await expect(userRow).toBeVisible();
    await expect(userRow).toContainText("Scoped User");

    const userContext = await browser.newContext({ baseURL: appOrigin });
    const userPage = await userContext.newPage();

    try {
      await loginWithPassword(
        userPage,
        createdUser.email,
        createdUser.temporaryPassword,
      );
      await expect(userPage).toHaveURL(
        new RegExp(`${appBasePath}/change-password$`),
      );
      await userPage
        .getByLabel("Current password")
        .fill(createdUser.temporaryPassword);
      await userPage.getByLabel("New password").fill("FreshPass123");
      await Promise.all([
        userPage.getByRole("button", { name: "Save new password" }).click(),
        userPage.waitForResponse(
          (response) =>
            response.url().includes("/api/auth/change-password") &&
            response.request().method() === "POST" &&
            response.status() === 200,
        ),
      ]);
      await userPage.waitForURL(new RegExp(`${appBasePath}/dashboard$`), {
        timeout: 30000,
      });
      await expectOnDashboard(userPage);
    } finally {
      await userContext.close();
    }
  } finally {
    await adminContext.close();
  }
});
