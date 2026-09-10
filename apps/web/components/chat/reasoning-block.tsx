"use client";

import * as React from "react";
import { CaretDownIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { MessageMarkdown } from "./message-markdown";
import type { ChatReasoning } from "./types";

function formatElapsed(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${seconds % 60}s`;
}

/**
 * One reasoning/thinking block, adapted from the old dashboard's
 * ReasoningBubble (itself from JimLiu/claude-agent-kit, MIT): an italic
 * collapsible header that auto-opens while the block is streaming and
 * auto-collapses once the backend stamps a duration, unless the user toggles
 * it. The thought text renders muted below a hairline so the final answer
 * stays the visual focus.
 */
function ReasoningBlock({
  reasoning,
  className,
}: {
  reasoning: ChatReasoning;
  className?: string;
}) {
  const isStreaming = !!reasoning.isStreaming;

  // Derive open state from the live stream unless the user flips it manually;
  // manualOpen starts null so the first render follows isStreaming.
  const [manualOpen, setManualOpen] = React.useState<boolean | null>(null);
  const open = manualOpen ?? isStreaming;

  // Live "Thought · Ns" label while a block is still streaming (no duration
  // stamped yet) — the same ticker the old ReasoningBubble kept running.
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (!isStreaming) return;
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [isStreaming]);

  const startedAt =
    typeof reasoning.startedAt === "number" ? reasoning.startedAt : now;
  const liveElapsed = formatElapsed(Math.max(0, now - startedAt));
  const doneElapsed =
    typeof reasoning.durationMs === "number"
      ? formatElapsed(reasoning.durationMs)
      : null;

  const hasContent = !!reasoning.content?.trim();
  const headerLabel = hasContent
    ? `Thought${doneElapsed ? ` for ${doneElapsed}` : ""}`
    : "Thinking";

  return (
    <div
      className={cn(
        "max-w-full text-muted-foreground select-text",
        className
      )}
    >
      <button
        type="button"
        onClick={() => setManualOpen(!open)}
        aria-expanded={open}
        className="group flex cursor-pointer items-center gap-1.5 rounded-sm px-1 py-0.5 text-xs font-medium italic opacity-80 transition-opacity select-none hover:opacity-100 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        {isStreaming ? (
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="inline-flex items-center gap-0.5">
              <span className="size-1 rounded-full bg-current animate-bounce [animation-delay:-0.3s]" />
              <span className="size-1 rounded-full bg-current animate-bounce [animation-delay:-0.15s]" />
              <span className="size-1 rounded-full bg-current animate-bounce" />
            </span>
            <span className="font-medium tracking-tight">Thinking</span>
          </span>
        ) : (
          <span className="font-medium tracking-tight">{headerLabel}</span>
        )}
        <CaretDownIcon
          className={cn("size-3 transition-transform", open && "rotate-180")}
        />
      </button>

      {open ? (
        <div className="mt-1 ml-1 border-l-2 border-muted-foreground/20 pl-3">
          {hasContent ? (
            <MessageMarkdown muted content={reasoning.content} />
          ) : (
            <span className="text-xs italic opacity-70">
              {isStreaming ? `Started ${liveElapsed} ago` : "No reasoning captured."}
            </span>
          )}
        </div>
      ) : null}
    </div>
  );
}

export { ReasoningBlock };
