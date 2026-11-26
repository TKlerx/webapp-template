import { expect, test } from "@playwright/test";
import {
  NotificationEventType,
  NotificationStatus,
  Role,
} from "../../../generated/prisma/enums";
import {
  appBasePath,
  expectOnDashboard,
  loginWithPassword,
} from "../helpers/auth";
import {
  seedLocalUser,
  seedNotificationFixture,
  seedNotificationTypeConfiguration,
} from "../helpers/db";

test("platform admin can manage notification settings and filter the notification log", async ({
  page,
}) => {
  await seedLocalUser({
    email: "e2e-notifications-admin@example.com",
    name: "E2E Notifications Admin",
    role: Role.PLATFORM_ADMIN,
    password: "AdminPass123",
    mustChangePassword: false,
  });

  await seedLocalUser({
    email: "e2e-notifications-user@example.com",
    name: "E2E Notifications User",
    role: Role.SCOPE_USER,
    password: "UserPass123",
    mustChangePassword: false,
  });

  await seedNotificationTypeConfiguration({
    eventType: NotificationEventType.ROLE_CHANGED,
    enabled: true,
    updatedByEmail: "e2e-notifications-admin@example.com",
  });

  await seedNotificationFixture({
    eventType: NotificationEventType.ROLE_CHANGED,
    actorEmail: "e2e-notifications-admin@example.com",
    affectedUserEmail: "e2e-notifications-user@example.com",
    recipientEmail: "e2e-notifications-user@example.com",
    recipientUserEmail: "e2e-notifications-user@example.com",
    locale: "en",
    subject: "Role changed for your account",
    status: NotificationStatus.SENT,
    sentAt: "2026-04-20T09:00:00.000Z",
  });

  await seedNotificationFixture({
    eventType: NotificationEventType.USER_STATUS_CHANGED,
    actorEmail: "e2e-notifications-admin@example.com",
    affectedUserEmail: "e2e-notifications-user@example.com",
    recipientEmail: "ops@example.com",
    locale: "en",
    subject: "User status update pending retry",
    status: NotificationStatus.RETRYING,
    retryCount: 2,
    lastError: "Mailbox busy",
  });

  await loginWithPassword(
    page,
    "e2e-notifications-admin@example.com",
    "AdminPass123",
  );
  await expectOnDashboard(page);

  await page.goto(`${appBasePath}/admin/notifications`);

  await expect(
    page.getByRole("heading", { name: "Notifications" }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Manage notification event switches and inspect recent outbound delivery attempts.",
    ),
  ).toBeVisible();
  await expect(page.getByText("Role changed for your account")).toBeVisible();
  await expect(
    page.getByText("User status update pending retry"),
  ).toBeVisible();
  await expect(page.getByText("Mailbox busy")).toBeVisible();
  await expect(
    page.locator("article").filter({ hasText: "Queued" }).first(),
  ).toContainText("1");
  await expect(
    page.locator("article").filter({ hasText: "Sent" }).first(),
  ).toContainText("1");
  await expect(
    page.locator("article").filter({ hasText: "Failed" }).first(),
  ).toContainText("0");

  const roleChangedToggle = page.getByRole("checkbox", {
    name: "Role changed",
  });
  await expect(roleChangedToggle).toBeChecked();

  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes("/api/notifications/settings/ROLE_CHANGED") &&
        response.request().method() === "PATCH" &&
        response.status() === 200,
    ),
    roleChangedToggle.click(),
  ]);

  await expect(roleChangedToggle).not.toBeChecked();
  await expect(page.getByText("Notification type disabled")).toBeVisible();

  const eventFilter = page.getByRole("combobox", { name: "Filter by event" });
  const statusFilter = page.getByRole("combobox", { name: "Filter by status" });
  await page.setViewportSize({ width: 320, height: 720 });
  const logRegion = page.getByRole("region", { name: "Notification log" });
  const hasInternalScroll = await logRegion.evaluate(
    (region) =>
      region.scrollWidth > region.clientWidth &&
      document.documentElement.scrollWidth === window.innerWidth,
  );
  expect(hasInternalScroll).toBe(true);
  await page.setViewportSize({ width: 1024, height: 768 });

  await eventFilter.selectOption("ROLE_CHANGED");
  await expect(page.getByText("Role changed for your account")).toBeVisible();
  await expect(page.getByText("User status update pending retry")).toHaveCount(
    0,
  );

  const combined = "**/api/notifications?eventType=ROLE_CHANGED&status=SENT";
  await page.route(combined, (route) => route.abort(), { times: 1 });
  await statusFilter.selectOption("SENT");
  await expect(
    page.getByRole("alert").filter({ hasText: "Could not load notifications" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Retry", exact: true }).press("Enter");
  await expect(page.getByText("Role changed for your account")).toBeVisible();
  await expect(page.getByText("Mailbox busy")).toHaveCount(0);
  await expect(eventFilter).toHaveValue("ROLE_CHANGED");
  await expect(statusFilter).toHaveValue("SENT");

  // Deliver the older filter response last to protect against stale fetch results.
  let releaseStaleResponse!: () => void;
  const staleResponseGate = new Promise<void>((resolve) => {
    releaseStaleResponse = resolve;
  });
  await page.route("**/api/notifications?status=SENT", async (route) => {
    const response = await route.fetch();
    await staleResponseGate;
    await route.fulfill({ response });
  });
  const staleResponse = page.waitForResponse((response) =>
    response.url().endsWith("/api/notifications?status=SENT"),
  );
  await eventFilter.selectOption("all");
  await statusFilter.selectOption("RETRYING");
  try {
    await expect(
      page.getByText("User status update pending retry"),
    ).toBeVisible();
  } finally {
    releaseStaleResponse();
  }
  await (await staleResponse).finished();
  await page.waitForLoadState("networkidle");
  await expect(
    page.getByText("User status update pending retry"),
  ).toBeVisible();
  await expect(page.getByText("Role changed for your account")).toHaveCount(0);
  await eventFilter.selectOption("ROLE_CHANGED");
  await expect(
    page.getByText("No notifications match the selected filters."),
  ).toBeVisible();
  await page.context().addCookies([
    {
      name: "starter_app_locale",
      value: "de",
      domain: "localhost",
      path: "/",
    },
  ]);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "de");
  await expect(page.getByRole("combobox")).toHaveCount(2);
  await expect(page.getByRole("combobox").first()).toHaveAccessibleName(/.+/);
});

