import { expect, test } from "@playwright/test";
import { Role, UserStatus } from "../../../generated/prisma/enums";
import {
  appBasePath,
  appOrigin,
  expectOnDashboard,
  loginWithPassword,
} from "../helpers/auth";
import { seedLocalUser, updateUserStatuses } from "../helpers/db";

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

  const adminContext = await browser.newContext({
    baseURL: appOrigin,
    viewport: { width: 390, height: 844 },
  });
  const adminPage = await adminContext.newPage();

  try {
    await loginWithPassword(
      adminPage,
      "e2e-admin-manage@example.com",
      "AdminPass123",
    );
    await expectOnDashboard(adminPage);
    await adminPage.goto(`${appBasePath}/users`);

    await expect
      .poll(() =>
        adminPage.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      )
      .toBe(true);
    const createButton = adminPage.getByRole("button", { name: "Create user" });
    await createButton.press("Enter");
    const createUserDialog = adminPage.getByRole("dialog", {
      name: "Create local user",
    });
    await expect(createUserDialog).toBeVisible();
    const emailInput = createUserDialog.getByRole("textbox", { name: "Email" });
    await expect(emailInput).toBeFocused();
    await emailInput.fill(createdUser.email);
    await adminPage.keyboard.press("Escape");
    await expect(createUserDialog).toBeHidden();
    await expect(createButton).toBeFocused();

    await createButton.press("Enter");
    await expect(emailInput).toHaveValue("");
    await emailInput.fill("e2e-admin-manage@example.com");
    await createUserDialog
      .getByRole("textbox", { name: "Name" })
      .fill(createdUser.name);
    const formRole = createUserDialog.getByRole("combobox", { name: "Role" });
    await expect(formRole).toHaveValue("Scoped User");
    await formRole.press("ArrowDown");
    await expect(
      adminPage.getByRole("option", { name: "Scoped User" }),
    ).toBeVisible();
    await formRole.press("Escape");
    await createUserDialog
      .getByLabel("Temporary password")
      .fill(createdUser.temporaryPassword);
    const submitButton = createUserDialog.getByRole("button", {
      name: "Create user",
    });
    await submitButton.click();
    await expect(createUserDialog.getByRole("alert")).toHaveText(
      "A user with this email already exists",
    );
    await emailInput.fill(createdUser.email);
    await Promise.all([
      adminPage.waitForResponse(
        (response) =>
          response.url().includes("/api/users") &&
          response.request().method() === "POST" &&
          response.status() === 201,
      ),
      submitButton.click(),
    ]);
    await expect(createUserDialog).toBeHidden();
    await expect(createButton).toBeFocused();

    const userTable = adminPage.getByRole("table", { name: "Users" });
    const userRow = userTable
      .getByRole("row")
      .filter({ hasText: createdUser.email });
    const rowRole = userRow.getByRole("combobox", { name: "Role" });
    await expect(userRow).toBeVisible();
    await expect(rowRole).toHaveValue("Scoped User");
    await expect(
      userTable
        .getByRole("row")
        .filter({ hasText: "e2e-admin-manage@example.com" })
        .getByRole("combobox", { name: "Role" }),
    ).toBeDisabled();

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

    await rowRole.click();
    await adminPage.getByRole("option", { name: "Scoped Admin" }).click();
    await expect(rowRole).toHaveValue("Scoped Admin");
    await expect(
      adminPage.getByText("Role updated to Scoped Admin"),
    ).toBeVisible();
  } finally {
    await adminContext.close();
    updateUserStatuses(["e2e-admin-manage@example.com"], UserStatus.INACTIVE);
  }
});

test("last active admin cannot be deactivated", async ({ browser }) => {
  await seedLocalUser({
    email: "admin@example.com",
    name: "Admin User",
    role: Role.PLATFORM_ADMIN,
    password: "AdminPass123",
    mustChangePassword: false,
  });

  await seedLocalUser({
    email: "e2e-secondary-admin@example.com",
    name: "E2E Secondary Admin",
    role: Role.PLATFORM_ADMIN,
    password: "SecondaryPass123",
    mustChangePassword: false,
  });

  const adminContext = await browser.newContext({ baseURL: appOrigin });
  const adminPage = await adminContext.newPage();

  try {
    await loginWithPassword(adminPage, "admin@example.com", "AdminPass123");
    await expectOnDashboard(adminPage);
    await adminPage.goto(`${appBasePath}/users`);

    const adminRow = adminPage.locator("tr", {
      hasText: "e2e-secondary-admin@example.com",
    });
    await expect(adminRow).toBeVisible();
    await adminRow.getByRole("button", { name: "Deactivate" }).click();
    await expect(adminPage.getByText("User deactivated").first()).toBeVisible();

    updateUserStatuses(
      [
        "e2e-admin-manage@example.com",
        "e2e-admin@example.com",
        "e2e-event-admin@example.com",
        "e2e-notifications-admin@example.com",
        "e2e-tokens-mobile@example.com",
      ],
      UserStatus.INACTIVE,
    );
    await adminPage.reload();

    const selfRow = adminPage.getByRole("row", {
      name: /Admin User\s+admin@example\.com/,
    });
    await expect(selfRow).toBeVisible();
    await selfRow.getByRole("button", { name: "Deactivate" }).click();

    await expect(
      adminPage.getByText("Cannot deactivate the last Admin user"),
    ).toBeVisible();
  } finally {
    await adminContext.close();
  }
});
