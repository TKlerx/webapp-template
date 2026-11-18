import { test, expect } from "@playwright/test";
import { Role } from "../../generated/prisma/enums";
import {
  appBasePath,
  expectOnDashboard,
  loginWithPassword,
} from "./helpers/auth";
import { seedLocalUser } from "./helpers/db";

test("assistant opens on the dashboard and retains conversation while navigating", async ({
  page,
}) => {
  await seedLocalUser({
    email: "assistant-test@example.com",
    name: "Assistant Test",
    role: Role.SCOPE_USER,
    password: "TestPass123!",
    mustChangePassword: false,
  });
  await page.route("**/api/assistant/chat", async (route) => {
    const events = [
      { type: "start", messageId: "assistant-1" },
      { type: "text-start", id: "text-1" },
      {
        type: "text-delta",
        id: "text-1",
        delta: "You can view your jobs on the background jobs page.",
      },
      { type: "text-end", id: "text-1" },
      {
        type: "tool-input-available",
        toolCallId: "navigate-1",
        toolName: "navigate",
        input: { page: "jobs" },
      },
      {
        type: "tool-output-available",
        toolCallId: "navigate-1",
        output: { page: "jobs", path: "/background-jobs" },
      },
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
  await loginWithPassword(page, "assistant-test@example.com", "TestPass123!");
  await expectOnDashboard(page);
  await page
    .getByRole("button", { name: "Open assistant", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Message", exact: true })
    .fill("Where are my jobs?");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(
    page.getByText("You can view your jobs on the background jobs page."),
  ).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`${appBasePath}/background-jobs$`));
  await page
    .getByRole("button", { name: "Close assistant", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Open assistant", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Message", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("You can view your jobs on the background jobs page."),
  ).toBeVisible();
  // Closing while a microphone permission prompt is pending must also release
  // a stream that arrives after the panel has closed.
  await page.evaluate(() => {
    const microphone = { stopped: 0, resolve: () => {} };
    Object.assign(window, { assistantMicrophone: microphone });
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      configurable: true,
      value: () =>
        new Promise((resolve) => {
          microphone.resolve = () =>
            resolve({
              getTracks: () => [{ stop: () => microphone.stopped++ }],
            });
        }),
    });
  });
  await page.getByRole("button", { name: "Start voice", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Connecting…", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Close assistant", exact: true })
    .click();
  await page.evaluate(() => {
    const state = window as unknown as {
      assistantMicrophone: { resolve: () => void };
    };
    state.assistantMicrophone.resolve();
  });
  await expect
    .poll(() =>
      page.evaluate(() => {
        const state = window as unknown as {
          assistantMicrophone: { stopped: number };
        };
        return state.assistantMicrophone.stopped;
      }),
    )
    .toBe(1);
});
