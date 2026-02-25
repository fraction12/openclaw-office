import { useOfficeStore } from "@/store/office-store";

export function MetricsPanel() {
  const metrics = useOfficeStore((s) => s.globalMetrics);

  const cards = [
    {
      label: "Active Agents",
      value: `${metrics.activeAgents}/${metrics.totalAgents}`,
      color: "#3b82f6",
    },
    {
      label: "Total Tokens",
      value: formatTokens(metrics.totalTokens),
      color: "#22c55e",
    },
    {
      label: "Collaboration",
      value: `${Math.round(metrics.collaborationHeat)}%`,
      color: "#f97316",
    },
    {
      label: "Token Rate",
      value: `${metrics.tokenRate.toFixed(0)}/min`,
      color: "#a855f7",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-1.5 border-b border-gray-800 p-3">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded bg-gray-900 px-2 py-1.5 text-center"
        >
          <div
            className="text-lg font-bold"
            style={{ color: card.color }}
          >
            {card.value}
          </div>
          <div className="text-[10px] text-gray-500">{card.label}</div>
        </div>
      ))}
    </div>
  );
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}