test("notification settings save independently and recover from a rejected request", async ({
  page,
}) => {
  const email = "e2e-notifications-admin@example.com";
  const password = "AdminPass123";
  await seedLocalUser({
    email,
    name: "E2E Notification Settings",
    role: Role.PLATFORM_ADMIN,
    password,
    mustChangePassword: false,
  });
  const eventTypes = [
    NotificationEventType.ROLE_CHANGED,
    NotificationEventType.USER_STATUS_CHANGED,
  ];
  for (const eventType of eventTypes) {
    await seedNotificationTypeConfiguration({
      eventType,
      enabled: true,
      updatedByEmail: email,
    });
  }
  await loginWithPassword(page, email, password);
  await expectOnDashboard(page);
  await page.goto(`${appBasePath}/admin/notifications`);

  const [first, second] = eventTypes.map((eventType) =>
    page
      .locator("article")
      .filter({ has: page.getByText(eventType, { exact: true }) })
      .getByRole("checkbox"),
  );
  const pending = new Map<string, () => void>();
  const patchPattern = "**/api/notifications/settings/*";
  const requests: string[] = [];
  await page.route(patchPattern, async (route) => {
    const eventType = new URL(route.request().url()).pathname.split("/").pop()!;
    requests.push(eventType);
    await new Promise<void>((release) => pending.set(eventType, release));
    await route.continue();
  });
  try {
    await first.press("Space");
    await expect(first).toBeDisabled();
    await first.press("Space");
    await expect(second).toBeEnabled();
    await second.click();
    await expect(second).toBeDisabled();
    await expect.poll(() => [...pending.keys()]).toEqual(eventTypes);
    pending.get(eventTypes[1])?.();
    await expect(second).toBeEnabled();
    await expect(second).not.toBeChecked();
    await expect(first).toBeDisabled();
    pending.get(eventTypes[0])?.();
    await expect(first).toBeEnabled();
    await expect(first).not.toBeChecked();
    expect(requests).toEqual(eventTypes);
  } finally {
    for (const release of pending.values()) release();
    await page.unroute(patchPattern);
  }

  await page.route(patchPattern, (route) => route.abort("failed"), {
    times: 1,
  });
  await first.click();
  await expect(
    page.getByText("Could not save notification setting"),
  ).toBeVisible();
  await expect(first).toBeEnabled();
  await expect(first).not.toBeChecked();
  await first.click();
  await expect(first).toBeChecked();
});

test("scoped users cannot open notification administration", async ({
  page,
}) => {
  const email = "e2e-notifications-scope@example.com";
  await seedLocalUser({
    email,
    name: "E2E Notification Scope",
    role: Role.SCOPE_USER,
    password: "UserPass123",
    mustChangePassword: false,
  });
  await loginWithPassword(page, email, "UserPass123");
  await expectOnDashboard(page);
  await page.goto(`${appBasePath}/admin/notifications`);
  await expectOnDashboard(page);
  const response = await page.request.patch(
    `${appBasePath}/api/notifications/settings/ROLE_CHANGED`,
    { data: { enabled: false } },
  );
  expect(response.status()).toBe(403);
});
