"use client";

import * as React from "react";
import {
  SparkleIcon,
  FolderIcon,
  FolderOpenIcon,
  FileTextIcon,
  FileCodeIcon,
  PlusIcon,
  TrashIcon,
  CaretRightIcon,
  CaretDownIcon,
  FloppyDiskIcon,
  XIcon,
  MagnifyingGlassIcon,
  GlobeIcon,
  DotsThreeVerticalIcon,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CodeEditor } from "@/components/ui/code-editor";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";

export interface ExplorerFile {
  path: string;
  content: string;
}

/** The minimum shape a domain object needs to be browsable/editable here.
 * `rootContent` is the pinned, always-present file (e.g. a Skill's SKILL.md
 * instructions) shown first in the tree, above the free-form `files`. */
export interface ExplorerItem {
  id: string;
  name: string;
  rootContent?: string;
  rootFileName?: string;
  files: ExplorerFile[];
}

// An open editor tab. Content lives here, independent of any other tab, so
// switching between items/files never touches an unsaved buffer — same
// model as VS Code: a file only leaves memory when its tab is closed
// (prompting first if dirty) or explicitly saved.
interface OpenTab {
  key: string; // `${itemId}::${path ?? ""}`
  itemId: string;
  path: string | null; // null = root file
  content: string;
  isDirty: boolean;
}

function tabKey(itemId: string, path: string | null) {
  return `${itemId}::${path ?? ""}`;
}

function FileIcon({ path, className }: { path: string; className?: string }) {
  const ext = path.split(".").pop()?.toLowerCase();
  if (ext === "md" || ext === "markdown" || ext === "txt") return <FileTextIcon className={className} />;
  return <FileCodeIcon className={className} />;
}

interface FileTreeNode {
  name: string;
  path: string;
  file?: ExplorerFile;
  children?: FileTreeNode[];
}

// Bundled files carry a slash-separated relative path (e.g. "app/guide.md")
// but the API returns them as a flat list — this groups them into a real
// nested folder tree, VS Code style, instead of showing the raw path string
// as one flat leaf item.
function buildFileTree(files: ExplorerFile[]): FileTreeNode[] {
  interface MutableNode {
    name: string;
    path: string;
    file?: ExplorerFile;
    children: Map<string, MutableNode>;
  }
  const root = new Map<string, MutableNode>();

  for (const f of files) {
    const parts = f.path.split("/").filter(Boolean);
    let level = root;
    let currentPath = "";
    parts.forEach((part, i) => {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      let node = level.get(part);
      if (!node) {
        node = { name: part, path: currentPath, children: new Map() };
        level.set(part, node);
      }
      if (i === parts.length - 1) node.file = f;
      level = node.children;
    });
  }

  function finalize(map: Map<string, MutableNode>): FileTreeNode[] {
    return Array.from(map.values())
      .sort((a, b) => {
        const aFolder = !a.file;
        const bFolder = !b.file;
        if (aFolder !== bFolder) return aFolder ? -1 : 1;
        return a.name.localeCompare(b.name);
      })
      .map((n) => ({
        name: n.name,
        path: n.path,
        file: n.file,
        children: n.children.size ? finalize(n.children) : undefined,
      }));
  }

  return finalize(root);
}

// Extension -> fence/highlight language mapping, same pattern used by the
// chat workspace file panel, so files get the same Shiki-backed
// highlighting instead of a separate renderer.
const EXTENSION_LANGUAGE_MAP: Record<string, string> = {
  js: "javascript",
  jsx: "jsx",
  ts: "typescript",
  tsx: "tsx",
  mjs: "javascript",
  cjs: "javascript",
  py: "python",
  rb: "ruby",
  sh: "bash",
  yml: "yaml",
  md: "markdown",
};

