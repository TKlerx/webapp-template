import { z } from "zod";
import { assistantPageSchema } from "@/lib/assistant";
import { withBasePath } from "@/lib/base-path";

export type VoiceTurn = {
  id: string;
  role: "user" | "assistant";
  text: string;
};
type Callbacks = {
  onTurn: (turn: VoiceTurn) => void;
  onNavigate: (page: z.infer<typeof assistantPageSchema>) => void;
  onBusy: (busy: boolean) => void;
  onReady: () => void;
  onClose: () => void;
  onError: () => void;
};
const voiceEvent = z.object({
  type: z.string(),
  item_id: z.string().optional(),
  delta: z.string().optional(),
  transcript: z.string().optional(),
  call_id: z.string().optional(),
  name: z.string().optional(),
  arguments: z.string().optional(),
  error: z.object({ code: z.string().optional() }).optional(),
  response: z.object({ status: z.string().optional() }).optional(),
});

export async function startRealtimeVoice(
  history: VoiceTurn[],
  callbacks: Callbacks,
  signal: AbortSignal,
) {
  const peer = new RTCPeerConnection();
  const audio = new Audio();
  audio.autoplay = true;
  const channel = peer.createDataChannel("assistant-events");
  let stream: MediaStream | undefined;
  let closed = false;
  let ready = false;
  let activeResponse = false;
  let playing = false;
  let receivingSpeech = false;
  let pendingCalls = 0;
  let needsResponse = false;
  let turn = 0;
  let callsThisTurn = 0;
  let queue = Promise.resolve();
  const seen = new Set<string>();
  const transcripts = new Map<string, string>();
  const send = (event: object) => {
    if (!closed && channel.readyState === "open")
      channel.send(JSON.stringify(event));
  };
  let timer: ReturnType<typeof setTimeout>;
  const stop = () => {
    if (closed) return;
    closed = true;
    clearTimeout(timer);
    signal.removeEventListener("abort", stop);
    stream?.getTracks().forEach((track) => track.stop());
    channel.close();
    peer.close();
    audio.pause();
    audio.srcObject = null;
    callbacks.onBusy(false);
    callbacks.onClose();
  };
  const fail = () => {
    if (!closed) {
      callbacks.onError();
      stop();
    }
  };
  const updateBusy = () =>
    callbacks.onBusy(
      activeResponse || playing || receivingSpeech || pendingCalls > 0,
    );
  const resume = () => {
    if (!closed && needsResponse && !activeResponse && pendingCalls === 0) {
      needsResponse = false;
      activeResponse = true;
      callbacks.onBusy(true);
      send({ type: "response.create" });
    }
  };
  const interrupt = () => {
    turn++;
    callsThisTurn = 0;
    needsResponse = false;
    playing = false;
    receivingSpeech = false;
    if (activeResponse) send({ type: "response.cancel" });
    send({ type: "output_audio_buffer.clear" });
    callbacks.onBusy(false);
  };
  const onReady = () => {
    if (closed || ready) return;
    ready = true;
    clearTimeout(timer);
    timer = setTimeout(stop, 5 * 60_000);
    for (const message of history.slice(-24)) {
      if (!message.text.trim()) continue;
      send({
        type: "conversation.item.create",
        item: {
          type: "message",
          role: message.role,
          content: [
            {
              type: message.role === "user" ? "input_text" : "output_text",
              text: message.text.slice(0, 6000),
            },
          ],
        },
      });
    }
    callbacks.onReady();
  };
  const runTool = async (
    data: z.infer<typeof voiceEvent>,
    requestedTurn: number,
  ) => {
    if (closed) return;
    let output: unknown = {
      error: "This request was interrupted. Ask again if still needed.",
    };
    if (requestedTurn === turn) {
      if (++callsThisTurn > 4) {
        fail();
        return;
      }
      let args: unknown;
      try {
        args = JSON.parse(data.arguments ?? "{}");
      } catch {
        args = null;
      }
      const response = await fetch(withBasePath("/api/assistant/tools"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: data.name, arguments: args }),
        signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
      });
      if (closed) return;
      if (response.status === 401 || response.status === 403) {
        fail();
        return;
      }
      const result: unknown = await response.json();
      output =
        response.ok &&
        result &&
        typeof result === "object" &&
        "output" in result
          ? result.output
          : { error: "The tool could not complete this request." };
      if (response.ok && data.name === "navigate" && requestedTurn === turn) {
        const page = z.object({ page: assistantPageSchema }).safeParse(output);
        if (page.success) callbacks.onNavigate(page.data.page);
      }
    }
    send({
      type: "conversation.item.create",
      item: {
        type: "function_call_output",
        call_id: data.call_id,
        output: JSON.stringify(output),
      },
    });
    if (requestedTurn === turn) needsResponse = true;
  };
  const applyTranscript = (data: z.infer<typeof voiceEvent>) => {
    if (
      data.type === "conversation.item.input_audio_transcription.completed" &&
      data.item_id &&
      data.transcript
    ) {
      callbacks.onTurn({
        id: "voice:" + data.item_id,
        role: "user",
        text: data.transcript.slice(0, 6000),
      });
    }
    if (
      data.type === "response.output_audio_transcript.delta" &&
      data.item_id &&
      data.delta
    ) {
      const text = ((transcripts.get(data.item_id) ?? "") + data.delta).slice(
        0,
        6000,
      );
      transcripts.set(data.item_id, text);
      if (transcripts.size > 48)
        transcripts.delete(transcripts.keys().next().value!);
      callbacks.onTurn({
        id: "voice:" + data.item_id,
        role: "assistant",
        text,
      });
    }
    if (
      data.type === "response.output_audio_transcript.done" &&
      data.item_id &&
      data.transcript
    ) {
      transcripts.delete(data.item_id);
      callbacks.onTurn({
        id: "voice:" + data.item_id,
        role: "assistant",
        text: data.transcript.slice(0, 6000),
      });
    }
  };
  channel.onmessage = (event) => {
    if (closed || typeof event.data !== "string") return;
    if (event.data.length > 128 * 1024) {
      fail();
      return;
    }
    let raw: unknown;
    try {
      raw = JSON.parse(event.data);
    } catch {
      fail();
      return;
    }
    const parsed = voiceEvent.safeParse(raw);
    if (!parsed.success) return;
    const data = parsed.data;
    if (data.type === "input_audio_buffer.speech_started") {
      interrupt();
      receivingSpeech = true;
      callbacks.onBusy(true);
      if (data.item_id)
        callbacks.onTurn({
          id: "voice:" + data.item_id,
          role: "user",
          text: "…",
        });
    }
    if (data.type === "input_audio_buffer.speech_stopped") {
      receivingSpeech = false;
      updateBusy();
    }
    if (data.type === "response.created") {
      activeResponse = true;
      callbacks.onBusy(true);
    }
    if (data.type === "response.done") {
      if (data.response?.status === "failed") {
        fail();
        return;
      }
      activeResponse = false;
      updateBusy();
      resume();
    }
    if (data.type === "output_audio_buffer.started") {
      playing = true;
      callbacks.onBusy(true);
    }
    if (
      data.type === "output_audio_buffer.stopped" ||
      data.type === "output_audio_buffer.cleared"
    ) {
      playing = false;
      updateBusy();
    }
    applyTranscript(data);
    if (
      data.type === "response.function_call_arguments.done" &&
      data.call_id &&
      data.name &&
      !seen.has(data.call_id)
    ) {
      if (seen.size >= 100) {
        fail();
        return;
      }
      seen.add(data.call_id);
      pendingCalls++;
      callbacks.onBusy(true);
      const requestedTurn = turn;
      queue = queue
        .then(() => runTool(data, requestedTurn))
        .catch(fail)
        .finally(() => {
          pendingCalls--;
          resume();
        })
        .catch(fail);
    }
    if (
      data.type === "error" &&
      data.error?.code !== "response_cancel_not_active" &&
      data.error?.code !== "conversation_already_has_active_response"
    )
      fail();
    if (data.type === "conversation.item.input_audio_transcription.failed")
      fail();
  };
  channel.onopen = onReady;
  channel.onclose = fail;
  peer.ontrack = (event) => {
    if (closed) return;
    audio.srcObject = event.streams[0] ?? new MediaStream([event.track]);
    void audio.play().catch(fail);
  };
  peer.onconnectionstatechange = () => {
    if (
      peer.connectionState === "failed" ||
      peer.connectionState === "disconnected"
    )
      fail();
  };
  signal.addEventListener("abort", stop, { once: true });
  timer = setTimeout(fail, 30_000);
  try {
    signal.throwIfAborted();
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
    });
    if (closed || signal.aborted) {
      stream.getTracks().forEach((track) => track.stop());
      throw new Error("Voice stopped");
    }
    stream.getTracks().forEach((track) => {
      peer.addTrack(track, stream!);
      track.addEventListener("ended", fail, { once: true });
    });
    await peer.setLocalDescription(await peer.createOffer());
    const response = await fetch(withBasePath("/api/assistant/voice"), {
      method: "POST",
      body: peer.localDescription?.sdp,
      headers: { "Content-Type": "application/sdp" },
      signal,
    });
    if (!response.ok || closed) throw new Error("Voice unavailable");
    await peer.setRemoteDescription({
      type: "answer",
      sdp: await response.text(),
    });
    if (channel.readyState === "open") onReady();
    return {
      stop,
      interrupt,
      sendText: (text: string) => {
        if (
          closed ||
          !ready ||
          activeResponse ||
          playing ||
          receivingSpeech ||
          pendingCalls
        )
          return false;
        turn++;
        callsThisTurn = 0;
        callbacks.onTurn({
          id: "voice:" + crypto.randomUUID(),
          role: "user",
          text,
        });
        send({
          type: "conversation.item.create",
          item: {
            type: "message",
            role: "user",
            content: [{ type: "input_text", text }],
          },
        });
        activeResponse = true;
        callbacks.onBusy(true);
        send({ type: "response.create" });
        return true;
      },
    };
  } catch (error) {
    if (!signal.aborted && !closed) callbacks.onError();
    stop();
    throw error;
  }
}
