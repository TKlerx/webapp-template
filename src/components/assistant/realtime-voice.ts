import { z } from "zod";
import { assistantPageSchema } from "@/lib/assistant";
import { withBasePath } from "@/lib/base-path";

export type VoiceTurn = {
  id: string;
  role: "user" | "assistant";
  text: string;
};
type Callbacks = {
  onTurn: (turn: VoiceTurn, beforeIds?: string[]) => void;
  onPreview: (turn: VoiceTurn | null) => void;
  onNavigate: (page: z.infer<typeof assistantPageSchema>) => void;
  onBusy: (busy: boolean) => void;
  onReady: () => void;
  onClose: () => void;
  onError: () => void;
};
const outputItem = z.object({
  id: z.string(),
  type: z.string(),
  call_id: z.string().optional(),
  name: z.string().optional(),
  arguments: z.string().optional(),
  content: z.array(z.object({ transcript: z.string().nullish() })).optional(),
});

type ToolCall = { call_id: string; name: string; arguments?: string };

const voiceEvent = z.object({
  type: z.string(),
  item_id: z.string().optional(),
  delta: z.string().optional(),
  transcript: z.string().optional(),
  response_id: z.string().optional(),
  previous_item_id: z.string().nullish(),
  item: z.object({ id: z.string() }).optional(),
  error: z.object({ code: z.string().optional() }).optional(),
  response: z
    .object({
      id: z.string(),
      status: z.string().optional(),
      output: z.array(outputItem).optional(),
    })
    .optional(),
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
  let response: { id: string; turn: number } | undefined;
  let requestedResponseTurn: number | undefined;
  let playableResponseId: string | undefined;
  let playingResponseId: string | undefined;
  let receivingSpeech = false;
  let pendingCalls = 0;
  let needsResponse = false;
  let turn = 0;
  let callsThisTurn = 0;
  let queue = Promise.resolve();
  const seen = new Set<string>();
  const transcripts = new Map<string, string>();
  const itemOrder: string[] = [];
  const recordItem = (id: string, previousId?: string | null) => {
    const current = itemOrder.indexOf(id);
    if (current !== -1 && previousId === undefined) return;
    if (current !== -1) itemOrder.splice(current, 1);
    const previous = previousId ? itemOrder.indexOf(previousId) : -1;
    const index =
      previousId === null || previous !== -1 ? previous + 1 : itemOrder.length;
    itemOrder.splice(index, 0, id);
    if (itemOrder.length > 512) itemOrder.shift();
  };
  const publish = (id: string, role: VoiceTurn["role"], text: string) => {
    recordItem(id);
    const later = itemOrder.slice(itemOrder.indexOf(id) + 1);
    const message = { id: "voice:" + id, role, text: text.slice(0, 6000) };
    if (later.length)
      callbacks.onTurn(
        message,
        later.map((item) => "voice:" + item),
      );
    else callbacks.onTurn(message);
  };
  const clearPreview = () => {
    transcripts.clear();
    callbacks.onPreview(null);
  };
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
      activeResponse ||
        Boolean(playingResponseId) ||
        receivingSpeech ||
        pendingCalls > 0,
    );
  const createResponse = () => {
    activeResponse = true;
    requestedResponseTurn = turn;
    callbacks.onBusy(true);
    send({ type: "response.create" });
  };
  const resume = () => {
    if (!closed && needsResponse && !activeResponse && pendingCalls === 0) {
      needsResponse = false;
      createResponse();
    }
  };
  const interrupt = () => {
    turn++;
    callsThisTurn = 0;
    needsResponse = false;
    playingResponseId = undefined;
    receivingSpeech = false;
    playableResponseId = undefined;
    clearPreview();
    if (activeResponse)
      send({ type: "response.cancel", response_id: response?.id });
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
  const runTool = async (data: ToolCall, requestedTurn: number) => {
    if (closed) return;
    const interrupted = {
      error: "This request was interrupted. Ask again if still needed.",
    };
    let output: unknown = interrupted;
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
        output: JSON.stringify(requestedTurn === turn ? output : interrupted),
      },
    });
    if (requestedTurn === turn) needsResponse = true;
  };
  const enqueueTool = (call: ToolCall, requestedTurn: number) => {
    if (seen.has(call.call_id)) return;
    if (seen.size >= 100) {
      fail();
      return;
    }
    seen.add(call.call_id);
    pendingCalls++;
    queue = queue
      .then(() => runTool(call, requestedTurn))
      .catch(fail)
      .finally(() => {
        pendingCalls--;
        resume();
        updateBusy();
      })
      .catch(fail);
  };

  const finishResponse = (
    completed: NonNullable<z.infer<typeof voiceEvent>["response"]>,
  ) => {
    if (response?.id !== completed.id) return;
    const requestedTurn = response.turn;
    response = undefined;
    activeResponse = false;
    if (requestedTurn === turn && completed.status === "failed") {
      fail();
      return;
    }
    if (requestedTurn === turn && completed.status === "completed") {
      for (const item of completed.output ?? []) {
        if (item.type === "message") {
          const text =
            item.content?.map((part) => part.transcript ?? "").join("") ||
            transcripts.get(item.id);
          if (text?.trim()) publish(item.id, "assistant", text);
        }
        if (item.type === "function_call" && item.call_id && item.name)
          enqueueTool(
            {
              call_id: item.call_id,
              name: item.name,
              arguments: item.arguments,
            },
            requestedTurn,
          );
      }
    }
    clearPreview();
    updateBusy();
    resume();
  };
  const applyConversationEvent = (data: z.infer<typeof voiceEvent>) => {
    if (data.type === "input_audio_buffer.speech_started") {
      interrupt();
      receivingSpeech = true;
      callbacks.onBusy(true);
      if (data.item_id) recordItem(data.item_id);
    }
    if (data.type === "input_audio_buffer.speech_stopped") {
      receivingSpeech = false;
      updateBusy();
    }
    if (data.type === "input_audio_buffer.committed" && data.item_id)
      recordItem(data.item_id, data.previous_item_id);
    if (
      data.type === "conversation.item.added" ||
      data.type === "conversation.item.created"
    ) {
      if (data.item) recordItem(data.item.id, data.previous_item_id);
    }
    if (
      data.type === "conversation.item.input_audio_transcription.completed" &&
      data.item_id &&
      data.transcript?.trim()
    )
      publish(data.item_id, "user", data.transcript);
  };
  const applyResponseEvent = (data: z.infer<typeof voiceEvent>) => {
    if (data.type === "response.created" && data.response) {
      clearPreview();
      response = { id: data.response.id, turn: requestedResponseTurn ?? turn };
      requestedResponseTurn = undefined;
      playableResponseId = response.turn === turn ? response.id : undefined;
      activeResponse = true;
      updateBusy();
    }
    if (data.type === "response.done" && data.response)
      finishResponse(data.response);

    if (
      data.type === "output_audio_buffer.started" &&
      data.response_id &&
      data.response_id === playableResponseId
    ) {
      playingResponseId = data.response_id;
      updateBusy();
    }
    if (
      playingResponseId &&
      data.response_id === playingResponseId &&
      (data.type === "output_audio_buffer.stopped" ||
        data.type === "output_audio_buffer.cleared")
    ) {
      playingResponseId = undefined;
      updateBusy();
    }
    if (
      response &&
      data.response_id === response.id &&
      response.turn === turn &&
      data.item_id &&
      (data.type === "response.output_audio_transcript.delta" ||
        data.type === "response.output_audio_transcript.done")
    ) {
      recordItem(data.item_id);
      const text = (
        data.transcript ??
        (transcripts.get(data.item_id) ?? "") + (data.delta ?? "")
      ).slice(0, 6000);
      transcripts.set(data.item_id, text);
      if (transcripts.size > 48)
        transcripts.delete(transcripts.keys().next().value!);
      callbacks.onPreview({
        id: "voice:" + data.item_id,
        role: "assistant",
        text,
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
    applyConversationEvent(data);
    applyResponseEvent(data);
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
          playingResponseId ||
          receivingSpeech ||
          pendingCalls
        )
          return false;
        turn++;
        callsThisTurn = 0;
        const id = "item_" + crypto.randomUUID().replaceAll("-", "");
        publish(id, "user", text);
        send({
          type: "conversation.item.create",
          item: {
            id,
            type: "message",
            role: "user",
            content: [{ type: "input_text", text }],
          },
        });
        createResponse();
        return true;
      },
    };
  } catch (error) {
    if (!signal.aborted && !closed) callbacks.onError();
    stop();
    throw error;
  }
}
