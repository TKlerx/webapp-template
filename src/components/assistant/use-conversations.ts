"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  conversationSummarySchema,
  savedConversationSchema,
  type ConversationSummary,
  type SavedConversation,
  type SavedTurn,
} from "@/lib/assistant";
import { withBasePath } from "@/lib/base-path";

const endpoint = withBasePath("/api/assistant/conversations");
type Status = "loading" | "ready" | "saving" | "error" | "conflict";

async function fetchConversation(id?: string) {
  const response = await fetch(
    id ? endpoint + "?id=" + encodeURIComponent(id) : endpoint,
    { method: id ? "GET" : "POST" },
  );
  if (!response.ok) throw response;
  return savedConversationSchema.parse(await response.json());
}

export function useConversations(
  enabled: boolean,
  turns: SavedTurn[],
  onLoad: (turns: SavedTurn[]) => void,
) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [id, setId] = useState("");
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<Status>("loading");
  const active = useRef<ConversationSummary | null>(null);
  const latest = useRef("[]");
  const saved = useRef("[]");
  const initialized = useRef(false);
  const pending = useRef<Promise<boolean> | null>(null);
  const loadHandler = useRef(onLoad);
  const serialized = JSON.stringify(turns);
  useEffect(() => {
    latest.current = serialized;
    loadHandler.current = onLoad;
  }, [serialized, onLoad]);

  const remember = useCallback((row: ConversationSummary) => {
    setConversations((previous) =>
      [row, ...previous.filter((item) => item.id !== row.id)].slice(0, 50),
    );
  }, []);
  const apply = useCallback(
    (row: SavedConversation) => {
      active.current = row;
      latest.current = saved.current = JSON.stringify(row.messages);
      setId(row.id);
      remember(row);
      loadHandler.current(row.messages);
      setReady(true);
      setStatus("ready");
    },
    [remember],
  );
  const save = useCallback(
    async function flush(): Promise<boolean> {
      if (pending.current) {
        if (!(await pending.current)) return false;
        return flush();
      }
      const current = active.current;
      const snapshot = latest.current;
      if (!current) return false;
      if (snapshot === saved.current) {
        setStatus("ready");
        return true;
      }
      const operation = (async () => {
        setStatus("saving");
        try {
          const response = await fetch(endpoint, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: current.id,
              revision: current.revision,
              messages: JSON.parse(snapshot) as SavedTurn[],
            }),
          });
          if (!response.ok) throw response;
          const row = conversationSummarySchema.parse(await response.json());
          active.current = row;
          saved.current = snapshot;
          remember(row);
          setStatus("ready");
          return true;
        } catch (error) {
          setStatus(
            error instanceof Response &&
              (error.status === 409 || error.status === 404)
              ? "conflict"
              : "error",
          );
          return false;
        } finally {
          pending.current = null;
        }
      })();
      pending.current = operation;
      return operation;
    },
    [remember],
  );

  const loadHistory = useCallback(async () => {
    setReady(false);
    setStatus("loading");
    try {
      if (pending.current) await pending.current;
      const response = await fetch(endpoint);
      if (!response.ok) throw response;
      const rows = conversationSummarySchema
        .array()
        .max(50)
        .parse(await response.json());
      setConversations(rows);
      const selected =
        rows.find((row) => row.id === active.current?.id) ?? rows[0];
      apply(await fetchConversation(selected?.id));
    } catch {
      setStatus("error");
      setReady(Boolean(active.current));
    }
  }, [apply]);

  useEffect(() => {
    if (!enabled || initialized.current) return;
    initialized.current = true;
    void loadHistory();
  }, [enabled, loadHistory]);

  useEffect(() => {
    if (!ready || !id || serialized === saved.current) return;
    const timer = setTimeout(() => {
      void save();
    }, 500);
    return () => clearTimeout(timer);
  }, [serialized, ready, id, save]);

  const open = async (target?: string) => {
    if (!(await save())) return;
    setReady(false);
    setStatus("loading");
    try {
      apply(await fetchConversation(target));
    } catch {
      setStatus("error");
      setReady(Boolean(active.current));
    }
  };
  const remove = async () => {
    if (!(await save()) || !active.current) return;
    setReady(false);
    setStatus("loading");
    const current = active.current;
    try {
      const response = await fetch(endpoint, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: current.id, revision: current.revision }),
      });
      if (!response.ok) throw response;
      active.current = null;
      saved.current = latest.current = "[]";
      setId("");
      loadHandler.current([]);
      setConversations((previous) =>
        previous.filter((row) => row.id !== current.id),
      );
      apply(await fetchConversation());
    } catch (error) {
      setStatus(
        error instanceof Response &&
          (error.status === 409 || error.status === 404)
          ? "conflict"
          : "error",
      );
      setReady(Boolean(active.current));
    }
  };
  return {
    conversations,
    id,
    ready,
    status,
    save,
    open,
    remove,
    reload: loadHistory,
  };
}
