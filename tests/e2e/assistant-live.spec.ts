import { test, expect } from "@playwright/test";
import { Role } from "../../generated/prisma/enums";
import { loginWithPassword, expectOnDashboard } from "./helpers/auth";
import { seedLocalUser } from "./helpers/db";

// Opt-in only: consumes Azure capacity and needs a synthetic 48 kHz mono WAV.
test.skip(
  process.env.ASSISTANT_LIVE_AUDIO !== "1",
  "Set ASSISTANT_LIVE_AUDIO=1 and configure Azure to run this smoke test",
);
test.use({
  trace: "off",
  screenshot: "off",
  video: "off",
  launchOptions: {
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
      `--use-file-for-fake-audio-capture=${process.env.ASSISTANT_LIVE_AUDIO_FILE ?? ""}%noloop`,
    ],
  },
});

type LiveEvidence = Window & {
  liveAudio: {
    peers: RTCPeerConnection[];
    tracks: MediaStreamTrack[];
    events: string[];
    stats: () => Promise<{ bytes: number; energy: number }>;
  };
};

test("live Azure hears a synthetic prompt, calls the profile tool and streams spoken audio back", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  expect(process.env.ASSISTANT_LIVE_AUDIO_FILE).toBeTruthy();
  await seedLocalUser({
    email: "assistant-live-smoke@example.com",
    name: "Audio Smoke Test",
    role: Role.SCOPE_USER,
    password: "TestPass123!",
    mustChangePassword: false,
  });
  await page.addInitScript(() => {
    const evidence = {
      peers: [] as RTCPeerConnection[],
      tracks: [] as MediaStreamTrack[],
      events: [] as string[],
      stats: async () => {
        let bytes = 0;
        let energy = 0;
        for (const peer of evidence.peers) {
          const stats = await peer.getStats();
          stats.forEach(
            (entry: {
              type: string;
              kind?: string;
              bytesReceived?: number;
              totalAudioEnergy?: number;
            }) => {
              if (entry.type === "inbound-rtp" && entry.kind === "audio") {
                bytes += entry.bytesReceived ?? 0;
                energy += entry.totalAudioEnergy ?? 0;
              }
            },
          );
        }
        return { bytes, energy };
      },
    };
    Object.assign(window, { liveAudio: evidence });
    const OriginalPeer = window.RTCPeerConnection;
    window.RTCPeerConnection = class extends OriginalPeer {
      constructor(config?: RTCConfiguration) {
        super(config);
        evidence.peers.push(this);
      }
      createDataChannel(label: string, options?: RTCDataChannelInit) {
        const channel = super.createDataChannel(label, options);
        channel.addEventListener("message", (event) => {
          try {
            const data: unknown = JSON.parse(String(event.data));
            if (
              data &&
              typeof data === "object" &&
              "type" in data &&
              typeof data.type === "string"
            )
              evidence.events.push(data.type);
          } catch {
            /* The app handles invalid provider events. */
          }
        });
        return channel;
      }
    };
    const getUserMedia = navigator.mediaDevices.getUserMedia.bind(
      navigator.mediaDevices,
    );
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      const stream = await getUserMedia(constraints);
      evidence.tracks.push(...stream.getTracks());
      return stream;
    };
  });
  const tools: string[] = [];
  let textChatRequests = 0;
  page.on("request", (request) => {
    if (request.url().endsWith("/api/assistant/chat")) textChatRequests++;
  });
  page.on("response", async (response) => {
    if (!response.url().endsWith("/api/assistant/tools") || !response.ok())
      return;
    const body = response.request().postDataJSON() as { name: string };
    if (body.name === "getMyProfile") {
      const result = (await response.json()) as { output: { role: string } };
      if (result.output.role === "SCOPE_USER") tools.push(body.name);
    }
  });
  await loginWithPassword(
    page,
    "assistant-live-smoke@example.com",
    "TestPass123!",
  );
  await expectOnDashboard(page);
  await page
    .getByRole("button", { name: "Open assistant", exact: true })
    .click();
  await page.getByRole("button", { name: "Start voice", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Voice on", exact: true }),
  ).toBeVisible({ timeout: 40_000 });
  await expect.poll(() => tools.length, { timeout: 60_000 }).toBeGreaterThan(0);
  await expect
    .poll(
      async () =>
        (
          await page.evaluate(() =>
            (window as unknown as LiveEvidence).liveAudio.stats(),
          )
        ).energy,
      { timeout: 30_000 },
    )
    .toBeGreaterThan(0);
  await expect
    .poll(
      () =>
        page.evaluate(
          () => (window as unknown as LiveEvidence).liveAudio.events,
        ),
      { timeout: 20_000 },
    )
    .toEqual(
      expect.arrayContaining([
        "conversation.item.input_audio_transcription.completed",
        "response.output_audio_transcript.delta",
      ]),
    );
  expect(textChatRequests).toBe(0);
  const audio = await page.evaluate(() =>
    (window as unknown as LiveEvidence).liveAudio.stats(),
  );
  expect(audio.bytes).toBeGreaterThan(1024);
  await page
    .getByRole("button", { name: "Close assistant", exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as unknown as LiveEvidence).liveAudio.tracks.every(
          (track) => track.readyState === "ended",
        ),
      ),
    )
    .toBe(true);
  await testInfo.attach("live-audio-evidence", {
    body: JSON.stringify({
      audio,
      tools,
      nativeAudio: true,
      microphoneReleased: true,
    }),
    contentType: "application/json",
  });
});
