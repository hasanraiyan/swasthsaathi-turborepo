"use client";

import * as React from "react";
import {
  ArrowUpIcon,
  SquareIcon,
  PhoneXIcon,
} from "@phosphor-icons/react";
import { InputGroup, InputGroupTextarea, InputGroupAddon, InputGroupButton } from "@/components/ui/input-group";

// Same "start voice mode" glyph NotebookChat.js's ComposerForm uses (a
// waveform, not a generic microphone) — inlined to match it exactly rather
// than substituting a similar-but-different icon from phosphor's set.
// VoiceTab's "Start voice call" button renders this; the composer itself no
// longer shows a voice-mode toggle (nothing in the Playground wires it, so
// it was a dead button), so VoiceModeIcon lives here only as a shared glyph.
function VoiceModeIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      {...props}
    >
      <path d="M2 10v3" />
      <path d="M6 6v11" />
      <path d="M10 3v18" />
      <path d="M14 8v8" />
      <path d="M18 5v14" />
      <path d="M22 10v3" />
    </svg>
  );
}

/**
 * Auto-resizing composer. The trailing action row is ALWAYS present, so the
 * composer keeps one steady height whether it is idle, streaming text, or
 * mid-voice-call — dropping the row when a surface has no voice button used
 * to shrink the idle composer into a short stub, so it is never conditionally
 * unmounted. Which action the row shows is computed by the caller:
 *
 *   streaming   → stop generating
 *   voice live  → stop the call, or send the typed text into the call
 *   default     → send message (dimmed until there is text to send)
 *
 * Deliberately no voice-mode toggle on the composer itself: the surfaces in
 * this app that support voice run it in their own tab (VoiceTab), so an idle
 * "start voice" waveform would be a dead button. VoiceTab drives the live
 * states via isVoiceActive instead.
 *
 * The empty-state send is dimmed with `pointer-events-none` + reduced opacity
 * rather than a native `disabled` attribute — InputGroup greys out its WHOLE
 * contents via `has-disabled` when any child is disabled, which would wash
 * out the text field too.
 *
 * Deliberately no custom rounding/background overrides here — `InputGroup`/
 * `InputGroupButton` already carry this app's actual look (sharp
 * `rounded-none` everywhere, `Button`'s own variant colors), stacking a
 * borrowed rounded-pill/rounded-full treatment on top of them is exactly
 * what looked inconsistent and over-padded before.
 */
function ChatComposer({
  value,
  onChange,
  onSend,
  onStop,
  onStopVoice,
  onSendToVoice,
  isStreaming = false,
  isVoiceActive = false,
  disabled = false,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop?: () => void;
  onStopVoice?: () => void;
  onSendToVoice?: (text: string) => void;
  isStreaming?: boolean;
  isVoiceActive?: boolean;
  disabled?: boolean;
  placeholder?: string;
}) {
  const trimmed = value.trim();

  const submit = () => {
    if (!trimmed) return;
    if (isVoiceActive) {
      onSendToVoice?.(trimmed);
    } else if (!isStreaming) {
      onSend();
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <InputGroup>
        <InputGroupTextarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={placeholder ?? (isVoiceActive ? "Type to voice…" : "Ask anything…")}
          rows={1}
          disabled={disabled}
          className="max-h-40"
        />

        <InputGroupAddon align="block-end" className="justify-end">
          {isStreaming ? (
            <InputGroupButton
              type="button"
              variant="secondary"
              size="icon-sm"
              aria-label="Stop generating"
              onClick={onStop}
            >
              <SquareIcon weight="fill" />
            </InputGroupButton>
          ) : isVoiceActive ? (
            <div className="flex items-center gap-1.5">
              {trimmed ? (
                <InputGroupButton type="submit" variant="default" size="icon-sm" aria-label="Send to voice">
                  <ArrowUpIcon />
                </InputGroupButton>
              ) : null}
              <InputGroupButton
                type="button"
                variant="destructive"
                size="icon-sm"
                aria-label="Stop voice"
                onClick={onStopVoice}
              >
                <PhoneXIcon />
              </InputGroupButton>
            </div>
          ) : (
            <InputGroupButton
              type="submit"
              variant="default"
              size="icon-sm"
              aria-label="Send message"
              // Dim but not natively disabled (see note above): pointer-events
              // off so an empty click no-ops and focuses the field instead.
              className={trimmed ? undefined : "pointer-events-none opacity-40"}
            >
              <ArrowUpIcon />
            </InputGroupButton>
          )}
        </InputGroupAddon>
      </InputGroup>
    </form>
  );
}

export { ChatComposer, VoiceModeIcon };
