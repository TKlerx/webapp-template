import { randomUUID } from "node:crypto";
import { test, expect, type Page } from "@playwright/test";
import { Role } from "../../generated/prisma/enums";
import {
  appBasePath,
  loginWithPassword,
  expectOnDashboard,
} from "./helpers/auth";
import { seedLocalUser } from "./helpers/db";

const endpoint = `${appBasePath}/api/assistant/conversations`;
const selector = (page: Page) =>
  page.getByRole("combobox", { name: "Saved conversations" });
async function open(page: Page) {
  await page
    .getByRole("button", { name: "Open assistant", exact: true })
    .click();
  await expect(selector(page)).toBeEnabled();
}
async function send(page: Page, text: string) {
  await page.getByRole("textbox", { name: "Message", exact: true }).fill(text);
  await page.getByRole("button", { name: "Send message", exact: true }).click();
}
const saved = (page: Page, status = 200) =>
  page.waitForResponse(
    (response) =>
      response.url().endsWith(endpoint) &&
      response.request().method() === "PATCH" &&
      response.status() === status,
  );

test.beforeEach(async ({ page, context }) => {
  const email = `history-${randomUUID()}@example.com`;
  await seedLocalUser({
    email,
    name: "History Test",
    role: Role.SCOPE_USER,
    password: "TestPass123!",
    mustChangePassword: false,
  });
  await context.route("**/api/assistant/chat", async (route) => {
    const events = [
      { type: "start", messageId: randomUUID() },
      { type: "text-start", id: "reply" },
      { type: "text-delta", id: "reply", delta: "Saved assistant reply" },
      { type: "text-end", id: "reply" },
      { type: "finish" },
    ];
    await route.fulfill({
      contentType: "text/event-stream",
      headers: { "x-vercel-ai-ui-message-stream": "v1" },
      body:
        events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("") +
        "data: [DONE]\n\n",
    });
  });
  await loginWithPassword(page, email, "TestPass123!");
  await expectOnDashboard(page);
  await open(page);
});

test("autosaves, survives refresh, reopens a conversation and deletes it permanently", async ({
  page,
}) => {
  const first = await selector(page).inputValue();
  const firstSave = saved(page);
  await send(page, "First conversation");
  await firstSave;
  await page.reload();
  await open(page);
  await expect(
    page
      .getByRole("log", { name: "Assistant conversation" })
      .getByText("First conversation", { exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("log", { name: "Assistant conversation" })
      .getByText("Saved assistant reply", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "New conversation", exact: true })
    .click();
  await expect(selector(page)).not.toHaveValue(first);
  const second = await selector(page).inputValue();
  const secondSave = saved(page);
  await send(page, "Second conversation");
  await secondSave;
  await selector(page).selectOption(first);
  await expect(
    page
      .getByRole("log", { name: "Assistant conversation" })
      .getByText("First conversation", { exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("log", { name: "Assistant conversation" })
      .getByText("Second conversation", { exact: true }),
  ).not.toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  const removed = page.waitForResponse(
    (response) =>
      response.url().endsWith(endpoint) &&
      response.request().method() === "DELETE" &&
      response.status() === 204,
  );
  await page
    .getByRole("button", { name: "Delete conversation", exact: true })
    .click();
  await removed;
  await expect(selector(page).locator(`option[value="${first}"]`)).toHaveCount(
    0,
  );
  await expect(selector(page).locator(`option[value="${second}"]`)).toHaveCount(
    1,
  );
  expect((await page.request.get(`${endpoint}?id=${first}`)).status()).toBe(
    404,
  );
});

test("retains unsaved messages on failure and retries without switching conversations", async ({
  page,
}) => {
  let fail = true;
  await page.route("**/api/assistant/conversations", async (route) => {
    if (route.request().method() === "PATCH" && fail)
      await route.fulfill({ status: 503, json: { error: "Temporary outage" } });
    else await route.continue();
  });
  const id = await selector(page).inputValue();
  const failed = saved(page, 503);
  await send(page, "Keep my unsaved message");
  await failed;
  await page
    .getByRole("button", { name: "New conversation", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Retry history", exact: true }),
  ).toBeVisible();
  await expect(selector(page)).toHaveValue(id);
  await expect(
    page
      .getByRole("log", { name: "Assistant conversation" })
      .getByText("Keep my unsaved message", { exact: true }),
  ).toBeVisible();
  fail = false;
  const retried = saved(page);
  await page
    .getByRole("button", { name: "Retry history", exact: true })
    .click();
  await retried;
  await page.reload();
  await open(page);
  await expect(
    page
      .getByRole("log", { name: "Assistant conversation" })
      .getByText("Keep my unsaved message", { exact: true }),
  ).toBeVisible();
});

test("reports a stale tab and reloads the saved version only after confirmation", async ({
  page,
  context,
}) => {
  const initial = saved(page);
  await send(page, "Shared starting point");
  await initial;
  const other = await context.newPage();
  await other.goto(`${appBasePath}/dashboard`);
  await open(other);
  const changed = saved(page);
  await send(page, "Newer saved turn");
  await changed;
  const rejected = saved(other, 409);
  await send(other, "Stale local turn");
  await rejected;
  await expect(
    other.getByRole("button", { name: "Reload saved history", exact: true }),
  ).toBeVisible();
  await expect(
    other
      .getByRole("log", { name: "Assistant conversation" })
      .getByText("Stale local turn", { exact: true }),
  ).toBeVisible();
  other.once("dialog", (dialog) => dialog.accept());
  await other
    .getByRole("button", { name: "Reload saved history", exact: true })
    .click();
  await expect(
    other
      .getByRole("log", { name: "Assistant conversation" })
      .getByText("Newer saved turn", { exact: true }),
  ).toBeVisible();
  await expect(
    other
      .getByRole("log", { name: "Assistant conversation" })
      .getByText("Stale local turn", { exact: true }),
  ).not.toBeVisible();
});

test("recovers a committed save whose response was lost before the next turn", async ({
  page,
}) => {
  let loseResponse = true;
  await page.route("**/api/assistant/conversations", async (route) => {
    if (route.request().method() !== "PATCH" || !loseResponse) {
      await route.continue();
      return;
    }
    const response = await route.fetch();
    expect(response.status()).toBe(200);
    loseResponse = false;
    await route.abort("failed");
  });

  await send(page, "Committed with a lost response");
  await expect(
    page.getByRole("button", { name: "Retry history" }),
  ).toBeVisible();
  await send(page, "Follow-up after the lost response");
  const id = await selector(page).inputValue();
  await expect
    .poll(async () => {
      const response = await page.request.get(`${endpoint}?id=${id}`);
      const row = await response.json();
      return row.messages.map((message: { text: string }) => message.text);
    })
    .toContain("Follow-up after the lost response");
  await expect(
    page.getByRole("button", { name: "Reload saved history" }),
  ).not.toBeVisible();
});

test("recovers a submitted turn after reloading before the server saves it", async ({
  page,
}) => {
  await page.route("**/api/assistant/conversations", async (route) => {
    if (route.request().method() === "PATCH") await route.abort("failed");
    else await route.continue();
  });
  await send(page, "Recover this turn after reload");
  await page.reload();
  await open(page);
  await expect(
    page
      .getByRole("log", { name: "Assistant conversation" })
      .getByText("Recover this turn after reload", { exact: true }),
  ).toBeVisible();
});
