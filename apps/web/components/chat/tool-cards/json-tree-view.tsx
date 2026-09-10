"use client";

import * as React from "react";
import { CaretRightIcon, CaretDownIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

type JsonValue = string | number | boolean | null | undefined | JsonValue[] | { [key: string]: JsonValue };

function valueClass(value: JsonValue): string {
  if (value === null || value === undefined) return "text-muted-foreground italic";
  switch (typeof value) {
    case "string":
      return "text-orange-600 dark:text-orange-400";
    case "number":
      return "text-blue-600 dark:text-blue-400";
    case "boolean":
      return "text-violet-600 dark:text-violet-400";
    default:
      return "text-foreground";
  }
}

function formatPrimitive(value: JsonValue): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "string") return `"${value}"`;
  return String(value);
}

// One-line preview shown for a collapsed object/array, e.g. {type: "none"} or
// [1, 2, 3] - truncated so a huge nested value doesn't blow out the row.
function collapsedPreview(value: JsonValue): string {
  const isArray = Array.isArray(value);
  const entries = isArray ? (value as JsonValue[]) : Object.entries(value as object);
  const inner = isArray
    ? (entries as JsonValue[]).map((v) =>
        v !== null && typeof v === "object" ? (Array.isArray(v) ? "[…]" : "{…}") : formatPrimitive(v)
      )
    : (entries as [string, JsonValue][]).map(
        ([k, v]) => `${k}: ${v !== null && typeof v === "object" ? (Array.isArray(v) ? "[…]" : "{…}") : formatPrimitive(v)}`
      );
  const text = `${isArray ? "[" : "{"}${inner.join(", ")}${isArray ? "]" : "}"}`;
  return text.length > 80 ? `${text.slice(0, 77)}…` : text;
}

function JsonNode({ keyName, value, depth }: { keyName: string | number | null; value: JsonValue; depth: number }) {
  const isObject = value !== null && typeof value === "object";
  const isArray = isObject && Array.isArray(value);
  const isEmpty = isObject && (isArray ? (value as JsonValue[]).length === 0 : Object.keys(value as object).length === 0);
  // Top level (depth 0) starts expanded so the shape is visible at a glance;
  // nested objects/arrays start collapsed to keep the tree from opening fully.
  const [open, setOpen] = React.useState(depth === 0);

  if (!isObject || isEmpty) {
    return (
      <div className="flex gap-1.5 py-0.5 font-mono text-[11px] leading-relaxed">
        {keyName != null && <span className="shrink-0 font-semibold text-foreground">{keyName}:</span>}
        <span className={cn("break-all", isEmpty ? "text-muted-foreground" : valueClass(value))}>
          {isEmpty ? (isArray ? "[]" : "{}") : formatPrimitive(value)}
        </span>
      </div>
    );
  }

  const entries: [string | number, JsonValue][] = isArray
    ? (value as JsonValue[]).map((v, i) => [i, v])
    : Object.entries(value as object);

  return (
    <div className="font-mono text-[11px] leading-relaxed">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-1 py-0.5 text-left hover:bg-muted"
      >
        {open ? (
          <CaretDownIcon className="size-3 mt-0.5 shrink-0 text-muted-foreground" />
        ) : (
          <CaretRightIcon className="size-3 mt-0.5 shrink-0 text-muted-foreground" />
        )}
        <span className="break-all">
          {keyName != null && <span className="font-semibold text-foreground">{keyName}: </span>}
          {open ? (
            <span className="text-muted-foreground">{isArray ? "[" : "{"}</span>
          ) : (
            <span className="text-muted-foreground">{collapsedPreview(value)}</span>
          )}
        </span>
      </button>

      {open && (
        <div className="ml-4 border-l border-border pl-2.5">
          {entries.map(([k, v]) => (
            <JsonNode key={k} keyName={isArray ? null : k} value={v} depth={depth + 1} />
          ))}
        </div>
      )}
      {open && <div className="text-muted-foreground">{isArray ? "]" : "}"}</div>}
    </div>
  );
}

/**
 * Collapsible, syntax-colored JSON tree. Top-level keys render expanded;
 * nested objects/arrays start collapsed with a one-line preview, expandable
 * via the caret - same shape as a typical API request/response inspector.
 */
export function JsonTreeView({ data, className }: { data: unknown; className?: string }) {
  if (data === null || typeof data !== "object") {
    return (
      <div className={cn("font-mono text-[11px]", valueClass(data as JsonValue), className)}>
        {formatPrimitive(data as JsonValue)}
      </div>
    );
  }

  const entries: [string | number, JsonValue][] = Array.isArray(data)
    ? data.map((v, i) => [i, v])
    : Object.entries(data as object);
  if (entries.length === 0) {
    return (
      <div className={cn("font-mono text-[11px] text-muted-foreground", className)}>
        {Array.isArray(data) ? "[]" : "{}"}
      </div>
    );
  }

  return (
    <div className={className}>
      {entries.map(([k, v]) => (
        <JsonNode key={k} keyName={Array.isArray(data) ? null : k} value={v} depth={0} />
      ))}
    </div>
  );
}
