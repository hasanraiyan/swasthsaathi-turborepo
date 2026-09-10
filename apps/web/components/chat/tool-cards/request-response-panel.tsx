"use client";

import * as React from "react";
import { CopyIcon, CheckIcon } from "@phosphor-icons/react";
import { tryParseJson } from "./utils";
import { JsonTreeView } from "./json-tree-view";
import { cn } from "@/lib/utils";

/**
 * A labeled "Input" / "Result" panel: a collapsible JSON tree (falls back to
 * plain text for non-JSON results), with a copy-to-clipboard button. Renders
 * the full tree with no height cap - nodes collapse individually instead of
 * the whole panel scrolling.
 */
export function RequestResponsePanel({
  label,
  text,
  isError,
  className,
}: {
  label: string;
  text: string | undefined;
  isError?: boolean;
  className?: string;
}) {
  const [copied, setCopied] = React.useState(false);

  const parsed = tryParseJson(text);
  const isJson = parsed !== null && typeof parsed === "object";

  if (!text) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(isJson ? JSON.stringify(parsed, null, 2) : text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard access denied — nothing to surface, the button just won't flip
    }
  };

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <div className="text-xs font-semibold text-muted-foreground">{label}</div>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground hover:text-foreground"
        >
          {copied ? <CheckIcon className="size-3" /> : <CopyIcon className="size-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <div
        className={cn(
          "max-h-40 overflow-auto rounded-none border p-2",
          isError ? "border-destructive/30 bg-destructive/10" : "border-border bg-muted",
          className
        )}
      >
        {isJson ? (
          <JsonTreeView data={parsed} />
        ) : (
          <div
            className={cn(
              "whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed",
              isError ? "text-destructive" : "text-foreground"
            )}
          >
            {text}
          </div>
        )}
      </div>
    </div>
  );
}
