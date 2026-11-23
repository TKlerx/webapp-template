import { afterEach, expect, it, vi } from "vitest";
import { startRealtimeVoice } from "@/components/assistant/realtime-voice";

const sessions: AbortController[] = [];
afterEach(() => {
  sessions.splice(0).forEach((session) => session.abort());
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function setup() {
  const controller = new AbortController();
  sessions.push(controller);
  const track = { stop: vi.fn(), addEventListener: vi.fn() };
  const channel = {
    readyState: "open",
    send: vi.fn(),
    close: vi.fn(),
    onmessage: (_event: { data: string }) => {},
  };
  const close = vi.fn();
  vi.stubGlobal(
    "RTCPeerConnection",
    class {
      localDescription = { sdp: "v=0\r\noffer" };
      createDataChannel = () => channel;
      addTrack = vi.fn();
      createOffer = async () => ({ type: "offer", sdp: "v=0\r\noffer" });
      setLocalDescription = async () => {};
      setRemoteDescription = async () => {};
      close = close;
    },
  );
  vi.stubGlobal(
    "Audio",
    class {
      pause = vi.fn();
    },
  );
  const microphone = vi.fn(async () => ({ getTracks: () => [track] }));
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: microphone } });
  const fetch = vi.fn().mockResolvedValueOnce(new Response("v=0\r\nanswer"));
  vi.stubGlobal("fetch", fetch);
  const callbacks = {
    onTurn: vi.fn(),
    onNavigate: vi.fn(),
    onBusy: vi.fn(),
    onReady: vi.fn(),
    onClose: vi.fn(),
    onError: vi.fn(),
  };
  const event = (type: string, data: object = {}) =>
    channel.onmessage({ data: JSON.stringify({ type, ...data }) });
  const sent = () =>
    channel.send.mock.calls.map(
      ([message]) =>
        JSON.parse(message as string) as { type: string; item?: unknown },
    );
  return {
    controller,
    track,
    channel,
    close,
    microphone,
    fetch,
    callbacks,
    event,
    sent,
  };
}

it("streams partial replies, interrupts without dropping the microphone, and keeps typed turns in the live conversation", async () => {
  const s = setup();
  const live = await startRealtimeVoice(
    [{ id: "old", role: "assistant", text: "Earlier answer" }],
    s.callbacks,
    s.controller.signal,
  );
  expect(s.callbacks.onReady).toHaveBeenCalledOnce();
  expect(s.sent()[0]).toMatchObject({
    type: "conversation.item.create",
    item: {
      role: "assistant",
      content: [{ type: "output_text", text: "Earlier answer" }],
    },
  });
  s.event("response.created");
  s.event("response.output_audio_transcript.delta", {
    item_id: "reply",
    delta: "Your ",
  });
  expect(s.callbacks.onTurn).toHaveBeenLastCalledWith({
    id: "voice:reply",
    role: "assistant",
    text: "Your ",
  });
  s.event("response.output_audio_transcript.delta", {
    item_id: "reply",
    delta: "jobs.",
  });
  expect(s.callbacks.onTurn).toHaveBeenLastCalledWith({
    id: "voice:reply",
    role: "assistant",
    text: "Your jobs.",
  });
  live.interrupt();
  expect(s.sent().slice(-2)).toEqual([
    { type: "response.cancel" },
    { type: "output_audio_buffer.clear" },
  ]);
  expect(s.track.stop).not.toHaveBeenCalled();
  s.event("response.done");
  s.event("input_audio_buffer.speech_started", { item_id: "question" });
  s.event("conversation.item.input_audio_transcription.completed", {
    item_id: "question",
    transcript: "What is my role?",
  });
  expect(s.callbacks.onTurn).toHaveBeenLastCalledWith({
    id: "voice:question",
    role: "user",
    text: "What is my role?",
  });
  s.event("input_audio_buffer.speech_stopped");
  expect(live.sendText("Open my jobs")).toBe(true);
  expect(s.sent().slice(-2)).toMatchObject([
    { type: "conversation.item.create", item: { role: "user" } },
    { type: "response.create" },
  ]);
  live.stop();
  live.stop();
  expect(s.track.stop).toHaveBeenCalledOnce();
  expect(s.close).toHaveBeenCalledOnce();
});

