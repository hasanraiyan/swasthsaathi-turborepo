"use client";

import * as React from "react";
import { ItemGroup } from "@/components/ui/item";
import { ToolCallCard } from "./tool-call-card";
import { McpAppRenderer } from "./mcp-app-renderer";
import type { ChatToolCall, ChatTodo } from "./types";

function ToolCallTrace({
  toolCalls,
  todos,
  projectId,
  onOpenSubagent,
  onOpenWorkspaceFile,
  onSendMessage,
}: {
  toolCalls: ChatToolCall[];
  todos?: ChatTodo[];
  projectId?: string;
  onOpenSubagent?: (toolCallId: string) => void;
  /** present_file's card calls this when the user clicks its Open button — no longer an auto-fired side effect. */
  onOpenWorkspaceFile?: (path: string) => void;
  onSendMessage?: (text: string) => void;
}) {
  if (!toolCalls.length) return null;

  // Group consecutive regular tool calls together in ItemGroup,
  // and render MCP App tool calls as prominent standalone blocks.
  const elements: React.ReactNode[] = [];
  let currentGroup: ChatToolCall[] = [];

  const flushGroup = () => {
    if (currentGroup.length > 0) {
      const groupKey = currentGroup[0].id;
      elements.push(
        <ItemGroup key={`group-${groupKey}`} className="gap-1.5!">
          {currentGroup.map((tc) => (
            <ToolCallCard
              key={tc.id}
              toolCall={tc}
              todos={todos}
              onOpenSubagent={onOpenSubagent}
              onOpenFile={onOpenWorkspaceFile}
            />
          ))}
        </ItemGroup>
      );
      currentGroup = [];
    }
  };

  for (const tc of toolCalls) {
    if (tc.mcpApp?.resourceUri || tc.mcpApp?.initialHtml) {
      flushGroup();
      elements.push(
        <div key={`mcp-app-${tc.id}`} className="w-full my-1.5">
          <McpAppRenderer
            projectId={projectId || ""}
            mcpId={tc.mcpApp.mcpId || ""}
            resourceUri={tc.mcpApp.resourceUri || ""}
            initialHtml={tc.mcpApp.initialHtml}
            toolName={tc.name}
            tool={tc}
            onSendMessage={onSendMessage}
          />
        </div>
      );
    } else {
      currentGroup.push(tc);
    }
  }
  flushGroup();

  return <div className="flex flex-col gap-1.5 mb-2">{elements}</div>;
}

export { ToolCallTrace };

