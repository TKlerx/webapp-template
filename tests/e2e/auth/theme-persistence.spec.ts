import { test, expect } from "@playwright/test";
import { Role } from "../../../generated/prisma/enums";
import {
  expectOnDashboard,
  loginWithPassword,
  openUserMenu,
} from "../helpers/auth";
import { seedLocalUser } from "../helpers/db";

test("theme toggle persists across sessions", async ({ page }) => {
  await seedLocalUser({
    email: "e2e-theme-user@example.com",
    name: "E2E Theme User",
    role: Role.SCOPE_USER,
    password: "ThemePass123",
    mustChangePassword: false,
  });

  await loginWithPassword(page, "e2e-theme-user@example.com", "ThemePass123");
  await expectOnDashboard(page);

  await openUserMenu(page);
  const darkMode = page.getByRole("button", { name: "Dark mode" });
  await expect(darkMode).toHaveCSS("border-top-width", "1px");
  await expect(darkMode).toHaveCSS("border-top-left-radius", "36px");
  await expect(page.getByRole("button", { name: "Sign out" })).toHaveCSS(
    "border-top-left-radius",
    "6px",
  );
  await darkMode.press("Enter");
  await expect(page.getByRole("button", { name: "Light mode" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Open user menu" }).click();
  await expect(page.getByRole("button", { name: "Light mode" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  await page.getByRole("button", { name: "Sign out" }).click();
  await loginWithPassword(page, "e2e-theme-user@example.com", "ThemePass123");
  await expectOnDashboard(page);

  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await openUserMenu(page);
  await expect(page.getByRole("button", { name: "Light mode" })).toBeVisible();
  await expect(page.getByText("DARK", { exact: true })).toBeVisible();
});