// react-resizable-panels' <Panel> silently drops the className prop, so its
// "hidden sm:flex" visibility can't be CSS-only — this mirrors Tailwind's sm breakpoint in JS.
function useIsSmUp() {
  const [isSmUp, setIsSmUp] = React.useState<boolean | undefined>(undefined);
  React.useEffect(() => {
    const mql = window.matchMedia("(min-width: 640px)");
    const onChange = () => setIsSmUp(mql.matches);
    mql.addEventListener("change", onChange);
    onChange();
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return isSmUp;
}

export interface FileExplorerEditorProps<T extends ExplorerItem> {
  /** null = still loading (shows skeleton). */
  items: T[] | null;
  /** e.g. "skills" — used in counts, section header, search placeholder. */
  itemLabelPlural: string;
  /** e.g. "SKILL.md" — the pinned, non-deletable, always-first file. */
  rootFileName?: string;
  /** "+ New" clicked — the consumer owns the actual create dialog/flow. */
  onCreateItem: () => void;
  onSaveRoot: (item: T, content: string) => Promise<void>;
  onSaveFile: (item: T, path: string, content: string) => Promise<void>;
  onDeleteItem: (item: T) => Promise<void>;
  onAddFile: (item: T, path: string) => Promise<void>;
  onDeleteFile: (item: T, path: string) => Promise<void>;
  /** Defaults to a case-insensitive match on `name`. */
  searchFilter?: (item: T, query: string) => boolean;
  /** Optional right-hand "Details" panel content for the active item. */
  renderSidePanel?: (item: T, activePath?: string | null) => React.ReactNode;
  /** Optional small badges/labels shown at the right edge of the tab bar. */
  renderTabExtras?: (item: T, activePath?: string | null) => React.ReactNode;
  emptyStateTitle?: string;
  emptyStateDescription?: string;
  emptyStateActionLabel?: string;
  addFilePlaceholder?: (item?: T) => string;
  /** Set to a fresh object (e.g. after creating an item elsewhere) to make
   * the editor open/focus that item's root file — the object reference
   * changing is what triggers it, so always pass a new literal. */
  openRequest?: { itemId: string; path: string | null } | null;
  onSettingsClick?: () => void;
}

export function FileExplorerEditor<T extends ExplorerItem>({
  items,
  itemLabelPlural,
  rootFileName = "index.md",
  onCreateItem,
  onSaveRoot,
  onSaveFile,
  onDeleteItem,
  onAddFile,
  onDeleteFile,
  searchFilter,
  renderSidePanel,
  renderTabExtras,
  emptyStateTitle = "No file open",
  emptyStateDescription,
  emptyStateActionLabel = "New",
  addFilePlaceholder,
  openRequest,
  onSettingsClick,
}: FileExplorerEditorProps<T>) {
  const [search, setSearch] = React.useState("");
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());
  const [collapsedFolders, setCollapsedFolders] = React.useState<Set<string>>(new Set());
  const [openTabs, setOpenTabs] = React.useState<OpenTab[]>([]);
  const [activeTabKey, setActiveTabKey] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [showAddFileDialog, setShowAddFileDialog] = React.useState(false);
  const [newFilePath, setNewFilePath] = React.useState("");
  const [addFileItemId, setAddFileItemId] = React.useState<string | null>(null);
  const [mobileExplorerOpen, setMobileExplorerOpen] = React.useState(false);
  const [confirmAction, setConfirmAction] = React.useState<{
    title: string;
    description: string;
    confirmLabel: string;
    onConfirm: () => void;
  } | null>(null);
  const isSmUp = useIsSmUp();
  const [showExplorer, setShowExplorer] = React.useState(true);
  const didAutoOpenRef = React.useRef(false);
  const searchInputId = React.useId();

  const activeTab = openTabs.find((t) => t.key === activeTabKey) ?? null;
  const activeItem = activeTab ? (items?.find((i) => i.id === activeTab.itemId) ?? null) : null;
  const isRootFile = activeTab ? activeTab.path === null : false;
  const activePath = activeTab ? (activeTab.path ?? (activeItem?.rootFileName || rootFileName)) : "";
  const isMarkdownFile = isRootFile || /\.(md|markdown)$/i.test(activePath);
  const fenceLanguage = EXTENSION_LANGUAGE_MAP[activePath.split(".").pop()?.toLowerCase() ?? ""] ?? activePath.split(".").pop()?.toLowerCase() ?? "text";
  const editorContent = activeTab?.content ?? "";
  const isDirty = activeTab?.isDirty ?? false;
  const openItemIds = new Set(openTabs.map((t) => t.itemId));
  const showItemLabelInTabs = openItemIds.size > 1;

  // Auto-open the first item's root file or first file once, the first time items load
  React.useEffect(() => {
    if (!didAutoOpenRef.current && items && items.length > 0) {
      didAutoOpenRef.current = true;
      const first = items[0];
      setExpanded((prev) => new Set(prev).add(first.id));
      const hasRoot = first.rootContent !== undefined;
      const initialPath = hasRoot ? null : (first.files?.[0]?.path ?? null);
      const initialContent = hasRoot ? (first.rootContent || "") : (first.files?.[0]?.content || "");
      if (hasRoot || first.files?.[0]) {
        const key = tabKey(first.id, initialPath);
        setOpenTabs((prev) =>
          prev.length === 0
            ? [{ key, itemId: first.id, path: initialPath, content: initialContent, isDirty: false }]
            : prev
        );
        setActiveTabKey((prev) => prev ?? key);
      }
    }
  }, [items]);

  // Cross-boundary open request (e.g. a consumer-owned "create item" dialog
  // finished and wants this editor to open the new item's root file).
  React.useEffect(() => {
    // Deliberately keyed on `openRequest` alone: `items` gets a new
    // reference on every unrelated update (e.g. an autosave elsewhere), and
    // re-running this per those would keep yanking focus back to this tab
    // instead of firing once for the request that was actually made.
    if (!openRequest || !items) return;
    const item = items.find((i) => i.id === openRequest.itemId);
    if (!item) return;
    openFileTab(item, openRequest.path);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openRequest]);

  const filtered = React.useMemo(() => {
    if (!items) return [];
    const q = search.toLowerCase().trim();
    if (!q) return items;
    const match = searchFilter ?? ((item: T, query: string) => item.name.toLowerCase().includes(query));
    return items.filter((i) => match(i, q));
  }, [items, search, searchFilter]);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Opens a file/root file in its own tab (reusing one already open for the
  // same item+path instead of duplicating it) and focuses it.
  const openFileTab = (item: T, path: string | null) => {
    const key = tabKey(item.id, path);
    setExpanded((prev) => new Set(prev).add(item.id));
    setMobileExplorerOpen(false);
    setOpenTabs((prev) => {
      if (prev.some((t) => t.key === key)) return prev;
      const content = path === null ? (item.rootContent || "") : (item.files?.find((f) => f.path === path)?.content ?? "");
      return [...prev, { key, itemId: item.id, path, content, isDirty: false }];
    });
    setActiveTabKey(key);
  };

  const closeTabNow = (key: string) => {
    const idx = openTabs.findIndex((t) => t.key === key);
    const next = openTabs.filter((t) => t.key !== key);
    setOpenTabs(next);
    if (activeTabKey === key) {
      const fallback = next[idx] ?? next[idx - 1] ?? null;
      setActiveTabKey(fallback ? fallback.key : null);
    }
  };

  const closeTab = (key: string) => {
    const tab = openTabs.find((t) => t.key === key);
    if (tab?.isDirty) {
      setConfirmAction({
        title: "Discard unsaved changes?",
        description: `"${tab.path ?? rootFileName}" has unsaved changes. Closing this tab will discard them.`,
        confirmLabel: "Discard",
        onConfirm: () => closeTabNow(key),
      });
      return;
    }
    closeTabNow(key);
  };

  const handleEditorChange = (value: string) => {
    if (!activeTabKey) return;
    setOpenTabs((prev) => prev.map((t) => (t.key === activeTabKey ? { ...t, content: value, isDirty: true } : t)));
  };

  const handleSave = async () => {
    if (!activeTab || !activeItem || !activeTab.isDirty) return;
    setSaving(true);
    try {
      if (activeTab.path === null) {
        await onSaveRoot(activeItem, activeTab.content);
      } else {
        await onSaveFile(activeItem, activeTab.path, activeTab.content);
      }
      const savedKey = activeTab.key;
      setOpenTabs((prev) => prev.map((t) => (t.key === savedKey ? { ...t, isDirty: false } : t)));
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  // Keep a ref to the latest handleSave so the window-level keydown
  // listener (bound once) always saves from the current render's state.
  const handleSaveRef = React.useRef(handleSave);
  React.useEffect(() => {
    handleSaveRef.current = handleSave;
  });

  // VS Code-style save: Ctrl+S on Windows/Linux, Cmd+S on macOS. Always
  // preventDefault so the browser's "Save Page" dialog never appears while
  // editing a file here. handleSave no-ops when nothing is dirty.
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleSaveRef.current();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const deleteItemNow = async (item: T) => {
    try {
      await onDeleteItem(item);
      const remaining = openTabs.filter((t) => t.itemId !== item.id);
      setOpenTabs(remaining);
      if (activeTab?.itemId === item.id) {
        setActiveTabKey(remaining[0]?.key ?? null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteItem = (item: T) => {
    setConfirmAction({
      title: `Delete "${item.name}"?`,
      description: `This removes it and all its bundled files. This cannot be undone.`,
      confirmLabel: "Delete",
      onConfirm: () => deleteItemNow(item),
    });
  };

  const handleCreateFile = async (e: React.FormEvent) => {
    e.preventDefault();
    const item = items?.find((i) => i.id === addFileItemId);
    if (!item) return;
    const trimmed = newFilePath.trim().replace(/\\/g, "/").replace(/^\.\//, "");
    if (!trimmed || trimmed.toUpperCase() === rootFileName.toUpperCase()) return;
    try {
      await onAddFile(item, trimmed);
      // Just-created, so its content is always empty — no need to wait for
      // the parent's `items` to re-render with it before opening the tab.
      setOpenTabs((prev) => {
        const key = tabKey(item.id, trimmed);
        if (prev.some((t) => t.key === key)) return prev;
        return [...prev, { key, itemId: item.id, path: trimmed, content: "", isDirty: false }];
      });
      setActiveTabKey(tabKey(item.id, trimmed));
      setExpanded((prev) => new Set(prev).add(item.id));
      setShowAddFileDialog(false);
      setNewFilePath("");
      setAddFileItemId(null);
    } catch (e) {
      console.error(e);
    }
  };

  const deleteFileNow = async (item: T, path: string) => {
    try {
      await onDeleteFile(item, path);
      const key = tabKey(item.id, path);
      const remaining = openTabs.filter((t) => t.key !== key);
      setOpenTabs(remaining);
      if (activeTabKey === key) {
        setActiveTabKey(remaining[0]?.key ?? null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteFile = (item: T, path: string) => {
    setConfirmAction({
      title: `Delete file "${path}"?`,
      description: "This cannot be undone.",
      confirmLabel: "Delete",
      onConfirm: () => deleteFileNow(item, path),
    });
  };

  const renderFileNodes = (nodes: FileTreeNode[], item: T, depth: number): React.ReactNode =>
    nodes.map((node) => {
      const indent = { paddingLeft: `${8 + depth * 12}px` };
      if (!node.file) {
        const folderKey = `${item.id}:${node.path}`;
        const isCollapsed = collapsedFolders.has(folderKey);
        return (
          <div key={node.path} className="flex flex-col">
            <div className="group flex items-center justify-between pr-1">
              <button
                type="button"
                style={indent}
                onClick={() => {
                  setCollapsedFolders((prev) => {
                    const next = new Set(prev);
                    if (next.has(folderKey)) next.delete(folderKey);
                    else next.add(folderKey);
                    return next;
                  });
                }}
                className="flex flex-1 items-center gap-1.5 truncate py-1 pr-2 text-xs text-muted-foreground hover:text-foreground text-left"
              >
                {isCollapsed ? (
                  <CaretRightIcon className="size-3 shrink-0" />
                ) : (
                  <CaretDownIcon className="size-3 shrink-0" />
                )}
                {isCollapsed ? (
                  <FolderIcon className="size-3.5 shrink-0" />
                ) : (
                  <FolderOpenIcon className="size-3.5 shrink-0" />
                )}
                <span className="truncate font-medium">{node.name}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setAddFileItemId(item.id);
                  setNewFilePath(`${node.path}/`);
                  setShowAddFileDialog(true);
                }}
                className="size-5 flex items-center justify-center text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100"
                title={`Add file inside ${node.name}`}
              >
                <PlusIcon className="size-3" />
              </button>
            </div>
            {!isCollapsed && node.children && renderFileNodes(node.children, item, depth + 1)}
          </div>
        );
      }
      const isActive = activeTabKey === tabKey(item.id, node.path);
      return (
        <div key={node.path} className="group flex items-center gap-0.5">
          <button
            type="button"
            style={indent}
            onClick={() => openFileTab(item, node.path)}
            className={`flex flex-1 items-center gap-1.5 truncate rounded-none py-1 pr-1 text-left text-xs ${isActive ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"}`}
          >
            <FileIcon path={node.path} className="size-3.5 shrink-0" />
            <span className="truncate">{node.name}</span>
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  className="mr-1 flex size-5 shrink-0 items-center justify-center rounded-none text-muted-foreground opacity-0 hover:text-foreground group-hover:opacity-100 data-popup-open:opacity-100"
                >
                  <DotsThreeVerticalIcon className="size-3.5" />
                </button>
              }
            />
            <DropdownMenuContent align="end">
              <DropdownMenuItem variant="destructive" onClick={() => handleDeleteFile(item, node.file!.path)}>
                <TrashIcon className="size-3.5" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      );
    });

  const renderTree = () =>
    filtered.length === 0 ? (
      <div className="px-3 py-6 text-center text-xs text-muted-foreground">No {itemLabelPlural} found.</div>
    ) : (
      filtered.map((item) => {
        const isExpanded = expanded.has(item.id);
        const isRootActive = activeTabKey === tabKey(item.id, null);
        return (
          <div key={item.id} className="flex flex-col">
            <div className="group flex items-center gap-1">
              <button
                type="button"
                onClick={() => toggleExpand(item.id)}
                className="flex size-5 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground"
              >
                {isExpanded ? <CaretDownIcon className="size-3" /> : <CaretRightIcon className="size-3" />}
              </button>
              <button
                type="button"
                onClick={() => {
                  toggleExpand(item.id);
                  if (item.rootContent !== undefined) {
                    openFileTab(item, null);
                  }
                }}
                className="flex flex-1 items-center gap-1.5 truncate rounded-none px-1 py-1 text-left text-xs hover:bg-muted/60"
              >
                {isExpanded ? <FolderOpenIcon className="size-3.5 shrink-0" /> : <FolderIcon className="size-3.5 shrink-0" />}
                <span className="truncate font-medium">{item.name}</span>
              </button>
              <Button
                variant="ghost"
                size="icon-xs"
                className="size-5 shrink-0 opacity-0 group-hover:opacity-100"
                onClick={() => handleDeleteItem(item)}
              >
                <TrashIcon className="size-3" />
              </Button>
            </div>
            {isExpanded && (
              <div className="ml-4 flex flex-col border-l pl-2">
                {item.rootContent !== undefined && (
                  <button
                    type="button"
                    onClick={() => openFileTab(item, null)}
                    className={`flex items-center gap-1.5 truncate rounded-none px-2 py-1 text-left text-xs ${isRootActive ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"}`}
                  >
                    <FileTextIcon className="size-3.5 shrink-0" />
                    <span className="truncate">{item.rootFileName || rootFileName}</span>
                  </button>
                )}
                {renderFileNodes(buildFileTree(item.files ?? []), item, 0)}
                <button
                  type="button"
                  onClick={() => {
                    setAddFileItemId(item.id);
                    setNewFilePath("");
                    setShowAddFileDialog(true);
                  }}
                  className="flex items-center gap-1.5 px-2 py-1 text-left text-xs text-muted-foreground hover:text-foreground"
                >
                  <PlusIcon className="size-3" />
                  <span>Add file</span>
                </button>
              </div>
            )}
          </div>
        );
      })
    );

  if (!items) {
    return (
      <div className="flex h-full w-full">
        <div className="hidden w-[260px] shrink-0 border-r bg-muted/20 p-3 sm:flex sm:flex-col gap-2">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-full" />
        </div>
        <div className="flex flex-1 flex-col p-6 gap-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-[400px] w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background">
      <ResizablePanelGroup orientation="horizontal" className="relative flex-1">
        {/* Activity Bar - VS Code style far left */}
        <div className="hidden w-12 shrink-0 flex-col items-center gap-2 border-r bg-muted/10 py-2 sm:flex">
          <Button
            variant="ghost"
            size="icon-sm"
            className={showExplorer ? "bg-primary/10 text-primary" : "text-muted-foreground"}
            aria-label="Toggle Explorer"
            onClick={() => setShowExplorer((v) => !v)}
          >
            <FolderOpenIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground"
            aria-label="Search"
            onClick={() => {
              setShowExplorer(true);
              requestAnimationFrame(() => document.getElementById(searchInputId)?.focus());
            }}
          >
            <MagnifyingGlassIcon />
          </Button>
          <div className="flex-1" />
          {onSettingsClick && (
            <Button variant="ghost" size="icon-sm" className="text-muted-foreground" aria-label="Settings" onClick={onSettingsClick}>
              <GlobeIcon />
            </Button>
          )}
        </div>

        {/* Explorer Sidebar - conditionally rendered (not CSS-hidden) because
            react-resizable-panels' <Panel> silently drops className, so
            "hidden sm:flex" can't hide it on mobile, and toggling display
            via className wouldn't work for the same reason */}
        {isSmUp && showExplorer && (
        <ResizablePanel defaultSize="22" minSize="18" maxSize="32">
          <div className="flex h-full w-full min-w-[220px] flex-col border-r bg-muted/5">
            <div className="flex h-7 shrink-0 items-center justify-between px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Explorer
              <Button variant="ghost" size="icon-xs" className="size-5" onClick={onCreateItem}>
                <PlusIcon className="size-3" />
              </Button>
            </div>
            <div className="px-2 pb-2">
              <div className="relative">
                <MagnifyingGlassIcon className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input id={searchInputId} placeholder={`Search ${itemLabelPlural}…`} value={search} onChange={(e) => setSearch(e.target.value)} className="h-7 pl-7 text-xs" />
              </div>
            </div>
            <ScrollArea className="flex-1">
              <div className="flex flex-col gap-0.5 px-1 pb-4">
                <div className="px-2 py-1 text-[11px] font-medium text-muted-foreground">{itemLabelPlural.toUpperCase()}</div>
                {renderTree()}
              </div>
              <ScrollBar orientation="vertical" />
            </ScrollArea>
            <div className="border-t px-3 py-2 text-[10px] text-muted-foreground">
              <div className="flex items-center justify-between">
                <span>{items.length} {itemLabelPlural}</span>
                <span className="hidden sm:inline">Explorer</span>
              </div>
            </div>
          </div>
        </ResizablePanel>
        )}

        {/* Mobile explorer drawer - same folder/file tree as the desktop Explorer */}
        {mobileExplorerOpen && (
          <div className="absolute inset-0 z-20 flex sm:hidden">
            <div className="flex w-[280px] flex-col border-r bg-background">
              <div className="flex h-9 shrink-0 items-center justify-between border-b px-3">
                <span className="text-xs font-semibold uppercase tracking-wider">Explorer</span>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon-xs" className="size-6" onClick={onCreateItem}>
                    <PlusIcon className="size-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon-xs" className="size-6" onClick={() => setMobileExplorerOpen(false)}>
                    <XIcon className="size-3.5" />
                  </Button>
                </div>
              </div>
              <div className="px-2 pb-2 pt-2">
                <div className="relative">
                  <MagnifyingGlassIcon className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input placeholder={`Search ${itemLabelPlural}…`} value={search} onChange={(e) => setSearch(e.target.value)} className="h-7 pl-7 text-xs" />
                </div>
              </div>
              <ScrollArea className="flex-1">
                <div className="flex flex-col gap-0.5 px-1 pb-4">
                  <div className="px-2 py-1 text-[11px] font-medium text-muted-foreground">{itemLabelPlural.toUpperCase()}</div>
                  {renderTree()}
                </div>
                <ScrollBar orientation="vertical" />
              </ScrollArea>
              <div className="border-t px-3 py-2 text-[10px] text-muted-foreground">{items.length} {itemLabelPlural}</div>
            </div>
            <button type="button" className="flex-1 bg-black/20" onClick={() => setMobileExplorerOpen(false)} />
          </div>
        )}

        {isSmUp && showExplorer && <ResizableHandle withHandle />}

        {/* Editor Area */}
        <ResizablePanel defaultSize="78">
        <div className="flex h-full w-full min-w-0 flex-col bg-background">
          {/* Mobile-only Explorer toggle - desktop has the persistent Activity Bar instead */}
          <div className="flex h-8 shrink-0 items-center gap-1.5 border-b bg-muted/20 px-2 sm:hidden">
            <Button variant="ghost" size="icon-xs" onClick={() => setMobileExplorerOpen((v) => !v)}>
              <FolderIcon />
            </Button>
          </div>
          {!activeTab || !activeItem ? (
            <div className="flex flex-1 items-center justify-center p-8 text-center">
              <div className="flex max-w-sm flex-col items-center gap-3">
                <div className="flex size-12 items-center justify-center rounded-none bg-muted">
                  <SparkleIcon className="size-6 text-muted-foreground" />
                </div>
                <h3 className="text-sm font-medium">{emptyStateTitle}</h3>
                {emptyStateDescription && <p className="text-xs text-muted-foreground">{emptyStateDescription}</p>}
                <Button size="sm" onClick={onCreateItem}>
                  <PlusIcon data-icon="inline-start" />
                  {emptyStateActionLabel}
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* Tabs bar - VS Code style, one tab per open file across any item */}
              <div className="flex h-9 shrink-0 items-center gap-0 overflow-x-auto border-b bg-muted/20">
                {openTabs.map((tab) => {
                  const tabItem = items.find((i) => i.id === tab.itemId);
                  const label = tab.path ?? rootFileName;
                  const isActive = tab.key === activeTabKey;
                  return (
                    <div
                      key={tab.key}
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => setActiveTabKey(tab.key)}
                      className={`flex h-full shrink-0 cursor-pointer items-center gap-1.5 border-r px-3 text-xs ${isActive ? "bg-background text-foreground" : "bg-muted/10 text-muted-foreground hover:bg-muted/30"}`}
                    >
                      {tab.path === null ? <FileTextIcon className="size-3.5 shrink-0" /> : <FileIcon path={tab.path} className="size-3.5 shrink-0" />}
                      <span className="flex min-w-0 flex-col leading-tight">
                        {showItemLabelInTabs && <span className="max-w-[140px] truncate text-[9px] text-muted-foreground/70">{tabItem?.name}</span>}
                        <span className="max-w-[140px] truncate">{label}</span>
                      </span>
                      {tab.isDirty && <span className="size-1.5 shrink-0 rounded-full bg-primary" />}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          closeTab(tab.key);
                        }}
                        className="ml-1 shrink-0 rounded-sm p-0.5 hover:bg-muted"
                      >
                        <XIcon className="size-3" />
                      </button>
                    </div>
                  );
                })}
                <div className="flex-1" />
                {renderTabExtras && (
                  <div className="hidden items-center gap-1 pr-2 sm:flex">{renderTabExtras(activeItem, activeTab?.path)}</div>
                )}
              </div>

              {/* Breadcrumb */}
              <div className="flex h-6 shrink-0 items-center gap-1 border-b bg-muted/10 px-3 text-[11px] text-muted-foreground">
                <span className="truncate">{activeItem.name}</span>
                <span>›</span>
                <span className="truncate font-mono">{activePath}</span>
              </div>

              {/* Editor */}
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <div className="flex min-h-0 flex-1 overflow-hidden">
                  <CodeEditor
                    value={editorContent}
                    onChange={handleEditorChange}
                    language={isMarkdownFile ? "markdown" : fenceLanguage}
                    placeholder={isRootFile ? "# Title\n\n## Overview\n\nWrite the full instructions…" : ""}
                    className="h-full min-h-0 w-full flex-1"
                    spellCheck={false}
                  />

                  {/* Right side panel - hidden on small, visible on xl */}
                  {renderSidePanel && (
                    <div className="hidden w-[320px] shrink-0 border-l bg-muted/5 xl:flex xl:flex-col">
                      {renderSidePanel(activeItem, activeTab?.path)}
                    </div>
                  )}
                </div>

                {/* Status bar - VS Code style */}
                <div className="flex h-6 shrink-0 items-center justify-between border-t bg-primary px-2 text-[11px] text-primary-foreground">
                  <div className="flex items-center gap-3">
                    <span className="hidden sm:inline">{isDirty ? "● Unsaved" : "✓ Saved"}</span>
                    <span className="hidden sm:inline">{activePath.endsWith(".md") ? "Markdown" : activePath.split(".").pop()?.toUpperCase() || "Plain Text"}</span>
                    <span>{editorContent.length} chars</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="hidden sm:inline">Spaces: 2</span>
                    <span className="hidden sm:inline">UTF-8</span>
                    <Button
                      size="xs"
                      variant="secondary"
                      className="h-5 bg-white text-primary hover:bg-white/90 text-[11px]"
                      onClick={handleSave}
                      disabled={!isDirty || saving}
                      title="Save (Ctrl+S)"
                    >
                      <FloppyDiskIcon data-icon="inline-start" className="size-3" />
                      {saving ? "Saving…" : "Save"}
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      <Dialog
        open={showAddFileDialog}
        onOpenChange={(open) => {
          setShowAddFileDialog(open);
          if (!open) setAddFileItemId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add file</DialogTitle>
            <DialogDescription>
              {items?.find((i) => i.id === addFileItemId)?.rootContent !== undefined
                ? `Bundle a supporting file alongside ${items?.find((i) => i.id === addFileItemId)?.rootFileName || rootFileName}, e.g. references/guide.md.`
                : "Create a new file or nested path within this directory."}
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={handleCreateFile}
            className="flex flex-col gap-4 py-2"
          >
            <Field>
              <FieldLabel htmlFor="new-file-path">File path</FieldLabel>
              <Input
                id="new-file-path"
                value={newFilePath}
                onChange={(e) => setNewFilePath(e.target.value)}
                placeholder={
                  addFilePlaceholder
                    ? addFilePlaceholder(items?.find((i) => i.id === addFileItemId))
                    : "e.g. references/guide.md"
                }
                required
                autoFocus
                maxLength={256}
                className="font-mono text-sm"
              />
              <FieldDescription>
                {items?.find((i) => i.id === addFileItemId)?.rootContent !== undefined
                  ? `Relative path within the folder. Cannot be ${items?.find((i) => i.id === addFileItemId)?.rootFileName || rootFileName}.`
                  : "Relative path within the directory, e.g. agent/notes.md or notes.txt."}
              </FieldDescription>
            </Field>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowAddFileDialog(false);
                  setAddFileItemId(null);
                }}
              >
                Cancel
              </Button>
              <Button type="submit">Add file</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmAction?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmAction?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                confirmAction?.onConfirm();
                setConfirmAction(null);
              }}
              className="bg-destructive text-destructive-foreground"
            >
              {confirmAction?.confirmLabel ?? "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
