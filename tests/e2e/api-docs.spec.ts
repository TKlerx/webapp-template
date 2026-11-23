import { expect, test } from "@playwright/test";
import { Role } from "../../generated/prisma/enums";
import {
  appBasePath,
  expectOnDashboard,
  loginWithPassword,
} from "./helpers/auth";
import { seedLocalUser } from "./helpers/db";

test("authenticated users can open the API docs page and see Swagger content", async ({
  page,
}) => {
  await seedLocalUser({
    email: "e2e-docs@example.com",
    name: "E2E Docs",
    role: Role.SCOPE_USER,
    password: "DocsPass123",
    mustChangePassword: false,
  });

  await loginWithPassword(page, "e2e-docs@example.com", "DocsPass123");
  await expectOnDashboard(page);

  await page.route(
    "**/vendor/swagger-ui/swagger-ui-bundle.js",
    (route) => route.abort(),
    { times: 1 },
  );
  await page.goto(`${appBasePath}/docs/api`);
  await expect(
    page.getByRole("heading", { name: "API reference" }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Could not load the API reference" }),
  ).toContainText("Could not load the API reference");
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.locator("#swagger-ui")).toContainText("/api/tokens", {
    timeout: 30000,
  });
  await expect(page.locator("#swagger-ui")).toContainText(
    "/api/cli-auth/authorize",
    { timeout: 30000 },
  );
});
