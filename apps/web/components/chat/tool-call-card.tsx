"use client";

import * as React from "react";
import {
  WrenchIcon,
  RobotIcon,
  WarningCircleIcon,
  CheckCircleIcon,
  CaretDownIcon,
  FileTextIcon,
} from "@phosphor-icons/react";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { Item, ItemMedia, ItemContent, ItemTitle, ItemDescription } from "@/components/ui/item";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TodoChecklist } from "./todo-checklist";
import { AgentUpsertBody, summarizeUpsert, type AgentUpsertSummary } from "./agent-upsert-card";
import { LsDirectoryCard } from "./tool-cards/ls-directory-card";
import { ReadFileCard } from "./tool-cards/read-file-card";
import { GrepResultsView } from "./tool-cards/grep-results-view";
import { FileDiffCard, computeFileDiffStats } from "./tool-cards/diff-view";
import { RequestResponsePanel } from "./tool-cards/request-response-panel";
import {
  isLsTool,
  isReadFileTool,
  isFileWriteTool,
  isFileEditTool,
  isGrepTool,
  parseToolArgs,
} from "./tool-cards/utils";
import type { ChatToolCall, ChatTodo } from "./types";

const TOOL_LABELS: Record<string, string> = {
  write_todos: "Planning next steps",
  task: "Delegating to a helper",
  present_file: "Sharing a file",
  read_file: "Reading a file",
  write_file: "Saving a file",
  edit_file: "Updating a file",
  ls: "Looking through files",
  glob: "Looking through files",
  grep: "Searching files",
};

function humanizeToolName(name: string): string {
  return TOOL_LABELS[name] ?? name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}


function parseTodosFromArgs(args: string | undefined): ChatTodo[] | undefined {
  if (!args) return undefined;
  try {
    const parsed = JSON.parse(args);
    return Array.isArray(parsed?.todos) ? parsed.todos : undefined;
  } catch {
    return undefined;
  }
}

/**
 * One collapsible card for a single tool call — icon/label/status header,
 * expandable body. Every tool call renders through this same chrome; a tool
 * only changes what's *inside* it: write_todos replaces the raw Input/Result
 * entirely with a TodoChecklist (the plan itself is the only thing worth
 * showing — the raw JSON is noise), task adds a RobotIcon + "View subagent"
 * button, upsert_agent prepends an AgentUpsertBody summary above the raw
 * Input/Result every other tool shows. Never a second card.
 */
