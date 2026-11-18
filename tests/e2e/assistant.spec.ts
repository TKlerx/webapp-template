import { test, expect } from "@playwright/test";
import { Role } from "../../generated/prisma/enums";
import {
  appBasePath,
  expectOnDashboard,
  loginWithPassword,
} from "./helpers/auth";
import { seedLocalUser } from "./helpers/db";

type LiveVoiceWindow = Window & {
  assistantLive: {
    emit: (event: object) => void;
    sent: string[];
    stopped: number;
    closed: number;
  };
};

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
        delta: "You can manage your tokens on the API tokens page.",
      },
      { type: "text-end", id: "text-1" },
      {
        type: "tool-input-available",
        toolCallId: "navigate-1",
        toolName: "navigate",
        input: { page: "tokens" },
      },
      {
        type: "tool-output-available",
        toolCallId: "navigate-1",
        output: { page: "tokens", path: "/settings/tokens" },
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
    .fill("Open my API tokens");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(
    page.getByText("You can manage your tokens on the API tokens page."),
  ).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`${appBasePath}/settings/tokens$`));
  await expect(
    page.getByRole("heading", {
      name: "Personal access tokens",
      exact: true,
      level: 1,
    }),
  ).toBeVisible();
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
    page.getByText("You can manage your tokens on the API tokens page."),
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

test("native voice streams into chat, runs authenticated tools and interrupts without ending the session", async ({
  page,
}) => {
  await seedLocalUser({
    email: "assistant-voice@example.com",
    name: "Voice Test",
    role: Role.SCOPE_USER,
    password: "TestPass123!",
    mustChangePassword: false,
  });
  await page.addInitScript(() => {
    const state = {
      sent: [] as string[],
      stopped: 0,
      closed: 0,
      emit: (_event: object) => {},
    };
    const channel = {
      readyState: "open",
      onmessage: (_event: { data: string }) => {},
      onopen: () => {},
      send: (message: string) => state.sent.push(message),
      close: () => {},
    };
    state.emit = (event) => channel.onmessage({ data: JSON.stringify(event) });
    Object.assign(window, { assistantLive: state });
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      configurable: true,
      value: async () => ({
        getTracks: () => [
          { stop: () => state.stopped++, addEventListener: () => {} },
        ],
      }),
    });
    Object.defineProperty(window, "RTCPeerConnection", {
      configurable: true,
      value: class {
        localDescription = { sdp: "v=0\r\noffer" };
        createDataChannel = () => channel;
        addTrack = () => {};
        createOffer = async () => ({ type: "offer", sdp: "v=0\r\noffer" });
        setLocalDescription = async () => {};
        setRemoteDescription = async () => {
          channel.onopen();
        };
        close = () => state.closed++;
      },
    });
  });
  let textRequests = 0;
  await page.route("**/api/assistant/chat", async (route) => {
    textRequests++;
    await route.fulfill({ status: 503 });
  });
  await page.route("**/api/assistant/voice", async (route) => {
    await route.fulfill({
      status: 201,
      contentType: "application/sdp",
      body: "v=0\r\nanswer",
    });
  });
  const emit = (event: object) =>
    page.evaluate(
      (value) =>
        (window as unknown as LiveVoiceWindow).assistantLive.emit(value),
      event,
    );
  await loginWithPassword(page, "assistant-voice@example.com", "TestPass123!");
  await expectOnDashboard(page);
  await page
    .getByRole("button", { name: "Open assistant", exact: true })
    .click();
  await page.getByRole("button", { name: "Start voice", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Voice on", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await emit({
    type: "input_audio_buffer.speech_started",
    item_id: "question",
  });
  await emit({
    type: "conversation.item.input_audio_transcription.completed",
    item_id: "question",
    transcript: "Show my tokens",
  });
  await emit({ type: "input_audio_buffer.speech_stopped" });
  await emit({ type: "response.created" });
  await emit({
    type: "response.output_audio_transcript.delta",
    item_id: "reply",
    delta: "Opening your ",
  });
  await expect(page.getByText("Opening your ", { exact: true })).toBeVisible();
  await emit({
    type: "response.output_audio_transcript.delta",
    item_id: "reply",
    delta: "tokens.",
  });
  await expect(
    page.getByText("Opening your tokens.", { exact: true }),
  ).toBeVisible();
  await emit({
    type: "response.function_call_arguments.done",
    call_id: "navigate-voice",
    name: "navigate",
    arguments: JSON.stringify({ page: "tokens" }),
  });
  await emit({ type: "response.done" });
  await expect(page).toHaveURL(new RegExp(`${appBasePath}/settings/tokens$`));
  await expect(
    page.getByRole("heading", {
      name: "Personal access tokens",
      exact: true,
      level: 1,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Stop response", exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as unknown as LiveVoiceWindow).assistantLive.sent.some(
          (item) => JSON.parse(item).type === "output_audio_buffer.clear",
        ),
      ),
    )
    .toBe(true);
  await expect(
    page.getByRole("button", { name: "Voice on", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(
    await page.evaluate(
      () => (window as unknown as LiveVoiceWindow).assistantLive.stopped,
    ),
  ).toBe(0);
  await page
    .getByRole("button", { name: "Close assistant", exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as LiveVoiceWindow).assistantLive.stopped,
      ),
    )
    .toBe(1);
  expect(textRequests).toBe(0);
});
