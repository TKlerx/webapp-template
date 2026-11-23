"use client";

import type { ComponentProps } from "react";
import { StickToBottom } from "use-stick-to-bottom";
import { cn } from "@/lib/utils";

// Adapted from the repair assistant's AI Elements conversation component.
export function Conversation({
  className,
  ...props
}: ComponentProps<typeof StickToBottom>) {
  return (
    <StickToBottom
      role="log"
      initial="instant"
      resize="instant"
      className={cn("relative min-h-0 flex-1 overflow-y-auto", className)}
      {...props}
    />
  );
}

export function ConversationContent({
  className,
  ...props
}: ComponentProps<typeof StickToBottom.Content>) {
  return (
    <StickToBottom.Content
      className={cn("flex flex-col gap-5 p-5", className)}
      {...props}
    />
  );
}
