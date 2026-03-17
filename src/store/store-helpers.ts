import { enableMapSet } from "immer";
import type {
  AgentSummary,
  AgentVisualStatus,
  AgentZone,
  ThemeMode,
  VisualAgent,
} from "@/gateway/types";
import { CORRIDOR_ENTRANCE, ZONES } from "@/lib/constants";
import { getAgentDisplayName } from "@/lib/agent-identities";
import { calculateLoungePositions, allocatePosition, getReservedDeskPosition } from "@/lib/position-allocator";

enableMapSet();

export const EVENT_HISTORY_LIMIT = 200;
export const DEFAULT_CHAT_DOCK_HEIGHT = 300;
export const THEME_STORAGE_KEY = "openclaw-theme";
export const CHAT_DOCK_HEIGHT_KEY = "openclaw-chat-dock-height";
export const LINK_TIMEOUT_MS = 60_000;
export const LOUNGE_TO_HOTDESK_DEBOUNCE_MS = 500;
export const HOTDESK_TO_LOUNGE_DELAY_MS = 30_000;
export const REMOVED_IDS_TTL_MS = 30_000;
export const UNCONFIRMED_TIMEOUT_MS = 5_000;
export const MEETING_GATHERING_THROTTLE_MS = 500;

export function isActiveStatus(status: AgentVisualStatus): boolean {
  return status === "thinking" || status === "tool_calling" || status === "speaking" || status === "spawning";
}

export function getInitialChatDockHeight(): number {
  if (typeof window === "undefined") return DEFAULT_CHAT_DOCK_HEIGHT;
  const stored = localStorage.getItem(CHAT_DOCK_HEIGHT_KEY);
  if (stored) {
    const parsed = parseInt(stored, 10);
    if (!Number.isNaN(parsed) && parsed >= 150 && parsed <= 800) return parsed;
  }
  return DEFAULT_CHAT_DOCK_HEIGHT;
}

export function getInitialTheme(): ThemeMode {
  if (typeof window === "undefined") return "dark";
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  return stored === "light" || stored === "dark" ? stored : "dark";
}

export function getInitialBloom(): boolean {
  if (typeof window === "undefined") return true;
  return window.devicePixelRatio >= 1.5;
}

export function positionKey(pos: { x: number; y: number }): string {
  return `${pos.x},${pos.y}`;
}

export function createVisualAgent(
  id: string,
  name: string,
  isSubAgent: boolean,
  occupied: Set<string>,
  confirmed = true,
): VisualAgent {
  if (!confirmed) {
    return {
      id,
      name,
      status: "idle",
      position: { ...CORRIDOR_ENTRANCE },
      currentTool: null,
      speechBubble: null,
      confidence: 1,
      derivationReason: "Awaiting evidence.",
      lastActiveAt: Date.now(),
      toolCallCount: 0,
      toolCallHistory: [],
      runId: null,
      isSubAgent: false,
      isPlaceholder: false,
      parentAgentId: null,
      childAgentIds: [],
      zone: "corridor",
      originalPosition: null,
      movement: null,
      confirmed: false,
      cronLabel: null,
    };
  }

  const reservedDeskPosition = !isSubAgent ? getReservedDeskPosition(id) : null;
  const position = reservedDeskPosition ?? allocatePosition(id, isSubAgent, occupied);
  return {
    id,
    name,
    status: "idle",
    position,
    currentTool: null,
    speechBubble: null,
    confidence: 1,
    derivationReason: "Awaiting evidence.",
    lastActiveAt: Date.now(),
    toolCallCount: 0,
    toolCallHistory: [],
    runId: null,
    isSubAgent,
    isPlaceholder: false,
    parentAgentId: null,
    childAgentIds: [],
    zone: isSubAgent ? "hotDesk" : "desk",
    originalPosition: null,
    movement: null,
    confirmed: true,
    cronLabel: null,
  };
}

export function isConfirmedMainAgent(agent: VisualAgent | undefined): boolean {
  return Boolean(agent && agent.confirmed && !agent.isSubAgent && !agent.isPlaceholder);
}

export function pickPreferredMappedAgentId(
  state: { agents: Map<string, VisualAgent> },
  agentIds: string[],
): string | undefined {
  return agentIds.find((id) => isConfirmedMainAgent(state.agents.get(id)))
    ?? agentIds.find((id) => {
      const agent = state.agents.get(id);
      return agent && agent.confirmed && !agent.isPlaceholder;
    })
    ?? agentIds[0];
}

