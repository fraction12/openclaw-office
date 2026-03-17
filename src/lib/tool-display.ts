/**
 * Tool display helpers — turn raw tool names/args into friendly UI text.
 */

import type { ToolInfo } from "@/gateway/types";

const TOOL_ICONS: Record<string, string> = {
  web_search: "🔍",
  web_fetch: "🌐",
  Read: "📄",
  read: "📄",
  Write: "✏️",
  write: "✏️",
  Edit: "✏️",
  edit: "✏️",
  exec: "⚡",
  image: "🖼️",
  memory_search: "🧠",
  memory_get: "🧠",
  sessions_spawn: "🔀",
  sessions_send: "📨",
  sessions_list: "📋",
  sessions_yield: "⏸️",
  subagents: "👥",
};

const TOOL_LABELS: Record<string, string> = {
  web_search: "Searching",
  web_fetch: "Fetching page",
  Read: "Reading",
  read: "Reading",
  Write: "Writing",
  write: "Writing",
  Edit: "Editing",
  edit: "Editing",
  exec: "Running",
  image: "Analyzing image",
  memory_search: "Searching memory",
  memory_get: "Reading memory",
  sessions_spawn: "Spawning agent",
  sessions_send: "Messaging",
  sessions_list: "Listing sessions",
  sessions_yield: "Yielding",
  subagents: "Managing agents",
};

function extractArg(args: Record<string, unknown> | undefined, ...keys: string[]): string | undefined {
  if (!args) return undefined;
  for (const key of keys) {
    const val = args[key];
    if (typeof val === "string" && val.length > 0) return val;
  }
  return undefined;
}

function shortenPath(path: string, maxLen = 30): string {
  if (path.length <= maxLen) return path;
  const parts = path.split("/");
  if (parts.length <= 2) return `…${path.slice(-maxLen)}`;
  return `…/${parts.slice(-2).join("/")}`.slice(-maxLen);
}

/** Get a short icon for the tool. */
export function getToolIcon(toolName: string): string {
  return TOOL_ICONS[toolName] ?? "🔧";
}

/** Get a friendly one-line label for a tool call with optional context from args. */
export function getToolLabel(tool: ToolInfo | { name: string; args?: Record<string, unknown> }): string {
  const base = TOOL_LABELS[tool.name] ?? tool.name;
  const args = "args" in tool ? tool.args : undefined;

  switch (tool.name) {
    case "web_search": {
      const query = extractArg(args, "query");
      return query ? `Searching "${query.slice(0, 40)}"` : base;
    }
    case "web_fetch": {
      const url = extractArg(args, "url");
      if (url) {
        try {
          return `Fetching ${new URL(url).hostname}`;
        } catch {
          return `Fetching page`;
        }
      }
      return base;
    }
    case "Read":
    case "read": {
      const file = extractArg(args, "file_path", "path");
      return file ? `Reading ${shortenPath(file)}` : base;
    }
    case "Write":
    case "write": {
      const file = extractArg(args, "file_path", "path");
      return file ? `Writing ${shortenPath(file)}` : base;
    }
    case "Edit":
    case "edit": {
      const file = extractArg(args, "file_path", "path");
      return file ? `Editing ${shortenPath(file)}` : base;
    }
    case "exec": {
      const cmd = extractArg(args, "command");
      return cmd ? `Running ${cmd.slice(0, 35)}` : base;
    }
    case "sessions_spawn": {
      const task = extractArg(args, "task");
      const agentId = extractArg(args, "agentId");
      if (agentId) return `Spawning ${agentId}`;
      if (task) return `Spawning: ${task.slice(0, 30)}`;
      return base;
    }
    case "sessions_send": {
      const target = extractArg(args, "agentId", "label", "sessionKey");
      return target ? `Messaging ${target.slice(0, 20)}` : base;
    }
    case "memory_search": {
      const query = extractArg(args, "query");
      return query ? `Memory: "${query.slice(0, 30)}"` : base;
    }
    default:
      return base;
  }
}

/** Get a compact pill label (max ~25 chars) */
export function getToolPillLabel(tool: ToolInfo | { name: string; args?: Record<string, unknown> }): string {
  const full = getToolLabel(tool);
  return full.length > 28 ? `${full.slice(0, 25)}…` : full;
}
