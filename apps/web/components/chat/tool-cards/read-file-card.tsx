"use client";

import { FileCodeIcon, FileTextIcon } from "@phosphor-icons/react";
import { Spinner } from "@/components/ui/spinner";
import { getReadFileToolDetails, CODE_EXTENSIONS, fileExtOf } from "./utils";
import type { ChatToolCall } from "../types";

// Split file content into display lines + line numbers, stripping any
// "   1  content" prefixes the tool may have added.
function processLines(content: string, lineOffset: number) {
  if (!content) return { lines: [] as string[], lineNumbers: [] as number[] };
  const rawLines = content.split("\n");
  if (rawLines.length > 1 && rawLines[rawLines.length - 1] === "") {
    rawLines.pop();
  }

  let isPrefixed = true;
  const regex = /^\s*(\d+)(?:\s+(.*)|$)/;

  for (const line of rawLines) {
    if (line.trim() === "") continue;
    if (!regex.test(line)) {
      isPrefixed = false;
      break;
    }
  }

  if (isPrefixed && rawLines.length > 0) {
    const cleaned: string[] = [];
    const numbers: number[] = [];
    let lastNum = 0;

    for (const line of rawLines) {
      const match = line.match(regex);
      if (match) {
        cleaned.push(match[2] || "");
        lastNum = parseInt(match[1], 10);
        numbers.push(lastNum);
      } else {
        cleaned.push(line);
        lastNum += 1;
        numbers.push(lastNum);
      }
    }
    return { lines: cleaned, lineNumbers: numbers };
  }

  const offset = lineOffset || 0;
  const numbers = rawLines.map((_, i) => offset + i + 1);
  return { lines: rawLines, lineNumbers: numbers };
}

export function ReadFileCard({ toolCall }: { toolCall: ChatToolCall }) {
  const details = getReadFileToolDetails(toolCall.args, toolCall.result);
  const content = details?.content ?? "";
  const otherArgs = details?.otherArgs ?? {};
  const filePath = details?.filePath ?? "";
  const lineOffset = (otherArgs.offset as number) ?? (otherArgs.offsetLine as number) ?? 0;

  const { lines, lineNumbers } = processLines(content, lineOffset);

  if (!details) {
    return (
      <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-words font-mono text-xs leading-5 text-foreground bg-muted p-2.5 rounded-none border border-border">
        {toolCall.result || "No result yet."}
      </pre>
    );
  }

  const fileName = filePath.split("/").pop() || filePath;
  const isCode = CODE_EXTENSIONS.includes(fileExtOf(fileName));
  const FileIcon = isCode ? FileCodeIcon : FileTextIcon;
  const done = toolCall.status !== "running";

  return (
    <div className="flex flex-col rounded-none border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between border-b border-border bg-muted/50 px-3 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <FileIcon className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate text-xs font-semibold text-foreground font-mono">{filePath}</span>
        </div>
      </div>

      {!done ? (
        <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
          <Spinner className="size-5 mb-2 text-primary" />
          <span className="text-[11px] font-bold uppercase tracking-wider">Reading file content…</span>
        </div>
      ) : content ? (
        <div className="relative max-h-72 overflow-auto bg-[#0D1117] font-mono text-[11.5px] text-[#C9D1D9]">
          <div className="flex min-w-full">
            <div className="w-10 shrink-0 select-none border-r border-[#30363D] bg-[#161B22]/50 py-3 text-right pr-3 text-[10px] font-bold text-[#8B949E]">
              {lineNumbers.map((num, i) => (
                <div key={i} className="h-5 leading-5">
                  {num}
                </div>
              ))}
            </div>
            <div className="flex-1 py-3 pl-3 pr-4 overflow-x-auto select-text">
              {lines.map((line, i) => (
                <pre key={i} className="h-5 leading-5 whitespace-pre font-mono text-[#E6EDF2]">
                  {line || " "}
                </pre>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
          <FileTextIcon className="size-7 mb-2" />
          <span className="text-[11px] font-bold uppercase tracking-wider">Empty file or no content</span>
        </div>
      )}

      {done && content && (
        <div className="flex items-center justify-between border-t border-border bg-muted/50 px-3 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-tight select-none">
          <div>
            Showing lines {lineNumbers[0]}-{lineNumbers[lineNumbers.length - 1]}
          </div>
          <div>{lines.length} lines</div>
        </div>
      )}
    </div>
  );
}
