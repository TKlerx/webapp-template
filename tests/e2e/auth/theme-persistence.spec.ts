import { test, expect } from "@playwright/test";
import { Role } from "../../../generated/prisma/enums";
import {
  expectOnDashboard,
  loginWithPassword,
  openUserMenu,
} from "../helpers/auth";
import { seedLocalUser } from "../helpers/db";

test("theme toggle persists across sessions", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await seedLocalUser({
    email: "e2e-theme-user@example.com",
    name: "E2E Theme User",
    role: Role.SCOPE_USER,
    password: "ThemePass123",
    mustChangePassword: false,
  });

  await loginWithPassword(page, "e2e-theme-user@example.com", "ThemePass123");
  await expectOnDashboard(page);

  const dashboardResponse = await page.request.get(page.url());
  await expect(dashboardResponse).toBeOK();
  const openingHtml = (await dashboardResponse.text()).match(
    /<html\b[^>]*>/,
  )?.[0];
  expect(openingHtml).toContain('data-theme="light"');
  expect(openingHtml).toContain('data-mantine-color-scheme="light"');

  const html = page.locator("html");
  const versionBadge = page.locator('[class~="dark:border-white/10"]');
  await expect(html).toHaveAttribute("data-mantine-color-scheme", "light");
  await expect(html).toHaveCSS("color-scheme", "light");
  const lightBorder = await versionBadge.evaluate(
    (badge) => getComputedStyle(badge).borderTopColor,
  );
  await page.emulateMedia({ colorScheme: "light" });
  await expect(versionBadge).toHaveCSS("border-top-color", lightBorder);
  await expect(page.locator("body")).toHaveCSS("line-height", "24px");
  await openUserMenu(page);
  const darkMode = page.getByRole("button", { name: "Dark mode" });
  await expect(darkMode).toHaveCSS("border-top-width", "1px");
  await expect(page.getByRole("button", { name: "Sign out" })).toHaveCSS(
    "border-top-left-radius",
    "6px",
  );
  await darkMode.press("Enter");
  await expect(page.getByRole("button", { name: "Light mode" })).toBeVisible();
  await expect(html).toHaveAttribute("data-theme", "dark");
  await expect(html).toHaveAttribute("data-mantine-color-scheme", "dark");
  await expect(html).toHaveCSS("color-scheme", "dark");
  await expect(versionBadge).not.toHaveCSS("border-top-color", lightBorder);
  const darkBorder = await versionBadge.evaluate(
    (badge) => getComputedStyle(badge).borderTopColor,
  );
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(versionBadge).toHaveCSS("border-top-color", darkBorder);
  await page.emulateMedia({ colorScheme: "light" });
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Open user menu" }).click();
  await expect(page.getByRole("button", { name: "Light mode" })).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await loginWithPassword(page, "e2e-theme-user@example.com", "ThemePass123");
  await expectOnDashboard(page);

  await expect(html).toHaveAttribute("data-theme", "dark");
  await expect(html).toHaveAttribute("data-mantine-color-scheme", "dark");
  await expect(html).toHaveCSS("color-scheme", "dark");
  await expect(versionBadge).toHaveCSS("border-top-color", darkBorder);
  const darkResponse = await page.request.get(page.url());
  await expect(darkResponse).toBeOK();
  const darkHtml = (await darkResponse.text()).match(/<html\b[^>]*>/)?.[0];
  expect(darkHtml).toContain('data-theme="dark"');
  expect(darkHtml).toContain('data-mantine-color-scheme="dark"');
  await openUserMenu(page);
  await expect(page.getByRole("button", { name: "Light mode" })).toBeVisible();
  await expect(page.getByText("DARK", { exact: true })).toBeVisible();
});