function ToolCallCard({
  toolCall,
  todos,
  onOpenSubagent,
  onOpenFile,
  defaultOpen,
}: {
  toolCall: ChatToolCall;
  todos?: ChatTodo[];
  onOpenSubagent?: (toolCallId: string) => void;
  /** present_file's Open button — no card for any other tool uses this. */
  onOpenFile?: (path: string) => void;
  /** Overrides the initial expanded state (e.g. InterruptPanel forces this
   * open so the pending call's args are visible without an extra click). */
  defaultOpen?: boolean;
}) {
  const isTask = toolCall.name === "task";
  const isTodos = toolCall.name === "write_todos";
  const isUpsert = toolCall.name === "upsert_agent";
  const isLs = isLsTool(toolCall.name);
  const isReadFile = isReadFileTool(toolCall.name);
  const isGrep = isGrepTool(toolCall.name);
  const isPending = toolCall.status === "running";
  const upsert: AgentUpsertSummary | null = isUpsert ? summarizeUpsert(toolCall) : null;
  // A failed tool run or an envelope that reports status:"error" both count as
  // error; an upsert that returns status:"success" reads as a success.
  const isError = upsert ? upsert.isError : toolCall.status === "error";
  const upsertSucceeded = !!upsert?.succeeded;
  const label = upsert ? upsert.title : humanizeToolName(toolCall.name);
  // write_file/edit_file get a diffstat badge and a DiffView body instead of
  // raw args/result JSON — but only once the args have actually parsed into
  // a real diff, otherwise fall through to the generic Input/Result panel.
  const isFileDiff = (isFileWriteTool(toolCall.name) || isFileEditTool(toolCall.name)) && !isError;
  const diffStats = isFileDiff ? computeFileDiffStats(toolCall) : null;
  // This call's own args win — they reflect the plan as of this specific
  // write_todos call; the externally-passed `todos` (the turn's latest
  // snapshot) is only a fallback for a call still streaming partial args.
  const displayTodos = isTodos ? (parseTodosFromArgs(toolCall.args) ?? todos) : undefined;
  // An upsert starts expanded while it runs so the "Writing…" state is visible.
  const [open, setOpen] = React.useState(defaultOpen ?? (isUpsert ? isPending : false));

  // write_todos stays collapsible like every other tool card, but the
  // checklist only renders once — inside CollapsibleContent — instead of
  // once as a "collapsed preview" and again as "expanded content" (that
  // duplication is what looked like a bug: same list either way).
  if (isTodos) {
    return (
      <Collapsible open={open} onOpenChange={setOpen}>
        <Item variant="outline" size="sm" className="flex-col items-stretch">
          <CollapsibleTrigger
            render={
              <button type="button" className="flex w-full items-center gap-2.5 text-left" />
            }
          >
            <ItemMedia variant="icon">
              {isPending ? <Spinner className="text-primary" /> : <WrenchIcon />}
            </ItemMedia>
            <ItemContent>
              <ItemTitle>
                {label}
                {isPending ? "…" : ""}
              </ItemTitle>
            </ItemContent>
            <CaretDownIcon
              className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
            />
          </CollapsibleTrigger>

          <CollapsibleContent>
            {displayTodos?.length ? (
              <div className="mt-2 pl-8">
                <TodoChecklist todos={displayTodos} />
              </div>
            ) : null}
          </CollapsibleContent>
        </Item>
      </Collapsible>
    );
  }

  // present_file is a pointer to a workspace file, not something to inspect
  // as raw Input/Result JSON — a flat row (name + description/path) with an
  // explicit Open button that hands the path to the caller. Never
  // auto-opens: the whole point of the button is that opening is the user's
  // choice, not a side effect of the agent finishing the call.
  if (toolCall.name === "present_file") {
    const presentArgs = parseToolArgs(toolCall.args) as
      | { filePath?: string; title?: string; description?: string }
      | null;
    const filePath = presentArgs?.filePath || "";
    const fileName = filePath.split("/").pop() || filePath || "file";
    return (
      <Item variant="outline" size="sm" className="flex-row items-center gap-2.5">
        <ItemMedia variant="icon">
          <FileTextIcon />
        </ItemMedia>
        <ItemContent>
          <ItemTitle className="truncate">{fileName}</ItemTitle>
          {presentArgs?.description ? (
            <ItemDescription className="truncate">{presentArgs.description}</ItemDescription>
          ) : filePath ? (
            <ItemDescription className="truncate font-mono">{filePath}</ItemDescription>
          ) : null}
        </ItemContent>
        {onOpenFile && filePath && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={() => onOpenFile(filePath)}
          >
            Open
          </Button>
        )}
      </Item>
    );
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Item
        variant="outline"
        size="sm"
        className={cn(
          "flex-col items-stretch",
          isError && "border-destructive/30",
          upsertSucceeded && "border-emerald-500/30"
        )}
      >
        <CollapsibleTrigger
          render={
            <button type="button" className="flex w-full items-center gap-2.5 text-left" />
          }
        >
          <ItemMedia variant="icon">
            {isError ? (
              <WarningCircleIcon className="text-destructive" />
            ) : isPending ? (
              <Spinner className="text-primary" />
            ) : isTask ? (
              <RobotIcon />
            ) : upsertSucceeded ? (
              <CheckCircleIcon className="text-emerald-500" />
            ) : (
              <WrenchIcon />
            )}
          </ItemMedia>
          <ItemContent>
            <ItemTitle
              className={cn(
                isError && "text-destructive",
                upsertSucceeded && "text-emerald-600 dark:text-emerald-400"
              )}
            >
              {label}
              {isPending ? "…" : ""}
            </ItemTitle>
            {upsert?.subtitle ? <ItemDescription>{upsert.subtitle}</ItemDescription> : null}
          </ItemContent>
          {diffStats ? (
            <span className="shrink-0 bg-muted px-1.5 py-0.5 font-mono text-[11px] font-semibold tabular-nums">
              <span className="text-emerald-600 dark:text-emerald-400">+{diffStats.added}</span>{" "}
              <span className="text-red-500 dark:text-red-400">-{diffStats.removed}</span>
            </span>
          ) : null}
          <CaretDownIcon
            className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
          />
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="mt-2.5 flex flex-col gap-2.5 border-t border-border pt-2.5">
            {/* An upsert gets its form-shaped summary instead of the raw
                Input/Result every other tool shows below — AgentUpsertBody
                already surfaces every field (name, tags, model, systemPrompt
                as rendered markdown, ...), so the raw JSON would just repeat
                the same systemPrompt/description text a second time as an
                escaped string. */}
            {isUpsert && upsert ? <AgentUpsertBody summary={upsert} /> : null}
            {isLs ? (
              <LsDirectoryCard toolCall={toolCall} />
            ) : isReadFile ? (
              <ReadFileCard toolCall={toolCall} />
            ) : diffStats ? (
              <FileDiffCard toolCall={toolCall} />
            ) : isGrep ? (
              <GrepResultsView toolCall={toolCall} />
            ) : isUpsert && upsert ? null : (
              <>
                <RequestResponsePanel label="Input" text={toolCall.args} />
                <RequestResponsePanel label="Result" text={toolCall.result} isError={isError} />
              </>
            )}
            {isTask && onOpenSubagent && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="self-start"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenSubagent(toolCall.id);
                }}
              >
                <RobotIcon /> View subagent
              </Button>
            )}
          </div>
        </CollapsibleContent>
      </Item>
    </Collapsible>
  );
}

export { ToolCallCard, humanizeToolName };
