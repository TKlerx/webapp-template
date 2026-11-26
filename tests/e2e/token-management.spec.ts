import { expect, test } from "@playwright/test";
import { Role } from "../../generated/prisma/enums";
import {
  appBasePath,
  expectOnDashboard,
  loginWithPassword,
  openUserMenu,
} from "./helpers/auth";
import { seedLocalUser } from "./helpers/db";

test("user can create, revoke, renew, and delete personal access tokens", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);

  await seedLocalUser({
    email: "e2e-tokens@example.com",
    name: "E2E Tokens",
    role: Role.SCOPE_USER,
    password: "TokenPass123",
    mustChangePassword: false,
  });

  await loginWithPassword(page, "e2e-tokens@example.com", "TokenPass123");
  await expectOnDashboard(page);

  await page.goto(`${appBasePath}/settings/tokens`);
  const createButton = page
    .getByRole("button", { name: "Create token", exact: true })
    .first();
  await createButton.click();
  await page.getByLabel("Token name").fill("Automation Token");
  await page.getByRole("combobox", { name: "Expiration" }).selectOption("30");
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes("/api/tokens") &&
        response.request().method() === "POST" &&
        response.status() === 201,
    ),
    page.getByRole("button", { name: "Create token" }).last().click(),
  ]);

  const tokenDialog = page.getByRole("dialog", {
    name: "Save Automation Token",
  });
  await expect(page.getByRole("dialog", { name: "Create token" })).toHaveCount(
    0,
  );
  await expect(tokenDialog).toContainText("This token will not be shown again");
  const tokenValue = await tokenDialog.locator("div.font-mono").innerText();
  await tokenDialog.getByRole("button", { name: "Copy token" }).click();
  await expect
    .poll(async () => page.evaluate(() => navigator.clipboard.readText()))
    .toBe(tokenValue);
  await tokenDialog.getByRole("button", { name: "Done" }).click();
  await expect(createButton).toBeFocused();

  const tokenRow = page.locator("tr", { hasText: "Automation Token" });
  await expect(tokenRow).toBeVisible();
  await expect(page.locator("body")).not.toContainText(tokenValue);

  const revoke = tokenRow.getByRole("button", { name: "Revoke" });
  await revoke.click();
  const confirmation = page.getByRole("dialog", { name: "Revoke" });
  await expect(
    confirmation.getByRole("button", { name: "Cancel", exact: true }),
  ).toBeFocused();
  await confirmation
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await expect(revoke).toBeFocused();
  await revoke.click();
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes("/api/tokens/") &&
        response.url().includes("/revoke") &&
        response.request().method() === "POST" &&
        response.status() === 200,
    ),
    confirmation.getByRole("button", { name: "Revoke", exact: true }).click(),
  ]);
  await expect(tokenRow).toContainText("Revoked");

  await page.getByRole("button", { name: "Create token" }).first().click();
  await page.getByLabel("Token name").fill("Renewable Token");
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes("/api/tokens") &&
        response.request().method() === "POST" &&
        response.status() === 201,
    ),
    page.getByRole("button", { name: "Create token" }).last().click(),
  ]);
  await page.getByRole("dialog").getByRole("button", { name: "Done" }).click();

  const renewableRow = page.locator("tr", { hasText: "Renewable Token" });
  await renewableRow.getByRole("button", { name: "Renew" }).click();
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes("/api/tokens/") &&
        response.url().includes("/renew") &&
        response.request().method() === "POST" &&
        response.status() === 200,
    ),
    page
      .getByRole("dialog", { name: "Renew" })
      .getByRole("button", { name: "Renew", exact: true })
      .click(),
  ]);
  await expect(
    page.getByRole("dialog", { name: "Save Renewable Token" }),
  ).toContainText("This token will not be shown again");
  await page.getByRole("dialog").getByRole("button", { name: "Done" }).click();

  await renewableRow.getByRole("button", { name: "Delete" }).click();
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes("/api/tokens/") &&
        response.request().method() === "DELETE" &&
        response.status() === 204,
    ),
    page
      .getByRole("dialog", { name: "Delete" })
      .getByRole("button", { name: "Delete", exact: true })
      .click(),
  ]);
  await expect(renewableRow).toHaveCount(0);
  await page.goto(`${appBasePath}/admin/tokens`);
  await expectOnDashboard(page);
});

test("token pages stay usable on mobile and in dark mode", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });

  await seedLocalUser({
    email: "e2e-tokens-mobile@example.com",
    name: "E2E Tokens Mobile",
    role: Role.PLATFORM_ADMIN,
    password: "TokenPass123",
    mustChangePassword: false,
  });

  await loginWithPassword(
    page,
    "e2e-tokens-mobile@example.com",
    "TokenPass123",
  );
  await expectOnDashboard(page);

  await openUserMenu(page);
  await page.getByRole("button", { name: "Dark mode" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  await page.goto(`${appBasePath}/settings/tokens`);
  await expect(
    page.getByRole("button", { name: "Create token" }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Create token" }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.locator("article")).toHaveCount(0);

  await page.context().addCookies([
    {
      name: "starter_app_locale",
      value: "de",
      domain: "localhost",
      path: "/",
    },
  ]);
  await page.route("**/api/downloads/cli", (route) =>
    route.fulfill({
      json: { assets: [], checksumsAvailable: true },
    }),
  );
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "CLI-Downloads" }),
  ).toBeVisible();
  await expect(
    page.getByText("starterctl health", { exact: false }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Prüfsummen" })).toHaveAttribute(
    "href",
    `${appBasePath}/api/downloads/cli/checksums`,
  );
  await page.context().clearCookies({ name: "starter_app_locale" });

  await page.goto(`${appBasePath}/admin/tokens`);
  await expect(page).toHaveURL(new RegExp(`${appBasePath}/admin/tokens$`));
  await expect(
    page.getByRole("combobox", { name: "Filter by user" }),
  ).toBeVisible();
});
