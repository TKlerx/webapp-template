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
  await expect(page.getByLabel("Current password")).toHaveAttribute(
    "autocomplete",
    "current-password",
  );
  await expect(page.getByLabel("New password")).toHaveAttribute(
    "autocomplete",
    "new-password",
  );
  await page.getByLabel("New password").press("Enter");

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
  const error = page
    .getByRole("alert")
    .filter({ hasText: "Current password is incorrect" });
  await expect(error).toBeFocused();
  await page.getByLabel("Current password").fill("CurrentPass123");
  await page.getByRole("button", { name: "Save new password" }).click();
  await expectOnDashboard(page);
  await page.context().clearCookies();
  await loginWithPassword(page, email, "ChangedPass123");
  await expectOnDashboard(page);
});

test("local sign-in keeps keyboard submission and focuses failed-login feedback", async ({
  page,
}) => {
  await page.goto(`${appBasePath}/login`);
  const password = page.getByLabel("Password", { exact: true });
  await expect(password).toHaveAttribute("autocomplete", "current-password");
  await page.getByLabel("Email").fill("missing-account@example.com");
  await password.fill("IncorrectPass123");
  await password.press("Enter");
  await expect(
    page.getByRole("alert").filter({ hasText: "Invalid email or password" }),
  ).toBeFocused();
});

test("restores the saved account language in a fresh browser", async ({
  page,
  browser,
}) => {
  const email = "e2e-account-locale@example.com";
  const password = "LocalePass123";
  await seedLocalUser({
    email,
    name: "E2E Locale User",
    role: Role.SCOPE_USER,
    password,
    mustChangePassword: false,
  });
  await loginWithPassword(page, email, password);
  await expect(page).toHaveURL(new RegExp(`${appBasePath}/dashboard$`));
  const saved = await page.request.post(`${appBasePath}/api/locale`, {
    data: { locale: "de" },
  });
  expect(saved.ok()).toBe(true);

  const fresh = await browser.newContext({ baseURL: page.url() });
  try {
    const newPage = await fresh.newPage();
    await loginWithPassword(newPage, email, password);
    expect(
      (await fresh.cookies()).some(({ name }) => name === "starter_app_locale"),
    ).toBe(false);
    await expect(newPage.locator("html")).toHaveAttribute("lang", "de");
  } finally {
    await fresh.close();
  }
});
