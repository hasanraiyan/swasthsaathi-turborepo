"use client";

import * as React from "react";
import { SparkleIcon, RobotIcon, InfoIcon, FolderOpenIcon } from "@phosphor-icons/react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { Badge } from "@/components/ui/badge";
import {
  FileExplorerEditor,
  type ExplorerItem,
  type ExplorerFile,
} from "@/components/file-explorer/file-explorer-editor";
import {
  getProjectMemory,
  writeProjectMemoryFile,
  deleteProjectMemoryFile,
  clearProjectMemory,
} from "@/lib/api/projects";

interface MemoryFileDto {
  scope: "user" | "agent" | "workspace";
  agentId?: string;
  path: string;
  content: string;
  mimeType?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface MemoryDataResponse {
  userFiles: MemoryFileDto[];
  agentMemories: Array<{
    agentId: string;
    agentName: string | null;
    files: MemoryFileDto[];
  }>;
  agentWorkspaces?: Array<{
    agentId: string;
    agentName: string | null;
    files: MemoryFileDto[];
  }>;
}

interface MemoryItem extends ExplorerItem {
  type: "memories" | "workspace";
  agentId?: string;
  agentName?: string;
}

interface MemoryWorkspaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  activeAgentId?: string | null;
  agents: Array<{ id: string; name: string }>;
  /** Opens straight to this file in the workspace tab once the dialog is showing (e.g. a present_file Open click). Real absolute path, "/workspace/..." prefix included. */
  initialOpenPath?: string | null;
  /**
   * The active agent's live, in-conversation filesystem (from `chat.agentState.files`
   * via `AgentChat`'s `onWorkspaceFilesChange`) — takes over the workspace tab's
   * content when present, since the Mongo-backed `agentWorkspaces` data below is a
   * separate, human-edited-only store that's never synced from a live run and would
   * otherwise show stale or missing content for a file the agent just wrote.
   */
  liveWorkspaceFiles?: Record<string, LiveWorkspaceFile> | null;
}

function normalizePath(raw: string): string {
  const clean = raw.trim().replace(/\\/g, "/").replace(/^\/+/, "");
  return `/${clean}`;
}

function stripLeadingSlash(path: string): string {
  return path.replace(/^\/+/, "");
}

// present_file (and the live agent filesystem generally) uses real absolute
// paths like "/workspace/outputs/report.md" — the workspace tab's own files
// are keyed without that "workspace/" segment (it's already implied by which
// tab they're in), so opening a live path here needs the same prefix
// stripped, not just the leading slash.
function stripWorkspacePrefix(path: string): string {
  const clean = stripLeadingSlash(path);
  return clean.startsWith("workspace/") ? clean.slice("workspace/".length) : clean;
}

interface LiveWorkspaceFile {
  content: string;
  size: number;
  createdAt: string | null;
  modifiedAt: string | null;
}

