import { useOfficeStore } from "@/store/office-store";
import type { ConnectionStatus } from "@/gateway/types";

const STATUS_CONFIG: Record<
  ConnectionStatus,
  { color: string; pulse: boolean; label: string }
> = {
  connecting: { color: "#eab308", pulse: true, label: "连接中..." },
  connected: { color: "#22c55e", pulse: false, label: "已连接" },
  reconnecting: { color: "#f97316", pulse: true, label: "重连中" },
  disconnected: { color: "#6b7280", pulse: false, label: "未连接" },
  error: { color: "#ef4444", pulse: false, label: "连接错误" },
};

export function TopBar() {
  const connectionStatus = useOfficeStore((s) => s.connectionStatus);
  const connectionError = useOfficeStore((s) => s.connectionError);
  const metrics = useOfficeStore((s) => s.globalMetrics);

  const statusCfg = STATUS_CONFIG[connectionStatus];

  return (
    <header className="flex h-12 shrink-0 items-center border-b border-gray-800 bg-gray-950 px-4">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold tracking-tight text-gray-100">
          OpenClaw Office
        </h1>
        <span className="rounded-full bg-gray-800 px-2 py-0.5 text-xs text-gray-400">
          v0.1.0
        </span>
      </div>

      <div className="mx-8 flex items-center gap-6 text-sm text-gray-400">
        <span>
          活跃{" "}
          <strong className="text-gray-200">
            {metrics.activeAgents}/{metrics.totalAgents}
          </strong>
        </span>
        <span>
          Tokens{" "}
          <strong className="text-gray-200">
            {formatTokens(metrics.totalTokens)}
          </strong>
        </span>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <div
          className="h-2.5 w-2.5 rounded-full"
          style={{
            backgroundColor: statusCfg.color,
            animation: statusCfg.pulse
              ? "pulse 1.5s ease-in-out infinite"
              : "none",
          }}
        />
        <span className="text-sm text-gray-400">
          {connectionError && connectionStatus === "error"
            ? connectionError
            : statusCfg.label}
        </span>
      </div>
    </header>
  );
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}
