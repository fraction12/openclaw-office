import type { AgentVisualStatus, AgentZone, VisualAgent } from "@/gateway/types";

type AgentRoleLike = Pick<VisualAgent, "isSubAgent">;
type AgentStateLike = Pick<VisualAgent, "isSubAgent" | "status">;

export function getWorkZoneForAgent(agent: AgentRoleLike): AgentZone {
  return agent.isSubAgent ? "hotDesk" : "desk";
}

export function getIdleZone(): AgentZone {
  return "lounge";
}

export function isWorkingStatus(status: AgentVisualStatus): boolean {
  return status === "active";
}

export function getPreferredZoneForStatus(
  agent: AgentRoleLike,
  status: AgentVisualStatus,
): AgentZone {
  return isWorkingStatus(status) ? getWorkZoneForAgent(agent) : getIdleZone();
}

export function getPreferredZone(agent: AgentStateLike): AgentZone {
  return getPreferredZoneForStatus(agent, agent.status);
}
