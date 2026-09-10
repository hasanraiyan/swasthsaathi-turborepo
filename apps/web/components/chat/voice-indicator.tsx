"use client";

import * as React from "react";
import { Orb, type OrbState } from "orb-ui";
import { cn } from "@/lib/utils";
import type { VoiceCallState } from "./types";

// Orb's own state union has no "ended" — a finished call reads as idle.
function toOrbState(state: VoiceCallState): OrbState {
  return state === "ended" ? "idle" : state;
}

/**
 * The animated voice-state orb — same `orb-ui` package
 * NotebookVoiceInline.js (the reference) uses, controlled rather than
 * adapter-driven since state/volume already come from `useVoice()`.
 */
function VoiceIndicator({
  state,
  volume = 0,
  size = 28,
  className,
}: {
  state: VoiceCallState;
  volume?: number;
  size?: number;
  className?: string;
}) {
  const isPulsing = state === "listening" || state === "speaking";
  return (
    <div
      className={cn(
        "flex animate-in fade-in zoom-in-95 items-center justify-center overflow-hidden duration-300",
        className
      )}
    >
      <div className={cn("flex items-center justify-center", isPulsing && "animate-pulse")}>
        <Orb
          state={toOrbState(state)}
          theme="cloud"
          size={size}
          interactive={false}
          aria-label={`Voice ${state}`}
        />
      </div>
    </div>
  );
}

export { VoiceIndicator };
