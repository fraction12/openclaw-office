import { useEffect, useState, useCallback } from "react";
import { Clock, Play, Pause, RefreshCw, Zap } from "lucide-react";
import { getAdapter } from "@/gateway/adapter-provider";
import type { CronTask } from "@/gateway/adapter-types";

export function CronPanel() {
  const [tasks, setTasks] = useState<CronTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    const adapter = getAdapter();
    if (!adapter) return;
    setLoading(true);
    setError(null);
    try {
      const list = await adapter.cronList();
      setTasks(list.sort((a, b) => (a.state.nextRunAtMs ?? Infinity) - (b.state.nextRunAtMs ?? Infinity)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load crons");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
    const timer = setInterval(fetchTasks, 30_000);
    return () => clearInterval(timer);
  }, [fetchTasks]);

  const handleToggle = useCallback(async (id: string, enabled: boolean) => {
    const adapter = getAdapter();
    if (!adapter) return;
    try {
      await adapter.cronUpdate(id, { enabled } as never);
      setTasks((prev) => prev.map((t) => t.id === id ? { ...t, enabled } : t));
    } catch { /* best-effort */ }
  }, []);

  const handleRun = useCallback(async (id: string) => {
    const adapter = getAdapter();
    if (!adapter) return;
    try {
      await adapter.cronRun(id);
    } catch { /* best-effort */ }
  }, []);

  if (error && tasks.length === 0) {
    return (
      <div className="px-3 py-4 text-center text-xs text-red-400">
        {error}
        <button onClick={fetchTasks} className="ml-2 text-blue-400 underline">retry</button>
      </div>
    );
  }

  if (tasks.length === 0 && !loading) {
    return (
      <div className="px-3 py-4 text-center text-xs text-gray-400 dark:text-gray-500">
        No cron jobs configured
      </div>
    );
  }

  const enabledCount = tasks.filter((t) => t.enabled).length;

  return (
    <div>
      {/* Summary bar */}
      <div className="flex items-center justify-between border-b border-gray-100 px-3 py-1.5 dark:border-gray-800">
        <span className="text-[10px] text-gray-400 dark:text-gray-500">
          {enabledCount}/{tasks.length} active
        </span>
        <button
          onClick={fetchTasks}
          disabled={loading}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          title="Refresh"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Cron list */}
      {tasks.map((task) => {
        const isExpanded = expandedId === task.id;
        const nextRun = task.state.nextRunAtMs ? formatRelativeTime(task.state.nextRunAtMs) : "—";
        const lastRun = task.state.lastRunAtMs ? formatRelativeTime(task.state.lastRunAtMs) : "never";
        const isRunning = task.state.runningAtMs != null;

        return (
          <div
            key={task.id}
            className="border-b border-gray-50 dark:border-gray-800"
          >
            <button
              onClick={() => setExpandedId(isExpanded ? null : task.id)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <Clock className={`h-3.5 w-3.5 shrink-0 ${task.enabled ? "text-blue-500" : "text-gray-300 dark:text-gray-600"}`} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className={`truncate text-xs font-medium ${task.enabled ? "text-gray-800 dark:text-gray-200" : "text-gray-400 dark:text-gray-500"}`}>
                    {task.name || task.id}
                  </span>
                  {isRunning && (
                    <span className="inline-flex h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                  )}
                </div>
                <div className="text-[10px] text-gray-400 dark:text-gray-500">
                  {task.enabled ? `next: ${nextRun}` : "disabled"} · last: {lastRun}
                </div>
              </div>
              <span className="text-[10px] text-gray-300">{isExpanded ? "▼" : "▶"}</span>
            </button>

            {isExpanded && (
              <div className="space-y-1.5 bg-slate-50 px-3 py-2 dark:bg-slate-800/40">
                {/* Schedule info */}
                <div className="text-[11px] text-slate-600 dark:text-slate-400">
                  <span className="font-medium">Schedule:</span> {formatSchedule(task)}
                </div>
                {task.agentId && (
                  <div className="text-[11px] text-slate-600 dark:text-slate-400">
                    <span className="font-medium">Agent:</span> {task.agentId}
                  </div>
                )}
                {task.payload && (
                  <div className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-3">
                    <span className="font-medium">Payload:</span> {getPayloadPreview(task.payload)}
                  </div>
                )}
                {task.state.lastError && (
                  <div className="text-[11px] text-red-500 dark:text-red-400">
                    <span className="font-medium">Error:</span> {task.state.lastError}
                  </div>
                )}

                {/* Controls */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleToggle(task.id, !task.enabled); }}
                    className={`flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
                      task.enabled
                        ? "bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-400"
                        : "bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/40 dark:text-green-400"
                    }`}
                  >
                    {task.enabled ? <><Pause className="h-2.5 w-2.5" /> Disable</> : <><Play className="h-2.5 w-2.5" /> Enable</>}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleRun(task.id); }}
                    disabled={isRunning}
                    className="flex items-center gap-1 rounded bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700 hover:bg-blue-200 disabled:opacity-40 dark:bg-blue-900/40 dark:text-blue-400 dark:hover:bg-blue-900/60 transition-colors"
                  >
                    <Zap className="h-2.5 w-2.5" /> Run Now
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function formatSchedule(task: CronTask): string {
  const sched = task.schedule;
  if (!sched) return "unknown";
  if (sched.kind === "cron") return `${sched.expr}${sched.tz ? ` (${sched.tz})` : ""}`;
  if (sched.kind === "every") {
    const ms = sched.everyMs;
    if (ms < 60_000) return `every ${Math.round(ms / 1000)}s`;
    if (ms < 3_600_000) return `every ${Math.round(ms / 60_000)}m`;
    return `every ${Math.round(ms / 3_600_000)}h`;
  }
  if (sched.kind === "at") return `at ${sched.at}`;
  return "unknown";
}

function getPayloadPreview(payload: CronTask["payload"]): string {
  if (payload.kind === "agentTurn") {
    const msg = payload.message;
    return msg.length > 200 ? msg.slice(0, 200) + "…" : msg;
  }
  if (payload.kind === "systemEvent") return `[system] ${payload.text.slice(0, 100)}`;
  if (payload.kind === "webhook") return `[webhook] ${payload.url}`;
  return (payload as { kind: string }).kind;
}

function formatRelativeTime(ms: number): string {
  const diff = ms - Date.now();
  const absDiff = Math.abs(diff);
  const past = diff < 0;

  if (absDiff < 60_000) {
    const secs = Math.round(absDiff / 1000);
    return past ? `${secs}s ago` : `in ${secs}s`;
  }
  if (absDiff < 3_600_000) {
    const mins = Math.round(absDiff / 60_000);
    return past ? `${mins}m ago` : `in ${mins}m`;
  }
  if (absDiff < 86_400_000) {
    const hrs = Math.round(absDiff / 3_600_000);
    return past ? `${hrs}h ago` : `in ${hrs}h`;
  }
  const days = Math.round(absDiff / 86_400_000);
  return past ? `${days}d ago` : `in ${days}d`;
}
