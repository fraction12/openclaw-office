import type { GlobalMetrics, VisualAgent } from "@/gateway/types";

export function computeMetrics(
  agents: Map<string, VisualAgent>,
  prevMetrics: GlobalMetrics,
): GlobalMetrics {
  let activeCount = 0;

  for (const agent of agents.values()) {
    if (agent.status !== "idle" && agent.status !== "offline") {
      activeCount++;
    }
  }

  const totalAgents = agents.size;
  const collaborationHeat =
    totalAgents > 0 ? Math.min((activeCount / totalAgents) * 100, 100) : 0;

  return {
    activeAgents: activeCount,
    totalAgents,
    totalTokens: prevMetrics.totalTokens,
    tokenRate: prevMetrics.tokenRate,
    collaborationHeat,
  };
}
