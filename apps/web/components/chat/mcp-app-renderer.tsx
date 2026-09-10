"use client";

import * as React from "react";
import {
  WarningCircleIcon,
  ArrowsOutIcon,
  ArrowsInIcon,
  AppWindowIcon,
} from "@phosphor-icons/react";
import {
  AppBridge,
  PostMessageTransport,
} from "@modelcontextprotocol/ext-apps/app-bridge";

import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

function parseJsonObject(value?: string): Record<string, unknown> {
  if (!value || typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function buildToolResultPayload(tool?: { result?: string }) {
  let structuredContent: unknown = undefined;
  if (tool?.result) {
    try {
      structuredContent = JSON.parse(tool.result);
    } catch {
      // plain text fallback
    }
  }

  const content = [
    {
      type: "text" as const,
      text: typeof tool?.result === "string" ? tool.result : "",
    },
  ];

  return structuredContent !== undefined
    ? { content, structuredContent }
    : { content };
}

export interface McpAppResource {
  text?: string;
  mimeType?: string;
}

export interface McpAppRendererProps {
  /** Inline HTML content to load directly into the widget iframe. */
  initialHtml?: string;
  /** Resource URI to fetch HTML content from (e.g. "ui://dashboard" or an HTTP/API URL). */
  resourceUri?: string;
  /** Custom handler to resolve an MCP resource URI into HTML text. */
  onReadResource?: (uri: string) => Promise<McpAppResource>;
  /** Custom handler to invoke an MCP tool triggered from within the widget. */
  onCallTool?: (name: string, args?: Record<string, unknown>) => Promise<unknown>;
  /** Optional project ID for Platform usage. */
  projectId?: string;
  /** Optional MCP connector ID for Platform usage. */
  mcpId?: string;
  toolName?: string;
  tool?: {
    args?: string;
    result?: string;
    status: "running" | "done" | "error";
  };
  className?: string;
  height?: number;
  expanded?: boolean;
  onSendMessage?: (text: string) => void;
}

/**
 * McpAppRenderer — renders an interactive MCP App widget inside a sandboxed
 * iframe, connected via AppBridge JSON-RPC-over-postMessage.
 */
export function McpAppRenderer({
  projectId,
  mcpId,
  resourceUri,
  initialHtml,
  onReadResource,
  onCallTool,
  toolName,
  tool,
  className,
  height = 450,
  expanded: initialExpanded = true,
  onSendMessage,
}: McpAppRendererProps) {
  const iframeRef = React.useRef<HTMLIFrameElement | null>(null);
  const bridgeRef = React.useRef<AppBridge | null>(null);
  const resultSentRef = React.useRef(false);
  const onSendMessageRef = React.useRef(onSendMessage);
  onSendMessageRef.current = onSendMessage;
  const [html, setHtml] = React.useState<string | null>(initialHtml || null);
  const [loading, setLoading] = React.useState(!initialHtml);
  const [error, setError] = React.useState<string | null>(null);
  const [expanded, setExpanded] = React.useState(initialExpanded);
  const [contentHeight, setContentHeight] = React.useState<number | null>(null);

  // 1. Resolve widget HTML content
  React.useEffect(() => {
    if (initialHtml) {
      setHtml(initialHtml);
      setLoading(false);
      setError(null);
      return;
    }

    if (!resourceUri) {
      setError("No HTML content or resource URI provided for MCP App");
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setHtml(null);
    setContentHeight(null);

    const resolveHtml = async (): Promise<string> => {
      // 1. If custom onReadResource handler is provided by caller
      if (onReadResource) {
        const res = await onReadResource(resourceUri);
        if (!res?.text) throw new Error("Empty resource response from MCP server");
        return res.text;
      }

      // 2. If resourceUri is an HTTP URL, fetch it directly
      if (resourceUri.startsWith("http://") || resourceUri.startsWith("https://") || resourceUri.startsWith("/")) {
        const res = await fetch(resourceUri);
        if (!res.ok) throw new Error(`Failed to fetch MCP resource (${res.status})`);
        return res.text();
      }

      // 3. If running inside Persona Platform with projectId + mcpId
      if (projectId && mcpId) {
        const res = await fetch(`/api/v1/projects/${projectId}/mcps/${mcpId}/resource?uri=${encodeURIComponent(resourceUri)}`);
        if (!res.ok) throw new Error(`Failed to fetch MCP resource (${res.status})`);
        const json = await res.json();
        const text = json?.data?.text || json?.text;
        if (!text) throw new Error("Empty resource response from MCP server");
        return text;
      }

      throw new Error(`Cannot resolve MCP resource "${resourceUri}". Provide initialHtml, onReadResource, or a valid URL.`);
    };

    resolveHtml()
      .then((text) => {
        if (cancelled) return;
        setHtml(text);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const e = err as { response?: { data?: { message?: string } }; message?: string };
        const msg = e?.response?.data?.message || e.message || "Failed to load MCP App";
        setError(msg);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [initialHtml, resourceUri, onReadResource, projectId, mcpId]);

  // 2. Wire up AppBridge and load HTML into sandboxed iframe
  React.useEffect(() => {
    if (!html || !iframeRef.current) return;

    const iframe = iframeRef.current;
    resultSentRef.current = false;

    const bridge = new AppBridge(
      null,
      { name: "persona-platform", version: "1.0.0" },
      {
        message: { text: {} },
        openLinks: {},
        serverTools: {},
        serverResources: {},
        updateModelContext: { text: {} },
      },
      {
        hostContext: {
          theme:
            typeof document !== "undefined" && document.documentElement.classList.contains("dark")
              ? "dark"
              : "light",
          platform: "web",
          displayMode: "inline",
          availableDisplayModes: ["inline"],
        },
      }
    );

    bridge.oncalltool = async (params: { name: string; arguments?: Record<string, unknown> }) => {
      if (onCallTool) {
        return onCallTool(params.name, params.arguments);
      }
      if (projectId && mcpId) {
        const res = await fetch(`/api/v1/projects/${projectId}/mcps/${mcpId}/call-tool`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: params.name, arguments: params.arguments || {} }),
        });
        const json = await res.json();
        return json?.data ?? json;
      }
      return null;
    };

    bridge.onreadresource = async (params: { uri: string }) => {
      if (onReadResource) {
        const res = await onReadResource(params.uri);
        return {
          contents: [
            {
              uri: params.uri,
              mimeType: res.mimeType || "text/html",
              text: res.text || "",
            },
          ],
        };
      }
      if (projectId && mcpId) {
        const res = await fetch(`/api/v1/projects/${projectId}/mcps/${mcpId}/resource?uri=${encodeURIComponent(params.uri)}`);
        const json = await res.json();
        const data = json?.data;
        return {
          contents: [
            {
              uri: params.uri,
              mimeType: data?.mimeType || "text/html",
              text: data?.text || "",
            },
          ],
        };
      }
      return { contents: [] };
    };

    bridge.onopenlink = async ({ url }: { url: string }) => {
      if (typeof window !== "undefined") {
        window.open(url, "_blank", "noopener,noreferrer");
      }
      return {};
    };

    bridge.onmessage = async ({ content }) => {
      if (Array.isArray(content)) {
        const text = content
          .filter(
            (b): b is { type: "text"; text: string } =>
              b?.type === "text" && typeof (b as { text?: unknown }).text === "string"
          )
          .map((b) => b.text)
          .join("\n")
          .trim();
        if (text) {
          onSendMessageRef.current?.(text);
        }
      }
      return {};
    };
    bridge.onupdatemodelcontext = async () => ({});

    bridge.oninitialized = () => {
      bridge.sendToolInput({ arguments: parseJsonObject(tool?.args) });
      if (tool?.status === "done" && typeof tool?.result === "string") {
        resultSentRef.current = true;
        bridge.sendToolResult(buildToolResultPayload(tool));
      }
    };

    const handleSizeChange = ({ height: newHeight }: { height?: number }) => {
      if (newHeight !== undefined && newHeight !== null) {
        setContentHeight(newHeight);
      }
    };
    bridge.addEventListener("sizechange", handleSizeChange);

    let cancelled = false;
    if (iframe.contentWindow) {
      const transport = new PostMessageTransport(iframe.contentWindow, iframe.contentWindow);
      bridge
        .connect(transport)
        .then(() => {
          if (cancelled) return;
          iframe.srcdoc = html;
        })
        .catch((err) => {
          if (cancelled) return;
          setError(err?.message || "Failed to connect to MCP App bridge");
        });
    }

    bridgeRef.current = bridge;

    return () => {
      cancelled = true;
      bridgeRef.current = null;
      bridge.removeEventListener("sizechange", handleSizeChange);
      bridge.close?.();
    };
  }, [html, projectId, mcpId]);

  // 3. Forward tool result once it arrives
  React.useEffect(() => {
    const bridge = bridgeRef.current;
    if (!bridge || resultSentRef.current) return;
    if (tool?.status !== "done" || typeof tool?.result !== "string") return;
    resultSentRef.current = true;
    bridge.sendToolResult(buildToolResultPayload(tool));
  }, [tool?.status, tool?.result]);

  const toggleExpanded = React.useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  if (error) {
    return (
      <div
        className={cn(
          "rounded-none border border-destructive/30 bg-destructive/10 p-4 text-destructive",
          className
        )}
      >
        <div className="flex items-start gap-2.5">
          <WarningCircleIcon className="size-5 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-xs font-semibold">Failed to load MCP App</p>
            <p className="mt-1 text-xs opacity-80">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group relative rounded-none border border-border bg-card overflow-hidden transition-all",
        className
      )}
    >
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5 font-mono text-[11px] truncate">
          <AppWindowIcon className="size-3.5 text-primary shrink-0" />
          <span className="font-semibold text-foreground">{toolName || "MCP App"}</span>
          <span className="text-muted-foreground truncate">({resourceUri})</span>
        </div>

        <button
          type="button"
          onClick={toggleExpanded}
          className="flex size-6 items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          title={expanded ? "Collapse" : "Expand"}
        >
          {expanded ? (
            <ArrowsInIcon className="size-3.5" />
          ) : (
            <ArrowsOutIcon className="size-3.5" />
          )}
        </button>
      </div>

      {/* Loading state */}
      {loading && (
        <div
          className="flex flex-col items-center justify-center gap-2 p-8 text-muted-foreground"
          style={{ height: `${height}px` }}
        >
          <Spinner className="size-5 text-primary" />
          <p className="text-xs">Loading MCP App…</p>
        </div>
      )}

      {/* Sandboxed iframe */}
      <iframe
        ref={iframeRef}
        sandbox="allow-scripts allow-forms"
        className={cn(
          "w-full border-0 transition-[height] duration-200 ease-in-out bg-white dark:bg-zinc-950",
          loading && "hidden"
        )}
        style={
          !loading
            ? {
                height:
                  contentHeight !== null
                    ? `${contentHeight}px`
                    : expanded
                      ? "calc(80vh - 8rem)"
                      : `${height}px`,
                maxHeight: expanded ? "calc(90vh - 6rem)" : `${height}px`,
              }
            : undefined
        }
        title={`MCP App: ${toolName || resourceUri}`}
      />
    </div>
  );
}
