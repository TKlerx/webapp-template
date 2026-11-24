import { randomUUID } from "node:crypto";
import { expect, test, type Locator } from "@playwright/test";
import { Role, UserStatus } from "../../../generated/prisma/enums";
import {
  appBasePath,
  appOrigin,
  expectOnDashboard,
  loginWithPassword,
} from "../helpers/auth";
import { seedLocalUser, updateUserStatuses } from "../helpers/db";

test.setTimeout(60000);

const desktopAdminEmail = `desktop${"w".repeat(57)}@example.com`;

function activeRoleOption(role: Locator) {
  return role.evaluate((element) => {
    const id = element.getAttribute("aria-activedescendant");
    return id ? document.getElementById(id)?.textContent : null;
  });
}

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
    await expect(formRole).toHaveText("Scoped User");
    await formRole.press("ArrowDown");
    await expect(
      adminPage.getByRole("option", { name: "Scoped User" }),
    ).toBeVisible();
    await formRole.press("p");
    await expect.poll(() => activeRoleOption(formRole)).toBe("Platform Admin");
    await formRole.press("End");
    await expect.poll(() => activeRoleOption(formRole)).toBe("Scoped User");
    await formRole.press("Home");
    await expect.poll(() => activeRoleOption(formRole)).toBe("Platform Admin");
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
    await expect(rowRole).toHaveText("Scoped User");
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

    await adminPage.setViewportSize({ width: 320, height: 844 });
    await rowRole.click();
    const roleList = adminPage.getByRole("listbox", { name: "Role" });
    await expect(roleList).toBeVisible();
    let roleRequests = 0;
    adminPage.on("request", (request) => {
      if (
        request.method() === "PATCH" &&
        new URL(request.url()).pathname.endsWith("/role")
      ) {
        roleRequests++;
      }
    });
    const scrollContainer = adminPage.locator(
      ".mantine-TableScrollContainer-scrollContainer",
    );
    await scrollContainer.evaluate((element) => {
      element.scrollLeft = element.scrollWidth;
    });
    await expect(roleList).toBeHidden();
    await expect(rowRole).toHaveAttribute("aria-expanded", "false");
    await adminPage.keyboard.press("ArrowDown");
    await adminPage.keyboard.press("Enter");
    await expect(rowRole).toHaveAttribute("aria-expanded", "false");
    await expect(rowRole).toHaveText("Scoped User");
    expect(roleRequests).toBe(0);

    await rowRole.click();
    await adminPage.keyboard.press("Shift+Tab");
    await adminPage.keyboard.press("Tab");
    await expect(rowRole).toBeFocused();
    await expect(rowRole).toHaveCSS("outline-style", "solid");
    await rowRole.press("ArrowDown");
    await rowRole.press("s");
    await expect.poll(() => activeRoleOption(rowRole)).toBe("Scoped Admin");
    await rowRole.press("Enter");
    await expect(rowRole).toHaveText("Scoped Admin");
    expect(roleRequests).toBe(1);
    await expect(
      adminPage.getByText("Role updated to Scoped Admin"),
    ).toBeVisible();
  } finally {
    await adminContext.close();
    updateUserStatuses(["e2e-admin-manage@example.com"], UserStatus.INACTIVE);
  }
});