export function nextPlaceholderIndex(agents: Map<string, VisualAgent>): number {
  let maxIdx = -1;
  for (const a of agents.values()) {
    if (a.id.startsWith("placeholder-")) {
      const idx = parseInt(a.id.slice("placeholder-".length), 10);
      if (!Number.isNaN(idx) && idx > maxIdx) maxIdx = idx;
    }
  }
  return maxIdx + 1;
}

export function allocateNextPosition(
  agents: Map<string, VisualAgent>,
  toZone: AgentZone,
  maxSubAgents: number,
): { x: number; y: number } {
  if (toZone === "lounge") {
    const loungePositions = calculateLoungePositions(maxSubAgents);
    const occupied = new Set<string>();
    for (const a of agents.values()) if (a.zone === "lounge") occupied.add(positionKey(a.position));
    return loungePositions.find((p) => !occupied.has(positionKey(p))) ?? loungePositions[0] ?? { x: ZONES.lounge.x + 60, y: ZONES.lounge.y + 40 };
  }

  const occupied = new Set<string>();
  for (const a of agents.values()) if (a.zone === toZone) occupied.add(positionKey(a.position));
  return allocatePosition(`temp-${Date.now()}`, toZone === "hotDesk", occupied);
}

export function activateFromLoungePlaceholder(
  state: { agents: Map<string, VisualAgent>; maxSubAgents: number },
  agent: VisualAgent,
): void {
  let placeholder: VisualAgent | undefined;
  for (const a of state.agents.values()) {
    if (a.isPlaceholder && a.zone === "lounge") {
      placeholder = a;
      break;
    }
  }

  if (placeholder) {
    agent.position = { ...placeholder.position };
    agent.zone = "lounge";
    state.agents.delete(placeholder.id);
    return;
  }

  const loungePositions = calculateLoungePositions(state.maxSubAgents);
  const loungeOccupied = new Set<string>();
  for (const a of state.agents.values()) if (a.zone === "lounge") loungeOccupied.add(positionKey(a.position));
  agent.position = loungePositions.find((p) => !loungeOccupied.has(positionKey(p))) ?? loungePositions[0] ?? { x: ZONES.lounge.x + 60, y: ZONES.lounge.y + 40 };
  agent.zone = "lounge";
}

export function isRegisteredMainAgentId(
  state: { agents: Map<string, VisualAgent>; sessionKeyMap: Map<string, string[]> },
  agentId: string,
  sessionKey?: string,
): boolean {
  for (const a of state.agents.values()) {
    if (!a.isSubAgent && !a.isPlaceholder && a.confirmed && a.id === agentId) return true;
  }
  if (sessionKey) {
    const mapped = state.sessionKeyMap.get(sessionKey);
    if (mapped) {
      for (const mid of mapped) {
        if (isConfirmedMainAgent(state.agents.get(mid))) return false;
      }
    }
  }
  return false;
}

export function extractParentFromSessionKey(
  state: { agents: Map<string, VisualAgent>; sessionKeyMap: Map<string, string[]> },
  sessionKey: string,
): string | null {
  const parts = sessionKey.split(":");
  const subIdx = parts.indexOf("subagent");
  if (subIdx >= 2) {
    const parentName = parts.slice(1, subIdx).join(":");
    for (const [sk, mapped] of state.sessionKeyMap) {
      if (sk.startsWith(`agent:${parentName}:`) && !sk.includes(":subagent:") && mapped.length > 0) {
        return pickPreferredMappedAgentId(state, mapped) ?? null;
      }
    }
    for (const [id, a] of state.agents) {
      if (!a.isSubAgent && !a.isPlaceholder && (a.id === parentName || a.name === parentName)) return id;
    }
  }
  for (const [id, a] of state.agents) if (!a.isSubAgent && !a.isPlaceholder && a.confirmed) return id;
  return null;
}

export function buildInitialAgents(summaries: AgentSummary[]): Map<string, VisualAgent> {
  const agents = new Map<string, VisualAgent>();
  const occupied = new Set<string>();
  for (const summary of summaries) {
    const name = getAgentDisplayName(summary.id, summary.identity?.name ?? summary.name ?? summary.id);
    const agent = createVisualAgent(summary.id, name, false, occupied);
    occupied.add(positionKey(agent.position));
    agents.set(summary.id, agent);
  }
  return agents;
}
