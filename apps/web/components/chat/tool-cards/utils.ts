// Shared parsing helpers for the specialized tool-call renderers below.
// Ported from frontend/src/components/agents/agui/utils.js — trimmed to only
// what the platform's ToolCallCard dispatch needs.

export function tryParseJson(value: string | undefined | null): unknown {
  if (!value || typeof value !== "string") return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

// Tool arguments can arrive double-encoded — LangChain's tool tracer wraps
// stringified args as { input: "<json>" }. Unwrap that envelope so callers
// see the real args (file_path, old_string, todos, ...). Safe on clean args.
export function parseToolArgs(argsText: string | undefined): Record<string, unknown> | null {
  const parsed = tryParseJson(argsText) as Record<string, unknown> | null;
  if (parsed && typeof parsed.input === "string" && Object.keys(parsed).length === 1) {
    return (tryParseJson(parsed.input) as Record<string, unknown> | null) ?? parsed;
  }
  return parsed;
}

const PATH_KEYS = [
  "file_path",
  "filePath",
  "path",
  "filename",
  "fileName",
  "targetFile",
  "TargetFile",
  "target_file",
];

function findPath(args: Record<string, unknown>): string {
  for (const key of PATH_KEYS) {
    if (typeof args[key] === "string") return args[key] as string;
  }
  return "";
}

export function isLsTool(name: string | undefined): boolean {
  if (!name) return false;
  const lower = name.toLowerCase();
  return (
    lower === "ls" ||
    lower === "list_dir" ||
    lower === "list_directory" ||
    lower.includes("list_dir") ||
    lower.includes("list_directory")
  );
}

export function isReadFileTool(name: string | undefined): boolean {
  if (!name) return false;
  const lower = name.toLowerCase();
  return (
    lower === "read_file" ||
    lower === "view_file" ||
    lower.includes("read_file") ||
    lower.includes("view_file")
  );
}

export function isFileWriteTool(name: string | undefined): boolean {
  return (name || "").toLowerCase() === "write_file";
}

export function isFileEditTool(name: string | undefined): boolean {
  return (name || "").toLowerCase() === "edit_file";
}

export function isGrepTool(name: string | undefined): boolean {
  return (name || "").toLowerCase().includes("grep");
}

export interface LsEntry {
  name: string;
  isDir: boolean;
}

export function parseLsResults(resultText: string | undefined): LsEntry[] {
  if (!resultText) return [];

  const parsed = tryParseJson(resultText);
  if (Array.isArray(parsed)) {
    return parsed.map((item) => {
      if (typeof item === "string") {
        const isDir = item.endsWith("/") || item.includes("(directory)");
        return { name: item.replace(/\(directory\)/g, "").trim(), isDir };
      }
      const obj = item as Record<string, unknown>;
      return {
        name: (obj.name as string) || (obj.path as string) || "",
        isDir: !!(obj.isDir || obj.is_dir || obj.isDirectory),
      };
    });
  }

  return resultText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const isDir =
        line.endsWith("/") ||
        line.toLowerCase().includes("(directory)") ||
        line.toLowerCase().includes("(dir)");
      const name = line.replace(/\(directory\)/gi, "").replace(/\(dir\)/gi, "").trim();
      return { name, isDir };
    });
}

export interface ReadFileDetails {
  filePath: string;
  content: string;
  otherArgs: Record<string, unknown>;
}

export function getReadFileToolDetails(args: string | undefined, result: string | undefined): ReadFileDetails | null {
  const parsedArgs = parseToolArgs(args) || {};
  const filePath = findPath(parsedArgs);
  if (!filePath) return null;

  const otherArgs: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(parsedArgs)) {
    const isPathKey = PATH_KEYS.some((pk) => pk.toLowerCase() === key.toLowerCase());
    if (!isPathKey) otherArgs[key] = val;
  }

  return { filePath, content: result || "", otherArgs };
}

export interface LsTreeNode {
  name: string;
  path: string;
  isDir: boolean;
  children?: LsTreeNode[];
}

// An `ls` result is flat, but entries can still carry slashes (e.g.
// "/memories/agent/", "/memories/user/") that share a common parent the
// listing itself never names. Group those into a real nested tree — same
// technique as file-explorer-editor.tsx's buildFileTree — so shared
// prefixes collapse into one expandable "memories" node instead of two
// separate top-level rows that both start with "/memories/".
export function buildLsTree(items: LsEntry[]): LsTreeNode[] {
  interface MutableNode {
    name: string;
    path: string;
    isDir: boolean;
    children: Map<string, MutableNode>;
  }
  const root = new Map<string, MutableNode>();

  for (const item of items) {
    const parts = item.name.split("/").filter(Boolean);
    if (parts.length === 0) continue;
    let level = root;
    let currentPath = "";
    parts.forEach((part, i) => {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const isLast = i === parts.length - 1;
      let node = level.get(part);
      if (!node) {
        node = { name: part, path: currentPath, isDir: isLast ? item.isDir : true, children: new Map() };
        level.set(part, node);
      } else if (isLast) {
        node.isDir = item.isDir;
      }
      level = node.children;
    });
  }

  function finalize(map: Map<string, MutableNode>): LsTreeNode[] {
    return Array.from(map.values())
      .sort((a, b) => {
        if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
        return a.name.localeCompare(b.name);
      })
      .map((n) => ({
        name: n.name,
        path: n.path,
        isDir: n.isDir,
        children: n.children.size ? finalize(n.children) : undefined,
      }));
  }

  return finalize(root);
}

// Common code file extensions, used to pick a "code" vs "text" file icon.
export const CODE_EXTENSIONS = [
  "js",
  "jsx",
  "ts",
  "tsx",
  "json",
  "html",
  "css",
  "py",
  "sh",
  "go",
  "rs",
  "md",
  "yaml",
  "yml",
];

export function fileExtOf(fileName: string): string {
  return fileName.includes(".") ? fileName.split(".").pop()!.toLowerCase() : "";
}