test("a stalled create request preserves modal focus and recovers the form", async ({
  page,
}) => {
  const email = "e2e-create-timeout-admin@example.com";
  const password = "AdminPass123";
  const submittedEmail = `e2e-unconfirmed-${randomUUID()}@example.com`;
  seedLocalUser({
    email,
    name: "Create Timeout Admin",
    role: Role.PLATFORM_ADMIN,
    password,
    mustChangePassword: false,
  });

  try {
    await loginWithPassword(page, email, password);
    await expectOnDashboard(page);
    await page.goto(`${appBasePath}/users`);
    const launcher = page
      .getByRole("main")
      .getByRole("button", { name: "Create user" });
    await launcher.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Create local user" });
    const emailInput = dialog.getByRole("textbox", { name: "Email" });
    const nameInput = dialog.getByRole("textbox", { name: "Name" });
    const role = dialog.getByRole("combobox", { name: "Role" });
    const passwordInput = dialog.getByLabel("Temporary password");
    const submit = dialog.getByRole("button", { name: "Create user" });
    await expect(emailInput).toBeFocused();
    await expect(emailInput).toHaveCSS("outline-style", "solid");
    await emailInput.fill(submittedEmail);
    await nameInput.fill("Unconfirmed User");
    await passwordInput.fill("TempPass123");

    const path = `${appBasePath}/api/users`;
    const upstreamStatuses: number[] = [];
    // Let the server create the account, but withhold the response from the browser.
    await page.route(
      (url) => url.pathname === path,
      async (route) => {
        const upstream = await route.fetch();
        upstreamStatuses.push(upstream.status());
        await upstream.dispose();
      },
    );
    const requestPromise = page.waitForRequest(
      (request) =>
        new URL(request.url()).pathname === path && request.method() === "POST",
    );
    await submit.press("Enter");
    const request = await requestPromise;
    expect(request.postDataJSON().email).toBe(submittedEmail);

    await expect(emailInput).toBeFocused();
    await expect(emailInput).toHaveJSProperty("readOnly", true);
    await expect(nameInput).toHaveJSProperty("readOnly", true);
    await expect(passwordInput).toHaveJSProperty("readOnly", true);
    await expect(role).toHaveAttribute("aria-readonly", "true");
    await role.press("ArrowDown");
    await expect(role).toHaveAttribute("aria-expanded", "false");
    await emailInput.focus();
    await page.keyboard.type("ignored");
    await expect(emailInput).toHaveValue(submittedEmail);
    for (const key of ["Shift+Tab", "Tab", "Tab", "Tab", "Tab", "Tab"]) {
      await page.keyboard.press(key);
      await expect(dialog.locator(":focus")).toHaveCount(1);
    }

    await expect(dialog.getByRole("alert")).toHaveText(
      /Account creation could not be confirmed/,
      { timeout: 20_000 },
    );
    expect(upstreamStatuses).toEqual([201]);
    await expect(submit).toBeEnabled();
    await expect(role).not.toHaveAttribute("aria-readonly", "true");
    await emailInput.fill("e2e-corrected@example.com");
    await expect(nameInput).toHaveValue("Unconfirmed User");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(launcher).toBeFocused();
    await expect(
      page
        .getByRole("table", { name: "Users" })
        .getByRole("row")
        .filter({ hasText: submittedEmail }),
    ).toBeVisible();
  } finally {
    updateUserStatuses([email, submittedEmail], UserStatus.INACTIVE);
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
        "e2e-users-desktop@example.com",
        desktopAdminEmail,
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

test("Users row actions fit at 1280px with a long email", async ({ page }) => {
  const password = "DesktopTest123";
  try {
    seedLocalUser({
      email: desktopAdminEmail,
      name: "Desktop Admin",
      role: Role.PLATFORM_ADMIN,
      password,
      mustChangePassword: false,
    });
    await page.setViewportSize({ width: 1280, height: 900 });
    await loginWithPassword(page, desktopAdminEmail, password);
    await expectOnDashboard(page);
    await page.goto(`${appBasePath}/users`);

    const row = page.getByRole("row").filter({ hasText: desktopAdminEmail });
    // A reused database can place this fixture farther down the page.
    // Scroll only the document vertically so the table stays at its initial position.
    await row.evaluate((element) => {
      const top = element.getBoundingClientRect().top + window.scrollY;
      window.scrollTo(0, top - window.innerHeight / 2);
    });
    const action = row.getByRole("button", { name: "Deactivate" });
    await expect(action).toBeVisible();
    await expect(action).toBeInViewport({ ratio: 1 });
  } finally {
    updateUserStatuses([desktopAdminEmail], UserStatus.INACTIVE);
  }
});
