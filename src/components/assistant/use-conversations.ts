"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  conversationSummarySchema,
  savedConversationSchema,
  type ConversationSummary,
  type SavedConversation,
  savedTurnsSchema,
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
  userId: string,
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
  const unresolvedConflict = useRef(false);
  const attempted = useRef<{ revision: number; snapshot: string } | null>(null);
  const journalKey = `assistant-draft:${userId}`;
  const writeJournal = useCallback(
    (row: ConversationSummary, snapshot: string) => {
      if (unresolvedConflict.current) return;
      try {
        if (snapshot === saved.current) sessionStorage.removeItem(journalKey);
        else
          sessionStorage.setItem(
            journalKey,
            JSON.stringify({
              id: row.id,
              revision: row.revision,
              snapshot,
              attempt: attempted.current,
            }),
          );
      } catch {
        // Saving to the server still works when tab storage is unavailable.
      }
    },
    [journalKey],
  );
  const initialized = useRef(false);
  const retryAction = useRef<(() => Promise<void>) | null>(null);
  const pending = useRef<Promise<boolean> | null>(null);
  const loadHandler = useRef(onLoad);
  const serialized = JSON.stringify(turns);
  useEffect(() => {
    loadHandler.current = onLoad;
  }, [onLoad]);
  useEffect(() => {
    latest.current = serialized;
    if (ready && active.current) writeJournal(active.current, serialized);
  }, [serialized, ready, writeJournal]);

  const remember = useCallback((row: ConversationSummary) => {
    setConversations((previous) =>
      [row, ...previous.filter((item) => item.id !== row.id)].slice(0, 50),
    );
  }, []);
  const apply = useCallback(
    (row: SavedConversation) => {
      retryAction.current = null;
      active.current = row;
      attempted.current = null;
      unresolvedConflict.current = false;
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
      if (!current || unresolvedConflict.current) return false;
      const snapshot = attempted.current?.snapshot ?? latest.current;
      if (snapshot === saved.current) {
        setStatus("ready");
        return true;
      }
      attempted.current = { revision: current.revision, snapshot };
      writeJournal(current, latest.current);
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
          attempted.current = null;
          saved.current = snapshot;
          writeJournal(row, latest.current);
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
      const ok = await operation;
      return ok && latest.current !== saved.current ? flush() : ok;
    },
    [remember, writeJournal],
  );

  const loadHistory = useCallback(
    async (recoverDraft = true) => {
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
        let journal:
          | {
              id: string;
              revision: number;
              snapshot: string;
              attempt?: { revision: number; snapshot: string };
            }
          | undefined;
        if (recoverDraft) {
          try {
            journal = JSON.parse(
              sessionStorage.getItem(journalKey) ?? "null",
            ) as typeof journal;
          } catch {
            // The server remains the source of saved history.
          }
        }
        const selected =
          rows.find((row) => row.id === (active.current?.id ?? journal?.id)) ??
          rows[0];
        const row = await fetchConversation(selected?.id);
        apply(row);
        if (journal?.id !== row.id) return;
        let recovered;
        try {
          recovered = savedTurnsSchema.safeParse(JSON.parse(journal.snapshot));
        } catch {
          return;
        }
        if (!recovered.success) return;
        const committedAttempt =
          journal.attempt?.revision === row.revision - 1 &&
          journal.attempt.snapshot === saved.current;
        latest.current = JSON.stringify(recovered.data);
        loadHandler.current(recovered.data);
        if (row.revision !== journal.revision && !committedAttempt) {
          unresolvedConflict.current = true;
          setStatus("conflict");
        }
      } catch {
        setStatus("error");
        setReady(Boolean(active.current));
      }
    },
    [apply, journalKey],
  );

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
    retryAction.current = () => open(target);
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
    retryAction.current = null;
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
    journalTurns: (turns: SavedTurn[]) => {
      if (active.current) writeJournal(active.current, JSON.stringify(turns));
    },
    id,
    ready,
    status,
    save,
    open,
    remove,
    reload: async () => {
      try {
        sessionStorage.removeItem(journalKey);
      } catch {
        /* Storage may be unavailable. */
      }
      await loadHistory(false);
    },
    retry: async () => {
      if (retryAction.current) await retryAction.current();
      else if (ready) await save();
      else await loadHistory();
    },
  };
}