export function MemoryWorkspaceDialog({
  open,
  onOpenChange,
  projectId,
  activeAgentId,
  agents,
  initialOpenPath,
  liveWorkspaceFiles,
}: MemoryWorkspaceDialogProps) {
  const isMobile = useIsMobile();
  const [memoryData, setMemoryData] = React.useState<MemoryDataResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [openRequest, setOpenRequest] = React.useState<{ itemId: string; path: string | null } | null>(
    null
  );

  const fetchMemory = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await getProjectMemory(projectId);
      const data = res.data?.data as MemoryDataResponse;
      setMemoryData(data || { userFiles: [], agentMemories: [], agentWorkspaces: [] });
    } catch {
      setMemoryData({ userFiles: [], agentMemories: [], agentWorkspaces: [] });
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  React.useEffect(() => {
    if (open) {
      fetchMemory();
    }
  }, [open, fetchMemory]);

  // Transform memoryData + agents into 2 top-level ExplorerItems: memories and workspace
  const items = React.useMemo<MemoryItem[] | null>(() => {
    if (loading && !memoryData) return null;

    const currentData = memoryData ?? { userFiles: [], agentMemories: [], agentWorkspaces: [] };

    const currentAgentId = activeAgentId ? String(activeAgentId) : null;
    const activeAgent = currentAgentId
      ? agents.find((a) => String(a.id) === currentAgentId || String((a as unknown as { _id?: string })._id) === currentAgentId)
      : null;

    // 1. Build files under "memories":
    // Contains "agent/" subfolder (active agent) + "user/" subfolder (shared project memory)
    const userFiles = currentData.userFiles || [];
    const userExplorerFiles: ExplorerFile[] = userFiles.map((f) => ({
      path: `user/${stripLeadingSlash(f.path)}`,
      content: f.content || "",
    }));

    const agentGroup = currentAgentId
      ? (currentData.agentMemories || []).find((g) => String(g.agentId) === currentAgentId)
      : null;
    const agentFiles = agentGroup?.files || [];
    const agentExplorerFiles: ExplorerFile[] = agentFiles.map((f) => ({
      path: `agent/${stripLeadingSlash(f.path)}`,
      content: f.content || "",
    }));

    const memoriesItem: MemoryItem = {
      id: "memories",
      name: "memories",
      type: "memories",
      agentId: activeAgent?.id || currentAgentId || undefined,
      agentName: activeAgent?.name,
      files: [...agentExplorerFiles, ...userExplorerFiles],
    };

    // 2. Build files under "workspace":
    // Merge persistent MongoDB-backed workspace files with any live in-memory files.
    const wsGroup = currentAgentId
      ? (currentData.agentWorkspaces || []).find((g) => String(g.agentId) === currentAgentId)
      : null;
    const wsFiles = wsGroup?.files || [];
    const wsFilesMap = new Map<string, string>();
    for (const f of wsFiles) {
      wsFilesMap.set(stripLeadingSlash(f.path), f.content || "");
    }
    if (liveWorkspaceFiles && Object.keys(liveWorkspaceFiles).length > 0) {
      for (const [path, f] of Object.entries(liveWorkspaceFiles)) {
        wsFilesMap.set(stripWorkspacePrefix(path), f.content || "");
      }
    }
    const wsExplorerFiles: ExplorerFile[] = Array.from(wsFilesMap.entries()).map(([path, content]) => ({
      path,
      content,
    }));

    const workspaceItem: MemoryItem = {
      id: "workspace",
      name: "workspace",
      type: "workspace",
      agentId: activeAgent?.id || currentAgentId || undefined,
      agentName: activeAgent?.name,
      files: wsExplorerFiles,
    };

    return [memoriesItem, workspaceItem];
  }, [loading, memoryData, agents, activeAgentId, liveWorkspaceFiles]);

  // Set initial open tab ONLY ONCE when the dialog opens, absent an explicit
  // initialOpenPath — lands on the agent's memory index by default.
  const prevOpenRef = React.useRef(false);
  React.useEffect(() => {
    if (open && !prevOpenRef.current && items) {
      prevOpenRef.current = true;
      if (initialOpenPath) return;
      const memories = items.find((i) => i.id === "memories");
      const agentFile =
        memories?.files.find((f) => f.path === "agent/index.md") ||
        memories?.files.find((f) => f.path.startsWith("agent/"));
      const userFile =
        memories?.files.find((f) => f.path === "user/index.md") ||
        memories?.files[0];
      const targetFile = agentFile || userFile;
      if (targetFile) {
        setOpenRequest({ itemId: "memories", path: targetFile.path });
      }
    } else if (!open) {
      prevOpenRef.current = false;
    }
  }, [open, items, initialOpenPath]);

  // A present_file Open click always jumps straight to that file — unlike
  // the effect above, this isn't "once per open": if the dialog is already
  // showing and the user clicks a different file's Open button,
  // initialOpenPath changes again and this re-fires to follow it.
  React.useEffect(() => {
    if (open && initialOpenPath) {
      setOpenRequest({ itemId: "workspace", path: stripWorkspacePrefix(initialOpenPath) });
    }
  }, [open, initialOpenPath]);

  // CRUD Handlers
  const handleSaveRoot = async () => {
    // Files reside in `files`
  };

  const handleSaveFile = async (item: MemoryItem, rawPath: string, content: string) => {
    const clean = stripLeadingSlash(rawPath);
    if (item.id === "memories") {
      let scope: "agent" | "user" = "agent";
      let subPath = clean;
      if (clean.startsWith("user/")) {
        scope = "user";
        subPath = clean.slice("user/".length);
      } else if (clean.startsWith("agent/")) {
        scope = "agent";
        subPath = clean.slice("agent/".length);
      }
      const path = normalizePath(subPath);
      const agentId = scope === "agent" ? item.agentId || activeAgentId || undefined : undefined;

      await writeProjectMemoryFile(projectId, {
        scope,
        agentId,
        path,
        content,
      });

      setMemoryData((prev) => {
        if (!prev) return prev;
        if (scope === "user") {
          const otherFiles = (prev.userFiles || []).filter((f) => normalizePath(f.path) !== path);
          return {
            ...prev,
            userFiles: [
              ...otherFiles,
              { scope: "user", path, content, updatedAt: new Date().toISOString() },
            ],
          };
        } else {
          const groups = [...(prev.agentMemories || [])];
          const idx = groups.findIndex((g) => String(g.agentId) === String(agentId));
          const fileObj: MemoryFileDto = {
            scope: "agent",
            agentId,
            path,
            content,
            updatedAt: new Date().toISOString(),
          };
          if (idx >= 0) {
            const otherFiles = (groups[idx].files || []).filter((f) => normalizePath(f.path) !== path);
            groups[idx] = { ...groups[idx], files: [...otherFiles, fileObj] };
          } else if (agentId) {
            groups.push({ agentId, agentName: item.agentName || null, files: [fileObj] });
          }
          return { ...prev, agentMemories: groups };
        }
      });
    } else if (item.id === "workspace") {
      const scope = "workspace" as const;
      const path = normalizePath(clean);
      const agentId = item.agentId || activeAgentId || undefined;

      await writeProjectMemoryFile(projectId, {
        scope,
        agentId,
        path,
        content,
      });

      setMemoryData((prev) => {
        if (!prev) return prev;
        const groups = [...(prev.agentWorkspaces || [])];
        const idx = groups.findIndex((g) => String(g.agentId) === String(agentId));
        const fileObj: MemoryFileDto = {
          scope: "workspace",
          agentId,
          path,
          content,
          updatedAt: new Date().toISOString(),
        };
        if (idx >= 0) {
          const otherFiles = (groups[idx].files || []).filter((f) => normalizePath(f.path) !== path);
          groups[idx] = { ...groups[idx], files: [...otherFiles, fileObj] };
        } else if (agentId) {
          groups.push({ agentId, agentName: item.agentName || null, files: [fileObj] });
        }
        return { ...prev, agentWorkspaces: groups };
      });
    }
  };

  const handleAddFile = async (item: MemoryItem, rawPath: string) => {
    let clean = stripLeadingSlash(rawPath.trim().replace(/\\/g, "/"));
    if (item.id === "memories") {
      let scope: "agent" | "user" = "agent";
      let subPath = clean;
      if (clean.startsWith("user/")) {
        scope = "user";
        subPath = clean.slice("user/".length);
      } else if (clean.startsWith("agent/")) {
        scope = "agent";
        subPath = clean.slice("agent/".length);
      } else {
        // Default to agent folder if no prefix specified
        scope = "agent";
        clean = `agent/${clean}`;
      }
      const path = normalizePath(subPath);
      const agentId = scope === "agent" ? item.agentId || activeAgentId || undefined : undefined;
      const initialContent = `# ${clean.split("/").pop() || "Topic"}\n\n`;

      await writeProjectMemoryFile(projectId, {
        scope,
        agentId,
        path,
        content: initialContent,
      });

      setMemoryData((prev) => {
        if (!prev) return prev;
        if (scope === "user") {
          const otherFiles = (prev.userFiles || []).filter((f) => normalizePath(f.path) !== path);
          return {
            ...prev,
            userFiles: [
              ...otherFiles,
              { scope: "user", path, content: initialContent, updatedAt: new Date().toISOString() },
            ],
          };
        } else {
          const groups = [...(prev.agentMemories || [])];
          const idx = groups.findIndex((g) => String(g.agentId) === String(agentId));
          const newFile: MemoryFileDto = {
            scope: "agent",
            agentId,
            path,
            content: initialContent,
            updatedAt: new Date().toISOString(),
          };
          if (idx >= 0) {
            const otherFiles = (groups[idx].files || []).filter((f) => normalizePath(f.path) !== path);
            groups[idx] = { ...groups[idx], files: [...otherFiles, newFile] };
          } else if (agentId) {
            groups.push({ agentId, agentName: item.agentName || null, files: [newFile] });
          }
          return { ...prev, agentMemories: groups };
        }
      });

      setOpenRequest({ itemId: "memories", path: clean });
    } else if (item.id === "workspace") {
      const scope = "workspace" as const;
      const path = normalizePath(clean);
      const agentId = item.agentId || activeAgentId || undefined;
      const initialContent = `# ${clean.split("/").pop() || "File"}\n\n`;

      await writeProjectMemoryFile(projectId, {
        scope,
        agentId,
        path,
        content: initialContent,
      });

      setMemoryData((prev) => {
        if (!prev) return prev;
        const groups = [...(prev.agentWorkspaces || [])];
        const idx = groups.findIndex((g) => String(g.agentId) === String(agentId));
        const newFile: MemoryFileDto = {
          scope: "workspace",
          agentId,
          path,
          content: initialContent,
          updatedAt: new Date().toISOString(),
        };
        if (idx >= 0) {
          const otherFiles = (groups[idx].files || []).filter((f) => normalizePath(f.path) !== path);
          groups[idx] = { ...groups[idx], files: [...otherFiles, newFile] };
        } else if (agentId) {
          groups.push({ agentId, agentName: item.agentName || null, files: [newFile] });
        }
        return { ...prev, agentWorkspaces: groups };
      });

      setOpenRequest({ itemId: "workspace", path: clean });
    }
  };

  const handleDeleteFile = async (item: MemoryItem, rawPath: string) => {
    const clean = stripLeadingSlash(rawPath);
    if (item.id === "memories") {
      let scope: "agent" | "user" = "agent";
      let subPath = clean;
      if (clean.startsWith("user/")) {
        scope = "user";
        subPath = clean.slice("user/".length);
      } else if (clean.startsWith("agent/")) {
        scope = "agent";
        subPath = clean.slice("agent/".length);
      }
      const path = normalizePath(subPath);
      const agentId = scope === "agent" ? item.agentId || activeAgentId || undefined : undefined;

      await deleteProjectMemoryFile(projectId, { scope, agentId, path });

      setMemoryData((prev) => {
        if (!prev) return prev;
        if (scope === "user") {
          return {
            ...prev,
            userFiles: (prev.userFiles || []).filter((f) => normalizePath(f.path) !== path),
          };
        } else {
          const groups = (prev.agentMemories || []).map((g) => {
            if (String(g.agentId) !== String(agentId)) return g;
            return {
              ...g,
              files: (g.files || []).filter((f) => normalizePath(f.path) !== path),
            };
          });
          return { ...prev, agentMemories: groups };
        }
      });
    } else if (item.id === "workspace") {
      const scope = "workspace" as const;
      const path = normalizePath(clean);
      const agentId = item.agentId || activeAgentId || undefined;

      await deleteProjectMemoryFile(projectId, { scope, agentId, path });

      setMemoryData((prev) => {
        if (!prev) return prev;
        const groups = (prev.agentWorkspaces || []).map((g) => {
          if (String(g.agentId) !== String(agentId)) return g;
          return {
            ...g,
            files: (g.files || []).filter((f) => normalizePath(f.path) !== path),
          };
        });
        return { ...prev, agentWorkspaces: groups };
      });
    }
  };

  const handleDeleteItem = async (item: MemoryItem) => {
    if (item.id === "memories") {
      const agentId = item.agentId || activeAgentId || undefined;
      if (agentId) {
        await clearProjectMemory(projectId, agentId);
      }
      setMemoryData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          agentMemories: (prev.agentMemories || []).filter((g) => String(g.agentId) !== String(agentId)),
        };
      });
    } else if (item.id === "workspace") {
      const agentId = item.agentId || activeAgentId || undefined;
      const wsGroup = (memoryData?.agentWorkspaces || []).find((g) => String(g.agentId) === String(agentId));
      for (const f of wsGroup?.files || []) {
        await deleteProjectMemoryFile(projectId, { scope: "workspace", agentId, path: f.path }).catch(() => {});
      }
      setMemoryData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          agentWorkspaces: (prev.agentWorkspaces || []).filter((g) => String(g.agentId) !== String(agentId)),
        };
      });
    }
  };

  const explorer = (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      <FileExplorerEditor<MemoryItem>
        items={items}
        itemLabelPlural="directories"
        onCreateItem={() => {
          setOpenRequest({ itemId: "memories", path: "agent/index.md" });
        }}
        onSaveRoot={handleSaveRoot}
        onSaveFile={handleSaveFile}
        onAddFile={handleAddFile}
        onDeleteFile={handleDeleteFile}
        onDeleteItem={handleDeleteItem}
        openRequest={openRequest}
        emptyStateTitle="No file open"
        emptyStateDescription="Select a file from the explorer tree or click '+' to create one."
        addFilePlaceholder={(item) =>
          item?.id === "memories"
            ? "e.g. agent/notes.md or user/guidelines.md"
            : "e.g. outputs/report.md or notes.txt"
        }
        renderTabExtras={(item, activePath) => {
          if (item.id === "workspace") {
            return (
              <Badge
                variant="outline"
                className="text-[10px] uppercase font-mono tracking-wide px-1.5 py-0 rounded-none bg-muted/50"
              >
                <span className="inline-flex items-center gap-1">
                  <FolderOpenIcon className="size-2.5 text-primary" />
                  Workspace
                </span>
              </Badge>
            );
          }
          const isShared = activePath?.startsWith("user/") || false;
          return (
            <Badge
              variant="outline"
              className="text-[10px] uppercase font-mono tracking-wide px-1.5 py-0 rounded-none bg-muted/50"
            >
              {isShared ? (
                <span className="inline-flex items-center gap-1">
                  <SparkleIcon className="size-2.5 text-primary" />
                  Shared
                </span>
              ) : (
                <span className="inline-flex items-center gap-1">
                  <RobotIcon className="size-2.5 text-primary" />
                  Agent {item.agentName ? `(${item.agentName})` : ""}
                </span>
              )}
            </Badge>
          );
        }}
        renderSidePanel={(item, activePath) => {
          const isWorkspace = item.id === "workspace";
          const isShared = !isWorkspace && (activePath?.startsWith("user/") ?? false);
          const route = isWorkspace
            ? `/workspace/${activePath || ""}`
            : `/memories/${activePath || (isShared ? "user/" : "agent/")}`;

          return (
            <div className="p-4 space-y-4 text-xs">
              <div className="space-y-1.5">
                <span className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wider">
                  {isWorkspace ? "Workspace Directory" : "Memory Scope"}
                </span>
                <p className="font-medium text-foreground">
                  {isWorkspace
                    ? `Agent Scratchpad (${item.agentName || "Agent"})`
                    : isShared
                      ? "Project-wide (Shared Memory)"
                      : `Agent Memory (${item.agentName || "Agent"})`}
                </p>
              </div>

              <div className="space-y-1.5">
                <span className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wider">
                  Filesystem Route
                </span>
                <code className="block rounded bg-muted/60 p-2 font-mono text-[11px] text-foreground break-all">
                  {route}
                </code>
              </div>

              <div className="rounded border border-border/80 bg-card p-3 space-y-2 text-muted-foreground">
                <div className="flex items-center gap-1.5 text-foreground font-semibold text-[11px]">
                  <InfoIcon className="size-3.5 text-primary shrink-0" />
                  {isWorkspace ? "Workspace Usage" : isShared ? "Project Facts" : "Agent Learning"}
                </div>
                <p className="text-[11px] leading-relaxed">
                  {isWorkspace ? (
                    <>
                      Sub-agents and tools write deliverable files into{" "}
                      <strong className="text-foreground">/workspace/outputs/</strong>. Files persist across turns for this agent.
                    </>
                  ) : isShared ? (
                    <>
                      <strong className="text-foreground">/memories/user/index.md</strong> is automatically injected into every conversation turn for all agents in this project.
                    </>
                  ) : (
                    <>
                      <strong className="text-foreground">/memories/agent/index.md</strong> is automatically injected into every conversation turn for this agent.
                    </>
                  )}
                </p>
              </div>

              <div className="space-y-1 pt-2 border-t border-border/60">
                <span className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wider">
                  Files in Scope
                </span>
                <p className="text-xs font-mono text-muted-foreground">
                  {item.files?.length || 0} file(s)
                </p>
              </div>
            </div>
          );
        }}
      />
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="w-full rounded-t-lg p-0 flex flex-col gap-0 overflow-hidden outline-none data-[side=bottom]:h-[96vh] data-[side=bottom]:min-h-[96vh] data-[side=bottom]:max-h-[96vh]"
        >
          <SheetHeader className="flex flex-row items-center justify-between border-b border-border px-4 py-3 bg-muted/20 shrink-0">
            <div className="flex flex-col gap-0.5">
              <SheetTitle className="flex items-center gap-2 text-sm font-semibold tracking-tight">
                <span className="flex size-6 items-center justify-center rounded-none bg-primary text-primary-foreground">
                  <FolderOpenIcon className="size-3.5" />
                </span>
                Agent Workspace Files
              </SheetTitle>
              <SheetDescription className="text-xs text-muted-foreground">
                Inspect and edit files and persistent memories for this agent and project.
              </SheetDescription>
            </div>
          </SheetHeader>

          {explorer}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-7xl w-[95vw] h-[86vh] p-0 flex flex-col gap-0 overflow-hidden outline-none">
        <DialogHeader className="flex flex-row items-center justify-between border-b border-border px-5 py-3 bg-muted/20 shrink-0">
          <div className="flex flex-col gap-0.5">
            <DialogTitle className="flex items-center gap-2 text-sm font-semibold tracking-tight">
              <span className="flex size-6 items-center justify-center rounded-none bg-primary text-primary-foreground">
                <FolderOpenIcon className="size-3.5" />
              </span>
              Agent Workspace Files
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Inspect and edit files and persistent memories for this agent and project.
            </DialogDescription>
          </div>
        </DialogHeader>

        {explorer}
      </DialogContent>
    </Dialog>
  );
}
