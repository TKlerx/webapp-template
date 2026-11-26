"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { startRealtimeVoice, type VoiceTurn } from "./realtime-voice";

type VoiceSession = {
  abort: AbortController;
  live?: Awaited<ReturnType<typeof startRealtimeVoice>>;
};

export function useVoice(callbacks: {
  onTurn: Parameters<typeof startRealtimeVoice>[1]["onTurn"];
  onNavigate: Parameters<typeof startRealtimeVoice>[1]["onNavigate"];
}) {
  const [status, setStatus] = useState<"off" | "connecting" | "listening">(
    "off",
  );
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<VoiceTurn | null>(null);
  const [error, setError] = useState(false);
  const session = useRef<VoiceSession | null>(null);
  const handlers = useRef(callbacks);
  useEffect(() => {
    handlers.current = callbacks;
  }, [callbacks]);
  const stop = useCallback(() => {
    const current = session.current;
    session.current = null;
    current?.abort.abort();
    current?.live?.stop();
    setStatus("off");
    setBusy(false);
    setPreview(null);
  }, []);
  useEffect(() => stop, [stop]);
  const start = useCallback(
    async (history: VoiceTurn[]) => {
      if (session.current) return;
      const current: VoiceSession = {
        abort: new AbortController(),
      };
      session.current = current;
      setError(false);
      setStatus("connecting");
      const active = () =>
        session.current === current && !current.abort.signal.aborted;
      try {
        const live = await startRealtimeVoice(
          history,
          {
            onTurn: (turn, beforeIds) => {
              if (active()) handlers.current.onTurn(turn, beforeIds);
            },
            onPreview: (turn) => {
              if (active()) setPreview(turn);
            },
            onNavigate: (page) => {
              if (active()) handlers.current.onNavigate(page);
            },
            onBusy: (value) => {
              if (active()) setBusy(value);
            },
            onReady: () => {
              if (active()) setStatus("listening");
            },
            onClose: () => {
              if (active()) stop();
            },
            onError: () => {
              if (active()) setError(true);
            },
          },
          current.abort.signal,
        );
        if (!active()) live.stop();
        else current.live = live;
      } catch {
        if (active()) {
          setError(true);
          stop();
        }
      }
    },
    [stop],
  );
  return {
    status,
    busy,
    preview,
    error,
    start,
    stop,
    interrupt: () => session.current?.live?.interrupt(),
    sendText: (text: string) => session.current?.live?.sendText(text) ?? false,
  };
}
