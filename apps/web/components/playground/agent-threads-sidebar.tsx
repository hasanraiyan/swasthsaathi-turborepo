"use client";

import * as React from "react";
import {
  ChatCircleDotsIcon,
  NotePencilIcon,
  DotsThreeVerticalIcon,
  PencilSimpleIcon,
  TrashIcon,
  CheckIcon,
  XIcon,
  MagnifyingGlassIcon,
  SpinnerIcon,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getProjectAgentThreads,
  createProjectAgentThread,
  updateProjectAgentThread,
  deleteProjectAgentThread,
  type ProjectAgentThread,
} from "@/lib/api/projects";
import { cn } from "@/lib/utils";

function formatRelativeTime(dateInput: string | Date | undefined): string {
  if (!dateInput) return "";
  const date = new Date(dateInput);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHour / 24);

  if (diffSec < 60) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

interface AgentThreadsSidebarProps {
  projectId: string;
  agentId: string;
  activeThreadId: string | null;
  onSelectThread: (thread: ProjectAgentThread) => void;
  onThreadDeleted?: (threadId: string) => void;
  updatedTitle?: { threadId: string; title: string } | null;
  onClose?: () => void;
  className?: string;
}

export function AgentThreadsSidebar({
  projectId,
  agentId,
  activeThreadId,
  onSelectThread,
  onThreadDeleted,
  updatedTitle,
  onClose,
  className,
}: AgentThreadsSidebarProps) {
  const [threads, setThreads] = React.useState<ProjectAgentThread[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [creating, setCreating] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editTitle, setEditTitle] = React.useState("");
  const editInputRef = React.useRef<HTMLInputElement>(null);

  const fetchThreads = React.useCallback(
    async (selectFirst = false) => {
      try {
        setLoading(true);
        const res = await getProjectAgentThreads(projectId, agentId);
        const list: ProjectAgentThread[] = Array.isArray(res.data?.data)
          ? res.data.data
          : Array.isArray(res.data)
            ? res.data
            : [];
        setThreads(list);
        if (list.length > 0 && (selectFirst || !activeThreadId)) {
          onSelectThread(list[0]);
        }
      } catch (err) {
        console.error("Failed to load agent threads:", err);
      } finally {
        setLoading(false);
      }
    },
    [projectId, agentId, activeThreadId, onSelectThread]
  );

  React.useEffect(() => {
    fetchThreads(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, agentId]);

  React.useEffect(() => {
    if (updatedTitle?.threadId && updatedTitle?.title) {
      setThreads((prev) =>
        prev.map((t) =>
          t._id === updatedTitle.threadId || t.threadId === updatedTitle.threadId
            ? { ...t, title: updatedTitle.title }
            : t
        )
      );
    }
  }, [updatedTitle]);

  React.useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const handleCreate = async () => {
    try {
      setCreating(true);
      const res = await createProjectAgentThread(projectId, agentId);
      const newThread: ProjectAgentThread = res.data?.data;
      if (newThread) {
        setThreads((prev) => [newThread, ...prev]);
        onSelectThread(newThread);
      }
    } catch (err) {
      console.error("Failed to create thread:", err);
    } finally {
      setCreating(false);
    }
  };

  const handleStartRename = (thread: ProjectAgentThread, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingId(thread._id);
    setEditTitle(thread.title || "New Conversation");
  };

  const handleSaveRename = async (threadId: string) => {
    const trimmed = editTitle.trim();
    if (!trimmed) {
      setEditingId(null);
      return;
    }
    try {
      await updateProjectAgentThread(projectId, agentId, threadId, { title: trimmed });
      setThreads((prev) =>
        prev.map((t) => (t._id === threadId ? { ...t, title: trimmed } : t))
      );
    } catch (err) {
      console.error("Failed to rename thread:", err);
    } finally {
      setEditingId(null);
    }
  };

  const handleDelete = async (thread: ProjectAgentThread, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await deleteProjectAgentThread(projectId, agentId, thread._id);
      const remaining = threads.filter((t) => t._id !== thread._id);
      setThreads(remaining);
      onThreadDeleted?.(thread._id);

      // If active thread was deleted, select next available thread
      if (activeThreadId === thread._id || activeThreadId === thread.threadId) {
        if (remaining.length > 0) {
          onSelectThread(remaining[0]);
        }
      }
    } catch (err) {
      console.error("Failed to delete thread:", err);
    }
  };

  const filteredThreads = React.useMemo(() => {
    if (!searchQuery.trim()) return threads;
    const q = searchQuery.toLowerCase();
    return threads.filter((t) => (t.title || "").toLowerCase().includes(q));
  }, [threads, searchQuery]);

  return (
    <div
      className={cn(
        "flex h-full w-64 shrink-0 flex-col border-r border-border bg-card/90",
        className
      )}
    >
      {/* Header with New Chat button */}
      <div className="flex items-center justify-between border-b border-border p-3 gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <ChatCircleDotsIcon className="size-4 shrink-0 text-primary" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate">
            Threads
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="outline"
            onClick={handleCreate}
            disabled={creating}
            className="h-7 gap-1 px-2 text-xs font-medium"
          >
            {creating ? (
              <SpinnerIcon className="size-3.5 animate-spin" />
            ) : (
              <NotePencilIcon className="size-3.5" />
            )}
            <span>New</span>
          </Button>
          {onClose && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onClose}
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
              title="Close threads"
            >
              <XIcon className="size-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Filter / Search if more than 3 threads */}
      {threads.length > 3 && (
        <div className="border-b border-border px-3 py-2">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter threads..."
              className="h-7 pl-8 text-xs bg-background/50"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <XIcon className="size-3" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Threads List */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-2 space-y-1">
          {loading && threads.length === 0 ? (
            <div className="space-y-2 p-2">
              <Skeleton className="h-8 w-full rounded-sm" />
              <Skeleton className="h-8 w-full rounded-sm" />
              <Skeleton className="h-8 w-full rounded-sm" />
            </div>
          ) : filteredThreads.length === 0 ? (
            <div className="p-4 text-center text-xs text-muted-foreground">
              {searchQuery ? "No matching threads" : "No threads yet. Start a chat!"}
            </div>
          ) : (
            filteredThreads.map((thread) => {
              const isActive =
                activeThreadId === thread._id || activeThreadId === thread.threadId;
              const isEditing = editingId === thread._id;

              return (
                <div
                  key={thread._id}
                  onClick={() => !isEditing && onSelectThread(thread)}
                  className={cn(
                    "group relative flex items-center justify-between rounded-sm px-2.5 py-2 text-xs transition-colors cursor-pointer select-none",
                    isActive
                      ? "bg-primary/10 text-foreground font-medium border border-primary/20"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  )}
                >
                  {isEditing ? (
                    <div
                      className="flex flex-1 items-center gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Input
                        ref={editInputRef}
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveRename(thread._id);
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        className="h-6 text-xs px-1.5 py-0 bg-background"
                      />
                      <button
                        onClick={() => handleSaveRename(thread._id)}
                        className="p-1 hover:text-primary"
                        title="Save"
                      >
                        <CheckIcon className="size-3.5" />
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="p-1 hover:text-destructive"
                        title="Cancel"
                      >
                        <XIcon className="size-3.5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-1 min-w-0 flex-col pr-1">
                        <span className="truncate" title={thread.title}>
                          {thread.title || "New Conversation"}
                        </span>
                        <span className="text-[10px] text-muted-foreground/70 font-normal">
                          {formatRelativeTime(thread.lastMessageAt || thread.createdAt)}
                        </span>
                      </div>

                      {/* Three-dot dropdown menu */}
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          onClick={(e: React.MouseEvent) => e.stopPropagation()}
                          render={
                            <button
                              type="button"
                              className={cn(
                                "flex size-6 shrink-0 items-center justify-center rounded-sm text-muted-foreground opacity-0 hover:bg-muted hover:text-foreground group-hover:opacity-100 data-popup-open:opacity-100 transition-opacity",
                                isActive && "opacity-80"
                              )}
                            >
                              <DotsThreeVerticalIcon className="size-3.5" />
                            </button>
                          }
                        />
                        <DropdownMenuContent align="end" className="w-36 text-xs">
                          <DropdownMenuItem
                            onClick={(e) => handleStartRename(thread, e)}
                            className="gap-2 text-xs"
                          >
                            <PencilSimpleIcon className="size-3.5" />
                            <span>Rename</span>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={(e) => handleDelete(thread, e)}
                            className="gap-2 text-xs text-destructive focus:text-destructive"
                          >
                            <TrashIcon className="size-3.5" />
                            <span>Delete</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
