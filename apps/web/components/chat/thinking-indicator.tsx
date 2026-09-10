"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

// Claude Code's own spinner — cycles forward through this sequence then
// back, never a generic spin icon. Exact frame set from the reference
// (NotebookChat.js's AssistantThinking).
const CLAUDE_SPINNER_BASE = ["·", "✢", "*", "✶", "✻", "✽"];
const CLAUDE_SPINNER_FRAMES = [
  ...CLAUDE_SPINNER_BASE,
  ...[...CLAUDE_SPINNER_BASE].reverse(),
];

/**
 * Shown for the gap before the first token arrives — Claude Code's exact
 * spinner (no avatar/icon), with a live elapsed timer once it's taking a
 * while, same as claude.ai and the NotebookChat.js reference.
 */
function ThinkingIndicator({ className }: { className?: string }) {
  const [frame, setFrame] = React.useState(0);
  const [elapsed, setElapsed] = React.useState(0);

  React.useEffect(() => {
    const id = setInterval(
      () => setFrame((f) => (f + 1) % CLAUDE_SPINNER_FRAMES.length),
      120
    );
    return () => clearInterval(id);
  }, []);

  React.useEffect(() => {
    const start = Date.now();
    const id = setInterval(
      () => setElapsed(Math.floor((Date.now() - start) / 1000)),
      1000
    );
    return () => clearInterval(id);
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Thinking"
      className={cn(
        "inline-flex items-center gap-2 py-2 text-xs leading-none text-muted-foreground select-none",
        className
      )}
    >
      <span className="w-4 text-center font-mono text-sm text-foreground" aria-hidden>
        {CLAUDE_SPINNER_FRAMES[frame]}
      </span>
      <span className="font-medium tracking-tight">
        Thinking
        {elapsed > 2 ? ` · ${elapsed}s` : <span className="animate-pulse">…</span>}
      </span>
    </div>
  );
}

export { ThinkingIndicator };
