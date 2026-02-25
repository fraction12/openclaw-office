import { useState, useMemo } from "react";
import { useOfficeStore } from "@/store/office-store";
import { Avatar } from "@/components/shared/Avatar";
import { STATUS_COLORS, STATUS_LABELS } from "@/lib/constants";
import { AgentDetailPanel } from "@/components/panels/AgentDetailPanel";
import { MetricsPanel } from "@/components/panels/MetricsPanel";
import { EventTimeline } from "@/components/panels/EventTimeline";
import type { AgentVisualStatus } from "@/gateway/types";

type FilterTag = "all" | "active" | "idle" | "error";

const FILTER_TAGS: { key: FilterTag; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "active", label: "活跃" },
  { key: "idle", label: "空闲" },
  { key: "error", label: "错误" },
];

export function Sidebar() {
  const agents = useOfficeStore((s) => s.agents);
  const selectedAgentId = useOfficeStore((s) => s.selectedAgentId);
  const selectAgent = useOfficeStore((s) => s.selectAgent);
  const collapsed = useOfficeStore((s) => s.sidebarCollapsed);
  const setSidebarCollapsed = useOfficeStore((s) => s.setSidebarCollapsed);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterTag>("all");

  const agentList = useMemo(() => {
    let list = Array.from(agents.values());

    if (search) {
      const q = search.toLowerCase();
      list = list.filter((a) => a.name.toLowerCase().includes(q));
    }

    if (filter === "active") {
      list = list.filter(
        (a) => a.status !== "idle" && a.status !== "offline",
      );
    } else if (filter === "idle") {
      list = list.filter((a) => a.status === "idle");
    } else if (filter === "error") {
      list = list.filter((a) => a.status === "error");
    }

    return list;
  }, [agents, search, filter]);

  if (collapsed) {
    return (
      <aside className="flex w-12 flex-col items-center border-l border-gray-800 bg-gray-950 py-3">
        <button
          onClick={() => setSidebarCollapsed(false)}
          className="text-gray-400 hover:text-gray-200"
          title="展开侧栏"
        >
          ◀
        </button>
      </aside>
    );
  }

  return (
    <aside className="flex w-80 flex-col border-l border-gray-800 bg-gray-950">
      <div className="flex items-center justify-between border-b border-gray-800 px-3 py-2">
        <span className="text-sm font-medium text-gray-300">Agents</span>
        <button
          onClick={() => setSidebarCollapsed(true)}
          className="text-gray-500 hover:text-gray-300"
          title="折叠侧栏"
        >
          ▶
        </button>
      </div>

      <MetricsPanel />

      <div className="border-b border-gray-800 px-3 py-2">
        <input
          type="text"
          placeholder="搜索 Agent..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded bg-gray-900 px-2 py-1 text-sm text-gray-200 placeholder-gray-500 outline-none focus:ring-1 focus:ring-blue-500"
        />
        <div className="mt-2 flex gap-1">
          {FILTER_TAGS.map((tag) => (
            <button
              key={tag.key}
              onClick={() => setFilter(tag.key)}
              className={`rounded px-2 py-0.5 text-xs transition-colors ${
                filter === tag.key
                  ? "bg-blue-600 text-white"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700"
              }`}
            >
              {tag.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {agentList.map((agent) => (
          <button
            key={agent.id}
            onClick={() => selectAgent(agent.id)}
            className={`flex w-full items-center gap-3 border-b border-gray-800/50 px-3 py-2.5 text-left transition-colors hover:bg-gray-900 ${
              selectedAgentId === agent.id ? "bg-gray-800/60" : ""
            }`}
          >
            <Avatar agentId={agent.id} agentName={agent.name} size={28} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-gray-200">
                {agent.name}
              </div>
              <div className="flex items-center gap-1.5">
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{
                    backgroundColor:
                      STATUS_COLORS[agent.status as AgentVisualStatus],
                  }}
                />
                <span className="text-xs text-gray-500">
                  {STATUS_LABELS[agent.status as AgentVisualStatus]}
                </span>
                <span className="text-xs text-gray-600">
                  · {timeAgo(agent.lastActiveAt)}
                </span>
              </div>
            </div>
          </button>
        ))}
        {agentList.length === 0 && (
          <div className="px-3 py-6 text-center text-sm text-gray-600">
            无匹配 Agent
          </div>
        )}
      </div>

      {selectedAgentId && <AgentDetailPanel />}

      <EventTimeline />
    </aside>
  );
}

function timeAgo(ts: number): string {
  const diff = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diff < 5) return "刚刚";
  if (diff < 60) return `${diff}秒前`;
  if (diff < 3600) return `${Math.floor(diff / 60)}分前`;
  return `${Math.floor(diff / 3600)}时前`;
}
