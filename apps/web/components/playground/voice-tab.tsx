"use client";

import * as React from "react";
import {
  CheckIcon,
  WarningCircleIcon,
  MicrophoneIcon,
  MicrophoneSlashIcon,
  PhoneXIcon,
  CopyIcon,
} from "@phosphor-icons/react";
import { useVoiceSession, type VoiceSessionState } from "@/hooks/use-voice-session";
import {
  ChatScroller,
  ChatScrollerItem,
  ChatMessage,
  ChatComposer,
  ChatEmptyState,
  VoiceIndicator,
  VoiceModeIcon,
  type ChatMessageData,
} from "@/components/chat";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

const STATE_LABEL: Record<VoiceSessionState, string> = {
  idle: "Idle",
  connecting: "Connecting…",
  listening: "Listening",
  thinking: "Thinking",
  speaking: "Speaking",
  error: "Error",
  ended: "Call ended",
};

function isLive(state: VoiceSessionState): boolean {
  return (
    state === "connecting" ||
    state === "listening" ||
    state === "thinking" ||
    state === "speaking"
  );
}

function formatCallDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

function VoiceTab({
  projectId,
  agentId,
}: {
  projectId: string;
  agentId: string;
}) {
  const voice = useVoiceSession({ projectId, agentId });
  const { state, duration, isMuted, transcript, partial, toolCalls, error, endReason } = voice;

  const live = isLive(state);
  const [text, setText] = React.useState("");
  const [copied, setCopied] = React.useState(false);

  const handleSendToVoice = React.useCallback(
    (value: string) => {
      setText("");
      voice.sendText(value);
    },
    [voice]
  );

  const handleCopyTranscript = React.useCallback(() => {
    if (transcript.length === 0) return;
    const header = duration > 0 ? `Call Duration: ${formatCallDuration(duration)}\n\n` : "";
    const formatted =
      header +
      transcript
        .map((t) => `${t.speaker === "user" ? "User" : "Agent"}: ${t.text}`)
        .join("\n\n");
    navigator.clipboard.writeText(formatted);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [transcript, duration]);

  const transcriptLines: ChatMessageData[] = React.useMemo(() => {
    const lines: ChatMessageData[] = transcript.map((line) => ({
      id: line.id,
      role: line.speaker === "user" ? "user" : "assistant",
      content: line.text,
    }));
    if (partial?.text) {
      lines.push({
        id: "partial",
        role: partial.speaker === "user" ? "user" : "assistant",
        content: partial.text,
        isStreaming: true,
      });
    }
    return lines;
  }, [transcript, partial]);

  const showTranscript = transcriptLines.length > 0;

  const statusSubtext = React.useMemo(() => {
    if (state === "connecting") return "Connecting to agent voice server…";
    if (state === "listening") return isMuted ? "Microphone muted — unmute to speak" : "Listening… speak out loud or type below";
    if (state === "thinking") return "Agent is thinking…";
    if (state === "speaking") return "Agent is speaking…";
    return "";
  }, [state, isMuted]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Top status bar when transcript is visible and call is live */}
      {live && showTranscript && (
        <div className="flex flex-col border-b border-border bg-card/60 px-4 py-2.5 backdrop-blur-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <VoiceIndicator state={state} size={32} />
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-foreground">
                    {isMuted && (state === "listening" || state === "speaking")
                      ? "Muted"
                      : STATE_LABEL[state]}
                  </span>
                  <span className="rounded bg-muted/70 px-1.5 py-0.5 font-mono text-[11px] font-medium text-muted-foreground">
                    {formatCallDuration(duration)}
                  </span>
                </div>
                <span className="text-[11px] text-muted-foreground">{statusSubtext}</span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {(state === "listening" || state === "speaking") && (
                <Button
                  type="button"
                  variant={isMuted ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => voice.mute(!isMuted)}
                  className="gap-1.5 text-xs"
                >
                  {isMuted ? (
                    <>
                      <MicrophoneSlashIcon className="size-3.5 text-destructive" />
                      Unmute
                    </>
                  ) : (
                    <>
                      <MicrophoneIcon className="size-3.5" />
                      Mute
                    </>
                  )}
                </Button>
              )}
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={voice.stop}
                className="gap-1.5 text-xs"
              >
                <PhoneXIcon className="size-3.5" />
                End Call
              </Button>
            </div>
          </div>

          {toolCalls.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5 pt-1">
              {toolCalls.map((tc) => (
                <span
                  key={tc.id}
                  className="inline-flex items-center gap-1.5 border border-border bg-background px-2 py-0.5 text-[11px] text-muted-foreground"
                >
                  {tc.status === "running" ? (
                    <Spinner className="size-3 text-primary" />
                  ) : tc.status === "error" ? (
                    <WarningCircleIcon className="size-3 text-destructive" />
                  ) : (
                    <CheckIcon className="size-3" />
                  )}
                  <span className="font-medium text-foreground/80">
                    {tc.name ?? "Tool"}
                  </span>
                  {tc.summary ? (
                    <span className="max-w-56 truncate">{tc.summary}</span>
                  ) : null}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Main viewport */}
      <div className="flex min-h-0 flex-1 flex-col">
        {showTranscript ? (
          <ChatScroller>
            {transcriptLines.map((line) => (
              <ChatScrollerItem key={line.id}>
                <ChatMessage message={line} />
              </ChatScrollerItem>
            ))}
          </ChatScroller>
        ) : live ? (
          /* Centered hero state while live call has no transcript yet */
          <div className="flex flex-1 flex-col items-center justify-center gap-5 p-6 text-center">
            <VoiceIndicator state={state} size={128} />
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-foreground">
                  <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                  {isMuted && (state === "listening" || state === "speaking")
                    ? "Muted"
                    : STATE_LABEL[state]}
                </span>
                <span className="rounded-full border border-border bg-muted/70 px-2.5 py-0.5 font-mono text-xs font-medium text-foreground">
                  {formatCallDuration(duration)}
                </span>
              </div>
              <p className="max-w-sm text-sm text-muted-foreground">{statusSubtext}</p>
            </div>

            {/* In-hero call controls */}
            <div className="flex items-center gap-2 pt-2">
              <Button
                type="button"
                variant={isMuted ? "secondary" : "outline"}
                size="sm"
                onClick={() => voice.mute(!isMuted)}
                className="gap-2"
              >
                {isMuted ? (
                  <>
                    <MicrophoneSlashIcon className="size-4 text-destructive" />
                    Unmute Mic
                  </>
                ) : (
                  <>
                    <MicrophoneIcon className="size-4" />
                    Mute Mic
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={voice.stop}
                className="gap-2"
              >
                <PhoneXIcon className="size-4" />
                End Call
              </Button>
            </div>

            {toolCalls.length > 0 && (
              <div className="mt-4 flex max-w-md flex-wrap items-center justify-center gap-1.5">
                {toolCalls.map((tc) => (
                  <span
                    key={tc.id}
                    className="inline-flex items-center gap-1.5 border border-border bg-card px-2 py-1 text-[11px] text-muted-foreground"
                  >
                    {tc.status === "running" ? (
                      <Spinner className="size-3 text-primary" />
                    ) : tc.status === "error" ? (
                      <WarningCircleIcon className="size-3 text-destructive" />
                    ) : (
                      <CheckIcon className="size-3" />
                    )}
                    <span className="font-medium text-foreground/80">{tc.name ?? "Tool"}</span>
                    {tc.summary ? <span className="max-w-44 truncate">{tc.summary}</span> : null}
                  </span>
                ))}
              </div>
            )}
          </div>
        ) : (
          <ChatEmptyState
            title="Voice preview"
            description="Talk to your agent out loud — it runs with the same tools and knowledge as the chat tab. Start a call to begin."
          />
        )}
      </div>

      {/* Bottom controls / composer */}
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-2 px-4 pt-2 pb-4">
        {error && (
          <Alert variant="destructive">
            <AlertTitle>Voice call failed</AlertTitle>
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        )}

        {state === "ended" && (
          <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/40 p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-foreground">
                  Call ended {endReason ? `(${endReason})` : ""}
                </span>
                {duration > 0 && (
                  <span className="inline-flex items-center rounded border border-border bg-background px-2 py-0.5 font-mono text-xs font-medium text-muted-foreground">
                    Call time: {formatCallDuration(duration)}
                  </span>
                )}
              </div>
              {transcript.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyTranscript}
                  className="h-7 gap-1 text-xs"
                >
                  {copied ? (
                    <>
                      <CheckIcon className="size-3.5 text-emerald-500" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <CopyIcon className="size-3.5" />
                      Copy transcript
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        )}

        {live ? (
          <ChatComposer
            value={text}
            onChange={setText}
            onSend={() => {}}
            isVoiceActive
            onStopVoice={voice.stop}
            onSendToVoice={handleSendToVoice}
            disabled={state === "connecting"}
            placeholder="Type to voice…"
          />
        ) : (
          <Button
            type="button"
            variant="default"
            onClick={() => {
              setText("");
              void voice.start();
            }}
            className="w-full gap-2"
          >
            <VoiceModeIcon />
            {state === "ended" ? "Start new voice call" : "Start voice call"}
          </Button>
        )}
      </div>
    </div>
  );
}

export { VoiceTab };
