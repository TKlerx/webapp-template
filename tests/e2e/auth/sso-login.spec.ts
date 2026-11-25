import { expect, test } from "@playwright/test";
import { appBasePath, loginWithSso } from "../helpers/auth";
import { findUserByEmail } from "../helpers/db";

test("Azure sign-in has one keyboard stop and preserves the return destination", async ({
  page,
}) => {
  const destination = "/settings/tokens";
  await page.goto(
    `${appBasePath}/login?redirectTo=${encodeURIComponent(destination)}`,
  );
  const azure = page.getByRole("link", { name: "Sign in with Azure" });
  const href = `${appBasePath}/api/auth/sso/azure?redirectTo=${encodeURIComponent(destination)}`;
  await expect(azure).toHaveAttribute("href", href);
  await expect(azure.getByRole("button")).toHaveCount(0);
  await azure.focus();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Email")).toBeFocused();
  await page.route(`**${appBasePath}/api/auth/sso/azure?*`, (route) =>
    route.fulfill({ body: "Azure redirect requested" }),
  );
  await azure.press("Enter");
  await expect(page).toHaveURL((url) => url.pathname + url.search === href);
});

test("first-time SSO user lands on pending approval page", async ({ page }) => {
  const email = `e2e-sso-${Date.now().toString(36)}@example.com`;

  await loginWithSso(page, {
    email,
    name: "E2E First Time SSO",
  });

  await expect(page).toHaveURL(new RegExp(`${appBasePath}/pending$`), {
    timeout: 15000,
  });
  await expect(
    page.getByRole("heading", {
      name: /your account is pending administrator approval/i,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL(new RegExp(`${appBasePath}/login$`));

  const user = await findUserByEmail(email);
  expect(user?.status).toBe("PENDING_APPROVAL");
  expect(user?.authMethod).toBe("SSO");
});