it.each([false, true])(
  "deduplicates server tool calls and suppresses interrupted navigation (interrupt=%s)",
  async (interrupted) => {
    const s = setup();
    let finish!: (response: Response) => void;
    s.fetch.mockReturnValueOnce(
      new Promise<Response>((resolve) => {
        finish = resolve;
      }),
    );
    const live = await startRealtimeVoice([], s.callbacks, s.controller.signal);
    s.event("response.created");
    const call = {
      call_id: "call-1",
      name: "navigate",
      arguments: JSON.stringify({ page: "jobs" }),
    };
    s.event("response.function_call_arguments.done", call);
    s.event("response.function_call_arguments.done", call);
    await vi.waitFor(() => expect(s.fetch).toHaveBeenCalledTimes(2));
    if (interrupted) live.interrupt();
    s.event("response.done");
    expect(
      s.sent().filter((item) => item.type === "response.create"),
    ).toHaveLength(0);
    finish(
      Response.json({ output: { page: "jobs", path: "/background-jobs" } }),
    );
    await vi.waitFor(() =>
      expect(
        s.sent().some((item) => item.type === "conversation.item.create"),
      ).toBe(true),
    );
    expect(s.fetch).toHaveBeenLastCalledWith(
      expect.stringContaining("/api/assistant/tools"),
      expect.objectContaining({
        body: JSON.stringify({ name: "navigate", arguments: { page: "jobs" } }),
      }),
    );
    expect(s.callbacks.onNavigate).toHaveBeenCalledTimes(interrupted ? 0 : 1);
    expect(
      s.sent().filter((item) => item.type === "response.create"),
    ).toHaveLength(interrupted ? 0 : 1);
  },
);

it("stops the live session when server tool authentication has been revoked", async () => {
  const s = setup();
  s.fetch.mockResolvedValueOnce(new Response(null, { status: 401 }));
  await startRealtimeVoice([], s.callbacks, s.controller.signal);
  s.event("response.function_call_arguments.done", {
    call_id: "profile",
    name: "getMyProfile",
    arguments: "{}",
  });
  await vi.waitFor(() => expect(s.callbacks.onError).toHaveBeenCalledOnce());
  expect(s.track.stop).toHaveBeenCalledOnce();
  expect(s.callbacks.onNavigate).not.toHaveBeenCalled();
});

it("releases a microphone stream even when permission arrives after cancellation", async () => {
  const s = setup();
  let permit!: (stream: { getTracks: () => (typeof s.track)[] }) => void;
  s.microphone.mockReturnValueOnce(
    new Promise((resolve) => {
      permit = resolve;
    }),
  );
  const pending = startRealtimeVoice([], s.callbacks, s.controller.signal);
  s.controller.abort();
  permit({ getTracks: () => [s.track] });
  await expect(pending).rejects.toThrow("Voice stopped");
  expect(s.track.stop).toHaveBeenCalledOnce();
  expect(s.close).toHaveBeenCalledOnce();
  expect(s.fetch).not.toHaveBeenCalled();
  expect(s.callbacks.onError).not.toHaveBeenCalled();
});

it("keeps the stop button active while buffered audio is still playing", async () => {
  const s = setup();
  await startRealtimeVoice([], s.callbacks, s.controller.signal);
  s.event("response.created");
  s.event("output_audio_buffer.started");
  s.event("response.done");
  expect(s.callbacks.onBusy).toHaveBeenLastCalledWith(true);
  s.event("output_audio_buffer.stopped");
  expect(s.callbacks.onBusy).toHaveBeenLastCalledWith(false);
});

it("reports a failed native response and releases its resources", async () => {
  const s = setup();
  await startRealtimeVoice([], s.callbacks, s.controller.signal);
  s.event("response.done", { response: { status: "failed" } });
  expect(s.callbacks.onError).toHaveBeenCalledOnce();
  expect(s.track.stop).toHaveBeenCalledOnce();
});
