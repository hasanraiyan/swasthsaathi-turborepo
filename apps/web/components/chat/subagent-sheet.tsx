"use client";

import * as React from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { ChatMessage } from "./chat-message";
import type { ChatMessageData } from "./types";

/**
 * Slide-over replaying one subagent (`task` tool call)'s own message
 * timeline — reuses ChatMessage/ToolCallTrace rather than a separate
 * render path, same as NotebookChat.js's SubagentDialog does. On mobile it
 * comes up as a bottom sheet instead of a side drawer — a right-edge
 * drawer at phone widths is basically a full-screen cover with nowhere
 * natural to swipe it away from.
 */
function SubagentSheet({
  open,
  onOpenChange,
  messages,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messages: ChatMessageData[];
}) {
  const isMobile = useIsMobile();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className="w-full sm:max-w-lg data-[side=bottom]:min-h-[60%] data-[side=bottom]:max-h-[85vh]"
      >
        <SheetHeader className="border-b border-border">
          <SheetTitle>Subagent</SheetTitle>
          <SheetDescription>
            A helper the agent delegated a step to — its own conversation.
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="flex flex-col gap-6">
            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export { SubagentSheet };
