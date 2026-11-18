"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { ArrowUp, MessageSquare, Mic, MicOff, Square, X } from "lucide-react";
import { Popover } from "radix-ui";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Conversation,
  ConversationContent,
} from "@/components/ai-elements/conversation";
import { Button } from "@/components/shadcn/button";
import { Textarea } from "@/components/shadcn/textarea";
import { assistantPages, assistantPageSchema } from "@/lib/assistant";
import { withBasePath } from "@/lib/base-path";
import { cn } from "@/lib/utils";
import type { AssistantMessage } from "@/services/assistant";
import { useVoice } from "./use-voice";

export function Assistant() {
  const t = useTranslations("assistant");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [voiceBusy, setVoiceBusy] = useState(false);
  const speak = useRef<(text: string) => void>(() => {});
  const transport = useMemo(
    () =>
      new DefaultChatTransport<AssistantMessage>({
        api: withBasePath("/api/assistant/chat"),
        prepareSendMessagesRequest: ({ messages }) => ({
          body: {
            messages: messages
              .map((message) => ({
                id: message.id,
                role: message.role,
                parts: message.parts
                  .filter((part) => part.type === "text")
                  .map((part) => ({ type: "text", text: part.text })),
              }))
              .filter((message) => message.parts.length > 0)
              .slice(-24),
          },
        }),
      }),
    [],
  );
  const { messages, sendMessage, status, error, stop } =
    useChat<AssistantMessage>({
      transport,
      onFinish: ({ message, isAbort, isError }) => {
        if (isAbort || isError) return;
        for (const part of message.parts) {
          if (
            part.type === "tool-navigate" &&
            part.state === "output-available"
          ) {
            const page = assistantPageSchema.safeParse(part.output.page);
            if (page.success) router.push(assistantPages[page.data]);
          }
        }
        speak.current(
          message.parts
            .filter((part) => part.type === "text")
            .map((part) => part.text)
            .join("\n"),
        );
      },
    });
  const busy = status === "streaming" || status === "submitted";
  const voice = useVoice((text) => {
    if (busy) {
      setVoiceBusy(true);
      return;
    }
    setVoiceBusy(false);
    void sendMessage({ text });
  });
  useEffect(() => {
    speak.current = voice.speak;
  }, [voice.speak]);

  return (
    <Popover.Root
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        if (!value) voice.stop();
      }}
    >
      <Popover.Trigger asChild>
        <Button
          className="fixed bottom-12 right-5 z-50 rounded-full shadow-lg"
          size="lg"
          aria-label={t("open")}
        >
          <MessageSquare aria-hidden="true" />
          {t("title")}
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          side="top"
          sideOffset={12}
          onInteractOutside={(event) => event.preventDefault()}
          className="z-50 flex h-[min(38rem,calc(100dvh-8rem))] w-[min(26rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-border bg-background text-foreground shadow-2xl"
          aria-label={t("title")}
        >
          <header className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold">{t("title")}</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("subtitle")}
              </p>
            </div>
            <Popover.Close asChild>
              <Button variant="ghost" size="icon" aria-label={t("close")}>
                <X />
              </Button>
            </Popover.Close>
          </header>
          <Conversation aria-label={t("conversation")}>
            <ConversationContent>
              {messages.length === 0 && (
                <p className="py-6 text-sm text-muted-foreground">
                  {t("empty")}
                </p>
              )}
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex flex-col gap-2 text-sm",
                    message.role === "user" && "items-end",
                  )}
                >
                  <span className="text-xs text-muted-foreground">
                    {message.role === "user" ? t("you") : t("title")}
                  </span>
                  {message.parts.map((part, index) => {
                    if (part.type === "text")
                      return (
                        <p
                          key={index}
                          className={cn(
                            "whitespace-pre-wrap break-words leading-relaxed",
                            message.role === "user" &&
                              "max-w-[90%] rounded-lg bg-secondary px-3 py-2",
                          )}
                        >
                          {part.text}
                        </p>
                      );
                    if (part.type.startsWith("tool-"))
                      return (
                        <span
                          key={index}
                          className="text-xs text-muted-foreground"
                        >
                          {t("tool")}
                        </span>
                      );
                    return null;
                  })}
                </div>
              ))}
              {busy && (
                <p role="status" className="text-xs text-muted-foreground">
                  {t("thinking")}
                </p>
              )}
            </ConversationContent>
          </Conversation>
          <footer className="border-t border-border p-4">
            {error && (
              <p role="alert" className="mb-3 text-sm text-destructive">
                {t("error")}
              </p>
            )}
            {voice.error && (
              <p role="alert" className="mb-3 text-sm text-destructive">
                {t("voiceError")}
              </p>
            )}
            {voiceBusy && (
              <p role="status" className="mb-3 text-xs text-muted-foreground">
                {t("wait")}
              </p>
            )}
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (!draft.trim() || busy) return;
                void sendMessage({ text: draft.trim() });
                setDraft("");
              }}
              className="flex flex-col gap-3"
            >
              <Textarea
                aria-label={t("message")}
                placeholder={t("placeholder")}
                value={draft}
                maxLength={6000}
                onChange={(event) => setDraft(event.target.value)}
                rows={2}
              />
              <div className="flex items-center justify-between gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-pressed={voice.status !== "off"}
                  onClick={() => {
                    if (voice.status === "off") void voice.start();
                    else voice.stop();
                  }}
                >
                  {voice.status === "off" ? <Mic /> : <MicOff />}
                  {voice.status === "connecting"
                    ? t("connecting")
                    : voice.status === "listening"
                      ? t("listening")
                      : t("voice")}
                </Button>
                {busy ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label={t("stop")}
                    onClick={() => {
                      void stop();
                      voice.stop();
                    }}
                  >
                    <Square />
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    size="icon"
                    aria-label={t("send")}
                    disabled={!draft.trim()}
                  >
                    <ArrowUp />
                  </Button>
                )}
              </div>
            </form>
          </footer>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
