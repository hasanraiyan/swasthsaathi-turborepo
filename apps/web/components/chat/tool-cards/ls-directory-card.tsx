"use client";

import * as React from "react";
import {
  FileTextIcon,
  FileCodeIcon,
  FolderIcon,
  FolderOpenIcon,
  CaretRightIcon,
  CaretDownIcon,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { parseToolArgs, parseLsResults, buildLsTree, type LsTreeNode } from "./utils";
import type { ChatToolCall } from "../types";

// Same file-vs-code icon split file-explorer-editor.tsx uses, so a listed
// entry reads the same way whether you're looking at it in the Explorer
// sidebar or in an `ls` tool call's result.
function fileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "md" || ext === "markdown" || ext === "txt") {
    return <FileTextIcon className="size-3.5 shrink-0 text-muted-foreground" />;
  }
  return <FileCodeIcon className="size-3.5 shrink-0 text-muted-foreground" />;
}

// One tree row, recursive — a directory node is its own caret+folder toggle
// (icon swaps open/closed) with its children indented underneath; a file
// node is a plain leaf row. Mirrors file-explorer-editor.tsx's per-folder
// expand/collapse instead of a single flat list.
function TreeRow({ node, depth, collapsed, onToggle }: {
  node: LsTreeNode;
  depth: number;
  collapsed: Set<string>;
  onToggle: (path: string) => void;
}) {
  const indent = { paddingLeft: `${8 + depth * 14}px` };

  if (!node.isDir) {
    return (
      <div
        style={indent}
        className="flex min-w-0 items-center gap-1.5 py-1 pr-2 text-xs text-muted-foreground hover:bg-muted/40 hover:text-foreground"
      >
        {fileIcon(node.name)}
        <span className="whitespace-nowrap font-mono">{node.name}</span>
      </div>
    );
  }

  // Open by default — a node is only closed once the user explicitly
  // collapses it, so a result that streams in after mount (or gains new
  // top-level entries) doesn't need its own "start expanded" bookkeeping.
  const isOpen = !collapsed.has(node.path);
  return (
    <div className="flex flex-col">
      <Button
        type="button"
        variant="ghost"
        style={indent}
        onClick={() => onToggle(node.path)}
        className="h-auto w-full min-w-0 justify-start gap-1 rounded-none py-1 pr-2 text-left text-xs font-normal text-muted-foreground"
      >
        {isOpen ? <CaretDownIcon className="size-3 shrink-0" /> : <CaretRightIcon className="size-3 shrink-0" />}
        {isOpen ? <FolderOpenIcon className="size-3.5 shrink-0" /> : <FolderIcon className="size-3.5 shrink-0" />}
        <span className="whitespace-nowrap font-mono">{node.name}</span>
      </Button>
      {isOpen &&
        node.children?.map((child) => (
          <TreeRow key={child.path} node={child} depth={depth + 1} collapsed={collapsed} onToggle={onToggle} />
        ))}
    </div>
  );
}

// Renders like file-explorer-editor.tsx's Explorer tree: a caret toggle for
// the listing itself, a folder icon that swaps open/closed, and — since an
// `ls` entry can carry slashes ("/memories/agent/") the flat listing never
// groups on its own — a real nested tree underneath where every directory
// is its own independently expandable node.
export function LsDirectoryCard({ toolCall }: { toolCall: ChatToolCall }) {
  const args = parseToolArgs(toolCall.args) || {};
  const path = (args.path as string) || (args.dir as string) || (args.directory as string) || "/";
  const items = parseLsResults(toolCall.result);
  const tree = React.useMemo(() => buildLsTree(items), [items]);
  const done = toolCall.status !== "running";
  // Starts expanded — this card only renders once the outer tool-call card
  // is already open, so a second click just to see the listing would be
  // redundant. The toggle exists for re-collapsing a long listing.
  const [open, setOpen] = React.useState(true);
  const [collapsedPaths, setCollapsedPaths] = React.useState<Set<string>>(() => new Set());

  const toggleNode = (nodePath: string) => {
    setCollapsedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(nodePath)) next.delete(nodePath);
      else next.add(nodePath);
      return next;
    });
  };

  return (
    <div className="flex min-w-0 flex-col overflow-hidden border border-border">
      <Button
        type="button"
        variant="ghost"
        onClick={() => setOpen((v) => !v)}
        className="h-auto w-full min-w-0 justify-start gap-1.5 rounded-none bg-muted/10 px-2 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
      >
        {open ? <CaretDownIcon className="size-3 shrink-0" /> : <CaretRightIcon className="size-3 shrink-0" />}
        {open ? <FolderOpenIcon className="size-3.5 shrink-0" /> : <FolderIcon className="size-3.5 shrink-0" />}
        <span className="min-w-0 truncate font-mono normal-case">{path}</span>
      </Button>
      {open &&
        (!done ? (
          <div className="flex flex-col gap-1.5 p-2">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-5 w-2/3" />
          </div>
        ) : tree.length > 0 ? (
          // A folder tree can run both long (many siblings) and wide (deep
          // nesting pushes indentation out, long names) — rows use
          // whitespace-nowrap rather than truncating, so nothing is ever
          // silently clipped; min-w-0 (threaded down through every row) is
          // what stops that width from forcing this card wider than its
          // container instead of just scrolling within it.
          // orientation="both" gets a real horizontal scrollbar for the
          // wide case, alongside the existing vertical one for the long case.
          <ScrollArea orientation="both" className="max-h-56 min-w-0">
            <div className="flex min-w-0 flex-col py-1">
              {tree.map((node) => (
                <TreeRow key={node.path} node={node} depth={0} collapsed={collapsedPaths} onToggle={toggleNode} />
              ))}
            </div>
          </ScrollArea>
        ) : (
          <Empty className="p-4">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FolderIcon />
              </EmptyMedia>
              <EmptyTitle className="text-xs">Empty directory</EmptyTitle>
            </EmptyHeader>
          </Empty>
        ))}
    </div>
  );
}
