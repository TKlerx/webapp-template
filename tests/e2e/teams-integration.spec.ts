import { expect, test } from "@playwright/test";
import { Role } from "../../generated/prisma/enums";
import {
  appBasePath,
  expectOnDashboard,
  loginWithPassword,
} from "./helpers/auth";
import { seedLocalUser, updateUserStatus, UserStatus } from "./helpers/db";

test("Teams configuration and channel lists work without a live provider", async ({
  page,
}) => {
  const email = "e2e-teams-admin@example.com";
  const password = "TeamsAdmin123";
  const api = "**/api/integrations/teams";
  await seedLocalUser({
    email,
    name: "Teams Admin",
    role: Role.PLATFORM_ADMIN,
    password,
    mustChangePassword: false,
  });
  try {
    await loginWithPassword(page, email, password);
    await expectOnDashboard(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${appBasePath}/admin/integrations/teams`);
    await expect(
      page.getByText(/Not connected. Outbound channel sends/),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Connect Teams consent" }),
    ).toHaveAttribute(
      "href",
      `${appBasePath}/api/integrations/teams/consent/start?redirectTo=/admin/integrations/teams`,
    );
    const outbound = page.getByRole("checkbox", {
      name: "Enable outbound Teams delivery",
    });
    await expect(outbound).not.toBeChecked();
    await page.route(api, (route) => route.abort(), { times: 1 });
    await outbound.press("Space");
    await expect(page.getByText("Could not save settings")).toBeVisible();
    await expect(outbound).not.toBeChecked();
    await outbound.click();
    await expect(outbound).toBeChecked();
    await outbound.click();
    await expect(outbound).not.toBeChecked();

    const targets = page.getByRole("region", { name: "Delivery targets" });
    await expect(
      targets.getByText("No outbound targets configured."),
    ).toBeVisible();
    for (const name of ["Alerts", "Operations"]) {
      await targets.getByRole("textbox", { name: "Target name" }).fill(name);
      await targets
        .getByRole("textbox", { name: "Team ID" })
        .fill("fixture-team");
      await targets
        .getByRole("textbox", { name: "Channel ID" })
        .fill(`fixture-${name}`);
      await targets.getByRole("button", { name: "Add target" }).click();
      await expect(targets.getByText(name, { exact: true })).toBeVisible();
    }

    const targetCard = (name: string) => targets.getByRole("article", { name });
    const activeTarget = (name: string) =>
      targetCard(name).getByRole("checkbox");
    const alerts = activeTarget("Alerts");
    const operations = activeTarget("Operations");
    const release: Array<() => void> = [];
    const targetPattern = `${api}/targets/*`;
    await page.route(targetPattern, async (route) => {
      await new Promise<void>((resolve) => release.push(resolve));
      await route.continue();
    });
    try {
      await alerts.click();
      await expect(alerts).toBeDisabled();
      await expect(operations).toBeEnabled();
      await operations.click();
      await expect.poll(() => release.length).toBe(2);
      release[1]();
      await expect(operations).not.toBeChecked();
      await expect(alerts).toBeDisabled();
      release[0]();
      await expect(alerts).not.toBeChecked();
      await expect(operations).not.toBeChecked();
    } finally {
      release.forEach((resolve) => resolve());
      await page.unroute(targetPattern);
    }
    for (const name of ["Alerts", "Operations"]) {
      await targetCard(name).getByRole("button", { name: "Delete" }).click();
      await expect(targets.getByText(name, { exact: true })).toHaveCount(0);
    }

    const subscriptions = page.getByRole("region", {
      name: "Intake subscriptions",
    });
    await expect(
      subscriptions.getByText("No inbound subscriptions configured."),
    ).toBeVisible();
    await subscriptions
      .getByRole("textbox", { name: "Team ID" })
      .fill("fixture-team");
    await subscriptions
      .getByRole("textbox", { name: "Channel ID" })
      .fill("fixture-inbound");
    const add = subscriptions.getByRole("button", { name: "Add subscription" });
    await page.route(`${api}/subscriptions`, (route) => route.abort(), {
      times: 1,
    });
    await add.click();
    await expect(page.getByText("Could not create subscription")).toBeVisible();
    await add.click();
    await expect(
      subscriptions.getByText("fixture-team / fixture-inbound"),
    ).toBeVisible();
    await subscriptions.getByRole("checkbox").click();
    await expect(subscriptions.getByRole("checkbox")).not.toBeChecked();
    await subscriptions.getByRole("button", { name: "Delete" }).click();
    await expect(
      subscriptions.getByText("No inbound subscriptions configured."),
    ).toBeVisible();
  } finally {
    updateUserStatus(email, UserStatus.INACTIVE);
  }
});

test("scoped users cannot manage Teams", async ({ page }) => {
  const email = "e2e-teams-scoped@example.com";
  const password = "TeamsScope123";
  await seedLocalUser({
    email,
    name: "Teams Scoped User",
    role: Role.SCOPE_USER,
    password,
    mustChangePassword: false,
  });
  await loginWithPassword(page, email, password);
  await expectOnDashboard(page);
  await page.goto(`${appBasePath}/admin/integrations/teams`);
  await expectOnDashboard(page);
  const response = await page.request.get(
    `${appBasePath}/api/integrations/teams`,
  );
  expect(response.status()).toBe(403);
});
