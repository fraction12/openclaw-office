import type { AgentVisualStatus, VisualAgent } from "@/gateway/types";

export interface ConfidenceVisualStyle {
  confidence: number;
  opacity: number;
  ringOpacity: number;
  ringWidth: number;
  ringDasharray?: string;
  emissiveIntensity: number;
}

export function clampConfidence(value?: number | null): number {
  if (typeof value !== "number" || Number.isNaN(value)) return 1;
  return Math.max(0, Math.min(1, value));
}

export function getConfidenceVisualStyle(confidenceValue?: number | null): ConfidenceVisualStyle {
  const confidence = clampConfidence(confidenceValue);

  if (confidence > 0.8) {
    return {
      confidence,
      opacity: 1,
      ringOpacity: 1,
      ringWidth: 3,
      emissiveIntensity: 0.45,
    };
  }

  if (confidence > 0.5) {
    return {
      confidence,
      opacity: 0.84,
      ringOpacity: 0.9,
      ringWidth: 2.5,
      emissiveIntensity: 0.32,
    };
  }

  if (confidence > 0.2) {
    return {
      confidence,
      opacity: 0.58,
      ringOpacity: 0.72,
      ringWidth: 2,
      ringDasharray: "6 4",
      emissiveIntensity: 0.2,
    };
  }

  return {
    confidence,
    opacity: 0.34,
    ringOpacity: 0.55,
    ringWidth: 1.5,
    ringDasharray: "3 5",
    emissiveIntensity: 0.08,
  };
}

export function getStatusIndicator(status: AgentVisualStatus): string | null {
  switch (status) {
    case "sleeping":
      return "zzz";
    case "stale":
      return "◷";
    case "unknown":
      return "?";
    case "disconnected":
      return "⛔";
    case "error":
      return "!";
    default:
      return null;
  }
}

export function getStatusRingDasharray(status: AgentVisualStatus): string | undefined {
  switch (status) {
    case "tool_calling":
    case "stale":
    case "disconnected":
      return "6 3";
    case "unknown":
      return "3 5";
    default:
      return undefined;
  }
}

export function getStatusAnimation(status: AgentVisualStatus): string | undefined {
  switch (status) {
    case "thinking":
      return "agent-pulse 1.5s ease-in-out infinite";
    case "tool_calling":
      return "agent-pulse 2s ease-in-out infinite";
    case "speaking":
      return "agent-pulse 1s ease-in-out infinite";
    case "error":
      return "agent-blink 0.8s ease-in-out infinite";
    case "spawning":
      return "agent-spawn 0.5s ease-out forwards";
    case "sleeping":
      return "agent-pulse 2.8s ease-in-out infinite";
    case "disconnected":
      return "agent-blink 1.4s ease-in-out infinite";
    default:
      return undefined;
  }
}

export function formatLastActive(ts: number): string {
  const diffSeconds = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSeconds < 5) return "just now";
  if (diffSeconds < 60) return `${diffSeconds}s ago`;
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
  return `${Math.floor(diffSeconds / 3600)}h ago`;
}

export function getAgentConfidence(agent: VisualAgent): number {
  if (typeof agent.statusConfidence === "number") return clampConfidence(agent.statusConfidence);
  if (typeof agent.confidence === "number") return clampConfidence(agent.confidence);
  if (agent.isPlaceholder) return 0.15;
  if (!agent.confirmed) return 0.45;
  if (agent.status === "unknown") return 0.1;
  if (agent.status === "stale") return 0.35;
  if (agent.status === "disconnected") return 0.2;
  if (agent.status === "sleeping") return 0.65;
  return 1;
}
