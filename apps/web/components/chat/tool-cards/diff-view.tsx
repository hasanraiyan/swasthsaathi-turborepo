"use client";

import * as React from "react";
import { FileCodeIcon, FileTextIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { parseToolArgs, CODE_EXTENSIONS, fileExtOf } from "./utils";
import type { ChatToolCall } from "../types";

type DiffRow = { type: "add" | "remove" | "context"; line: string };

// Line-level LCS diff. Bounded: falls back to a naive remove-then-add
// rendering when either side is too large for O(n*m) DP to stay fast.
function computeLineDiff(oldLines: string[], newLines: string[]): DiffRow[] {
  const n = oldLines.length;
  const m = newLines.length;
  if (n * m > 250000) {
    return [
      ...oldLines.map((line) => ({ type: "remove" as const, line })),
      ...newLines.map((line) => ({ type: "add" as const, line })),
    ];
  }

  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = oldLines[i] === newLines[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const rows: DiffRow[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (oldLines[i] === newLines[j]) {
      rows.push({ type: "context", line: oldLines[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      rows.push({ type: "remove", line: oldLines[i] });
      i++;
    } else {
      rows.push({ type: "add", line: newLines[j] });
      j++;
    }
  }
  while (i < n) {
    rows.push({ type: "remove", line: oldLines[i] });
    i++;
  }
  while (j < m) {
    rows.push({ type: "add", line: newLines[j] });
    j++;
  }
  return rows;
}

// Unified diff: red (-) removed lines, green (+) added lines, dimmed context.
export function DiffView({
  oldContent = "",
  newContent = "",
  fileName,
  note,
}: {
  oldContent?: string;
  newContent?: string;
  fileName?: string;
  note?: string;
}) {
  const rows = React.useMemo(
    () => computeLineDiff(oldContent.split("\n"), newContent.split("\n")),
    [oldContent, newContent]
  );

  const added = rows.filter((row) => row.type === "add").length;
  const removed = rows.filter((row) => row.type === "remove").length;

  const isCode = fileName ? CODE_EXTENSIONS.includes(fileExtOf(fileName)) : false;
  const FileIcon = isCode ? FileCodeIcon : FileTextIcon;

  let oldNo = 1;
  let newNo = 1;

  return (
    <div className="flex flex-col rounded-none border border-border bg-card overflow-hidden">
      {fileName ? (
        <div className="flex items-center justify-between border-b border-border bg-muted/50 px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <FileIcon className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate text-xs font-semibold text-foreground font-mono">{fileName}</span>
          </div>
          <span className="shrink-0 text-[10px] font-bold tabular-nums">
            <span className="text-emerald-600 dark:text-emerald-400">+{added}</span>{" "}
            <span className="text-red-500 dark:text-red-400">-{removed}</span>
          </span>
        </div>
      ) : null}

      {note ? (
        <div className="border-b border-border bg-muted/40 px-3 py-1.5 text-[10px] font-semibold text-muted-foreground">
          {note}
        </div>
      ) : null}

      <div className="max-h-72 overflow-auto font-mono text-[11.5px] leading-5">
        {rows.map((row, index) => {
          const displayOldNo = row.type !== "add" ? oldNo++ : null;
          const displayNewNo = row.type !== "remove" ? newNo++ : null;
          return (
            <div
              key={index}
              className={cn(
                "flex",
                row.type === "add" && "bg-emerald-50 dark:bg-emerald-500/10",
                row.type === "remove" && "bg-red-50 dark:bg-red-500/10"
              )}
            >
              <span className="w-8 shrink-0 select-none border-r border-border px-1.5 text-right text-muted-foreground">
                {displayOldNo ?? ""}
              </span>
              <span className="w-8 shrink-0 select-none border-r border-border px-1.5 text-right text-muted-foreground">
                {displayNewNo ?? ""}
              </span>
              <span
                className={cn(
                  "w-4 shrink-0 select-none text-center font-bold",
                  row.type === "add" && "text-emerald-600 dark:text-emerald-400",
                  row.type === "remove" && "text-red-500 dark:text-red-400"
                )}
              >
                {row.type === "add" ? "+" : row.type === "remove" ? "-" : ""}
              </span>
              <span className="flex-1 whitespace-pre px-1.5 text-foreground">{row.line || " "}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Line counts for the card row's "+19 -6" diffstat. Returns null when the
// args aren't parseable (yet) — the caller falls back to the generic panel
// instead of rendering an empty diff.
export function computeFileDiffStats(toolCall: ChatToolCall): { added: number; removed: number } | null {
  const args = parseToolArgs(toolCall.args) || {};
  const name = (toolCall.name || "").toLowerCase();

  if (name === "write_file") {
    if (typeof args.content !== "string") return null;
    return { added: (args.content as string).split("\n").length, removed: 0 };
  }

  if (name === "edit_file") {
    if (typeof args.old_string !== "string" && typeof args.new_string !== "string") return null;
    const rows = computeLineDiff(
      String(args.old_string ?? "").split("\n"),
      String(args.new_string ?? "").split("\n")
    );
    return {
      added: rows.filter((row) => row.type === "add").length,
      removed: rows.filter((row) => row.type === "remove").length,
    };
  }

  return null;
}

// Reads a write_file / edit_file tool's arguments and renders the DiffView.
// write_file has no prior content available client-side, so the entire body
// renders as additions; edit_file diffs old_string against new_string.
export function FileDiffCard({ toolCall }: { toolCall: ChatToolCall }) {
  const args = parseToolArgs(toolCall.args) || {};
  const nameLower = (toolCall.name || "").toLowerCase();
  const filePath = (args.file_path as string) || (args.filePath as string) || (args.path as string) || "";

  if (nameLower === "edit_file") {
    const oldContent = typeof args.old_string === "string" ? args.old_string : "";
    const newContent = typeof args.new_string === "string" ? args.new_string : "";
    return (
      <DiffView
        fileName={filePath}
        oldContent={oldContent}
        newContent={newContent}
        note={args.replace_all ? "Replacing all occurrences" : undefined}
      />
    );
  }

  const content = typeof args.content === "string" ? args.content : "";
  return <DiffView fileName={filePath} oldContent="" newContent={content} />;
}
