import { expect, test } from "@playwright/test";
import {
  appBasePath,
  expectOnDashboard,
  loginWithPassword,
} from "../helpers/auth";
import { seedLocalUser } from "../helpers/db";
import { Role } from "../../../generated/prisma/enums";

test("platform admin can view recent background jobs", async ({ page }) => {
  await loginWithPassword(page, "admin@example.com", "ChangeMe123!");

  await expect(page).toHaveURL(new RegExp(`${appBasePath}/change-password$`));
  await page.getByLabel("Current password").fill("ChangeMe123!");
  await page.getByLabel("New password").fill("AdminPass123");
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes("/api/auth/change-password") &&
        response.request().method() === "POST" &&
        response.status() === 200,
    ),
    page.getByRole("button", { name: "Save new password" }).click(),
  ]);

  await expectOnDashboard(page);

  await page.goto(`${appBasePath}/background-jobs`);
  await expect(
    page.getByText("No background jobs have been queued yet."),
  ).toBeVisible();

  const createJob = async (jobType: string, payload: unknown) => {
    const response = await page
      .context()
      .request.post(`${appBasePath}/api/background-jobs`, {
        data: {
          jobType,
          payload,
        },
      });

    expect(response.status()).toBe(201);
  };

  await createJob("echo", { message: "hello queue" });
  await createJob("noop", {});

  await page.goto(`${appBasePath}/background-jobs`);

  await expect(
    page.getByRole("heading", { name: "Background Jobs" }),
  ).toBeVisible();
  await expect(
    page.getByText("Recent worker jobs across the application."),
  ).toBeVisible();
  await expect(page.getByText("Showing the latest 2 jobs")).toBeVisible();
  await expect(page.getByText("echo")).toBeVisible();
  await expect(page.getByText("noop")).toBeVisible();
  await expect(page.getByText("Pending", { exact: true })).toBeVisible();
  await expect(page.getByText("hello queue")).toBeVisible();
  await expect(page.getByText("Not assigned")).toHaveCount(2);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByText("echo")).toBeVisible();
  await expect(page.getByText("PENDING", { exact: true })).toHaveCount(2);
});

test("scoped users cannot open the background jobs dashboard", async ({
  page,
}) => {
  const email = "e2e-scoped-jobs@example.com";
  const password = "ScopedJobs123";
  await seedLocalUser({
    email,
    name: "Scoped Jobs User",
    role: Role.SCOPE_USER,
    password,
    mustChangePassword: false,
  });
  await loginWithPassword(page, email, password);
  await expectOnDashboard(page);
  await page.goto(`${appBasePath}/background-jobs`);
  await expectOnDashboard(page);
});
