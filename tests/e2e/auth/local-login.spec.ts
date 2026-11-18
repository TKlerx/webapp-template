import { test, expect } from "@playwright/test";
import { Role } from "../../../generated/prisma/enums";
import {
  loginWithPassword,
  appBasePath,
  expectOnDashboard,
  openUserMenu,
} from "../helpers/auth";
import { seedLocalUser } from "../helpers/db";

test("local user is forced to change password on first login", async ({
  page,
}) => {
  await seedLocalUser({
    email: "e2e-temp-user@example.com",
    name: "E2E Temp User",
    role: Role.SCOPE_USER,
    password: "TempPass123",
    mustChangePassword: true,
  });

  await loginWithPassword(page, "e2e-temp-user@example.com", "TempPass123");

  await expect(page).toHaveURL(new RegExp(`${appBasePath}/change-password$`));
  await page.getByLabel("Current password").fill("TempPass123");
  await page.getByLabel("New password").fill("FreshPass123");
  await page.getByRole("button", { name: "Save new password" }).click();

  await expectOnDashboard(page);
});

test("a local user can change their password from the account menu", async ({
  page,
}) => {
  const email = "e2e-voluntary-password@example.com";
  await seedLocalUser({
    email,
    name: "E2E Local User",
    role: Role.SCOPE_USER,
    password: "CurrentPass123",
    mustChangePassword: false,
  });

  await loginWithPassword(page, email, "CurrentPass123");
  await expectOnDashboard(page);
  await openUserMenu(page);
  await page.getByRole("menuitem", { name: "Change your password" }).click();
  await expect(page).toHaveURL(new RegExp(`${appBasePath}/change-password$`));
  await expect(page.getByText("First login", { exact: true })).toHaveCount(0);
  await page.getByLabel("Current password").fill("IncorrectPass123");
  await page.getByLabel("New password").fill("ChangedPass123");
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(page.getByText("Current password is incorrect")).toBeVisible();
  await page.getByLabel("Current password").fill("CurrentPass123");
  await page.getByRole("button", { name: "Save new password" }).click();
  await expectOnDashboard(page);
  await page.context().clearCookies();
  await loginWithPassword(page, email, "ChangedPass123");
  await expectOnDashboard(page);
});
