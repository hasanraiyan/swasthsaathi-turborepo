"use client";

import * as React from "react";
import { Message, MessageContent } from "@/components/ui/message";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { MessageMarkdown } from "./message-markdown";
import { ToolCallTrace } from "./tool-call-trace";
import { ReasoningBlock } from "./reasoning-block";
import { ThinkingIndicator } from "./thinking-indicator";
import { CopyButton } from "./copy-button";
import type { ChatMessageData, ChatTodo } from "./types";

/**
 * Role-based dispatch: the user's own turn is bubbled (align="end"),
 * matching Claude's own layout where only the human side gets bubble
 * chrome; the assistant's turn renders as plain content plus its tool-call
 * trace, no bubble — same split NotebookChat.js's ChatMessage uses.
 */
function ChatMessage({
  message,
  todos,
  projectId,
  onOpenSubagent,
  onOpenWorkspaceFile,
  onSendMessage,
}: {
  message: ChatMessageData;
  todos?: ChatTodo[];
  projectId?: string;
  onOpenSubagent?: (toolCallId: string) => void;
  onOpenWorkspaceFile?: (path: string) => void;
  onSendMessage?: (text: string) => void;
}) {
  if (message.role === "user") {
    return (
      <Message align="end">
        <MessageContent>
          <Bubble align="end">
            <BubbleContent>{message.content}</BubbleContent>
          </Bubble>
        </MessageContent>
      </Message>
    );
  }

  const hasToolCalls = (message.toolCalls?.length ?? 0) > 0;
  const reasoning = message.reasoning ?? [];
  // A live reasoning block auto-opens with its own animated header, so the
  // standalone "Thinking" gap indicator below would read as a duplicate —
  // show it only when nothing reasoning-related is already indicating.
  const hasLiveReasoning = reasoning.some((r) => r.isStreaming);
  const isEmptyStreaming =
    !!message.isStreaming && !message.content?.trim() && !hasToolCalls;

  return (
    <Message align="start" className="group/chat-message">
      <MessageContent>
        {reasoning.length > 0 && (
          <div className="mb-1 flex flex-col gap-2">
            {reasoning.map((r) => (
              <ReasoningBlock key={r.id} reasoning={r} />
            ))}
          </div>
        )}

        {hasToolCalls && (
          <ToolCallTrace
            toolCalls={message.toolCalls!}
            todos={todos}
            projectId={projectId}
            onOpenSubagent={onOpenSubagent}
            onOpenWorkspaceFile={onOpenWorkspaceFile}
            onSendMessage={onSendMessage}
          />
        )}

        {isEmptyStreaming && !hasLiveReasoning ? (
          <ThinkingIndicator />
        ) : message.content?.trim() ? (
          <MessageMarkdown content={message.content || ""} />
        ) : null}

        {!message.isStreaming && message.content && (
          <div className="opacity-0 transition-opacity group-hover/chat-message:opacity-100">
            <CopyButton text={message.content} label="Copy message" />
          </div>
        )}
      </MessageContent>
    </Message>
  );
}

export { ChatMessage };
