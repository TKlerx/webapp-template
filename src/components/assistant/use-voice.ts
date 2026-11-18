"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { withBasePath } from "@/lib/base-path";

type VoiceSession = {
  abort: AbortController;
  stream?: MediaStream;
  peer?: RTCPeerConnection;
  channel?: RTCDataChannel;
  audio?: HTMLAudioElement;
  timer?: ReturnType<typeof setTimeout>;
};

export function useVoice(onTranscript: (text: string) => void) {
  const [status, setStatus] = useState<"off" | "connecting" | "listening">(
    "off",
  );
  const [error, setError] = useState(false);
  const session = useRef<VoiceSession | null>(null);
  const transcriptHandler = useRef(onTranscript);
  useEffect(() => {
    transcriptHandler.current = onTranscript;
  }, [onTranscript]);

  const stop = useCallback(() => {
    const current = session.current;
    session.current = null;
    current?.abort.abort();
    clearTimeout(current?.timer);
    current?.stream?.getTracks().forEach((track) => track.stop());
    current?.channel?.close();
    current?.peer?.close();
    if (current?.audio) {
      current.audio.pause();
      current.audio.srcObject = null;
    }
    setStatus("off");
  }, []);

  useEffect(() => stop, [stop]);

  const speak = useCallback((text: string) => {
    const channel = session.current?.channel;
    if (channel?.readyState !== "open" || !text.trim()) return;
    channel.send(
      JSON.stringify({
        type: "response.create",
        response: {
          output_modalities: ["audio"],
          instructions:
            "Read this assistant response aloud exactly as written: " +
            JSON.stringify(text.slice(0, 6000)),
        },
      }),
    );
  }, []);

  const start = useCallback(async () => {
    if (session.current) return;
    const current: VoiceSession = { abort: new AbortController() };
    session.current = current;
    setError(false);
    setStatus("connecting");
    const fail = () => {
      if (session.current !== current) return;
      setError(true);
      stop();
    };
    try {
      current.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true },
      });
      if (current.abort.signal.aborted) {
        current.stream.getTracks().forEach((track) => track.stop());
        return;
      }
      const peer = new RTCPeerConnection();
      current.peer = peer;
      const audio = new Audio();
      audio.autoplay = true;
      current.audio = audio;
      peer.ontrack = (event) => {
        audio.srcObject = event.streams[0];
        void audio.play().catch(fail);
      };
      current.stream
        .getTracks()
        .forEach((track) => peer.addTrack(track, current.stream!));
      const channel = peer.createDataChannel("assistant-events");
      current.channel = channel;
      channel.onopen = () => {
        setStatus("listening");
        clearTimeout(current.timer);
        current.timer = setTimeout(stop, 5 * 60_000);
      };
      channel.onclose = () => {
        if (session.current === current) stop();
      };
      channel.onmessage = (event) => {
        try {
          if (typeof event.data !== "string") return;
          const data: unknown = JSON.parse(event.data);
          if (!data || typeof data !== "object" || !("type" in data)) return;
          if (
            data.type ===
              "conversation.item.input_audio_transcription.completed" &&
            "transcript" in data &&
            typeof data.transcript === "string"
          ) {
            transcriptHandler.current(data.transcript.slice(0, 6000));
          }
          if (
            data.type === "error" ||
            data.type === "conversation.item.input_audio_transcription.failed"
          ) {
            fail();
          }
        } catch {
          fail();
        }
      };
      peer.onconnectionstatechange = () => {
        if (
          peer.connectionState === "failed" ||
          peer.connectionState === "disconnected"
        ) {
          fail();
        }
      };
      current.timer = setTimeout(fail, 30_000);
      await peer.setLocalDescription(await peer.createOffer());
      const response = await fetch(withBasePath("/api/assistant/voice"), {
        method: "POST",
        body: peer.localDescription?.sdp,
        headers: { "Content-Type": "application/sdp" },
        signal: current.abort.signal,
      });
      if (!response.ok) throw new Error("Voice unavailable");
      await peer.setRemoteDescription({
        type: "answer",
        sdp: await response.text(),
      });
    } catch {
      if (!current.abort.signal.aborted) {
        fail();
      }
    }
  }, [stop]);

  return { status, error, start, stop, speak };
}
