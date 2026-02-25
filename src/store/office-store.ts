import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { enableMapSet } from "immer";
import { parseAgentEvent } from "@/gateway/event-parser";

enableMapSet();
import { applyEventToAgent } from "./agent-reducer";
import { computeMetrics } from "./metrics-reducer";
import { allocatePosition } from "@/lib/position-allocator";
import type {
  AgentEventPayload,
  AgentSummary,
  AgentVisualStatus,
  CollaborationLink,
  ConnectionStatus,
  EventHistoryItem,
  OfficeStore,
  ViewMode,
  VisualAgent,
} from "@/gateway/types";

const EVENT_HISTORY_LIMIT = 200;
const LINK_TIMEOUT_MS = 60_000;

function createVisualAgent(
  id: string,
  name: string,
  isSubAgent: boolean,
  occupied: Set<string>,
): VisualAgent {
  const position = allocatePosition(id, isSubAgent, occupied);
  return {
    id,
    name,
    status: "idle" as AgentVisualStatus,
    position,
    currentTool: null,
    speechBubble: null,
    lastActiveAt: Date.now(),
    toolCallCount: 0,
    toolCallHistory: [],
    runId: null,
    isSubAgent,
  };
}

function positionKey(pos: { x: number; y: number }): string {
  return `${pos.x},${pos.y}`;
}

export const useOfficeStore = create<OfficeStore>()(
  immer((set) => ({
    agents: new Map(),
    links: [],
    globalMetrics: {
      activeAgents: 0,
      totalAgents: 0,
      totalTokens: 0,
      tokenRate: 0,
      collaborationHeat: 0,
    },
    connectionStatus: "disconnected" as ConnectionStatus,
    connectionError: null,
    selectedAgentId: null,
    viewMode: "2d" as ViewMode,
    eventHistory: [],
    sidebarCollapsed: false,
    runIdMap: new Map(),
    sessionKeyMap: new Map(),

    addAgent: (agent: VisualAgent) => {
      set((state) => {
        state.agents.set(agent.id, agent);
        state.globalMetrics = computeMetrics(state.agents, state.globalMetrics);
      });
    },

    updateAgent: (id: string, patch: Partial<VisualAgent>) => {
      set((state) => {
        const agent = state.agents.get(id);
        if (agent) {
          Object.assign(agent, patch);
          state.globalMetrics = computeMetrics(state.agents, state.globalMetrics);
        }
      });
    },

    removeAgent: (id: string) => {
      set((state) => {
        state.agents.delete(id);
        if (state.selectedAgentId === id) {
          state.selectedAgentId = null;
        }
        state.globalMetrics = computeMetrics(state.agents, state.globalMetrics);
      });
    },

    initAgents: (summaries: AgentSummary[]) => {
      set((state) => {
        state.agents.clear();
        state.runIdMap.clear();
        state.sessionKeyMap.clear();

        const occupied = new Set<string>();
        for (const summary of summaries) {
          const name =
            summary.identity?.name ?? summary.name ?? summary.id;
          const agent = createVisualAgent(summary.id, name, false, occupied);
          occupied.add(positionKey(agent.position));
          state.agents.set(summary.id, agent);
        }

        state.globalMetrics = computeMetrics(state.agents, state.globalMetrics);
      });
    },

    processAgentEvent: (event: AgentEventPayload) => {
      set((state) => {
        const parsed = parseAgentEvent(event);

        // Resolve agentId from runId
        let agentId = state.runIdMap.get(event.runId);

        if (!agentId && event.sessionKey) {
          const sessionAgents = state.sessionKeyMap.get(event.sessionKey);
          if (sessionAgents && sessionAgents.length > 0) {
            agentId = sessionAgents[0];
          }
        }

        if (!agentId) {
          // Create temporary agent for unknown runId
          agentId = event.runId;
          if (!state.agents.has(agentId)) {
            const occupied = new Set<string>();
            for (const a of state.agents.values()) {
              occupied.add(positionKey(a.position));
            }
            const agent = createVisualAgent(
              agentId,
              `Agent-${agentId.slice(0, 6)}`,
              true,
              occupied,
            );
            agent.runId = event.runId;
            state.agents.set(agentId, agent);
          }
        }

        state.runIdMap.set(event.runId, agentId);

        if (event.sessionKey) {
          const existing = state.sessionKeyMap.get(event.sessionKey) ?? [];
          if (!existing.includes(agentId)) {
            existing.push(agentId);
            state.sessionKeyMap.set(event.sessionKey, existing);
          }
          updateCollaborationLinks(state, event.sessionKey, agentId);
        }

        const agent = state.agents.get(agentId);
        if (agent) {
          applyEventToAgent(agent, parsed);
        }

        // Event history
        const historyItem: EventHistoryItem = {
          timestamp: event.ts,
          agentId,
          agentName: agent?.name ?? agentId,
          stream: event.stream,
          summary: parsed.summary,
        };
        state.eventHistory.push(historyItem);
        if (state.eventHistory.length > EVENT_HISTORY_LIMIT) {
          state.eventHistory = state.eventHistory.slice(-EVENT_HISTORY_LIMIT);
        }

        state.globalMetrics = computeMetrics(state.agents, state.globalMetrics);
      });
    },

    selectAgent: (id: string | null) => {
      set((state) => {
        state.selectedAgentId =
          state.selectedAgentId === id ? null : id;
      });
    },

    setViewMode: (mode: ViewMode) => {
      set((state) => {
        state.viewMode = mode;
      });
    },

    setConnectionStatus: (status: ConnectionStatus, error?: string) => {
      set((state) => {
        state.connectionStatus = status;
        state.connectionError = error ?? null;
      });
    },

    setSidebarCollapsed: (collapsed: boolean) => {
      set((state) => {
        state.sidebarCollapsed = collapsed;
      });
    },

    updateMetrics: () => {
      set((state) => {
        state.globalMetrics = computeMetrics(state.agents, state.globalMetrics);
      });
    },
  })),
);

function updateCollaborationLinks(
  state: { links: CollaborationLink[]; sessionKeyMap: Map<string, string[]> },
  sessionKey: string,
  agentId: string,
): void {
  const agents = state.sessionKeyMap.get(sessionKey);
  if (!agents || agents.length < 2) return;

  const now = Date.now();
  for (const otherId of agents) {
    if (otherId === agentId) continue;

    const existingIdx = state.links.findIndex(
      (l) =>
        l.sessionKey === sessionKey &&
        ((l.sourceId === agentId && l.targetId === otherId) ||
          (l.sourceId === otherId && l.targetId === agentId)),
    );

    if (existingIdx >= 0) {
      const link = state.links[existingIdx];
      link.lastActivityAt = now;
      link.strength = Math.min(link.strength + 0.1, 1);
    } else {
      state.links.push({
        sourceId: agentId,
        targetId: otherId,
        sessionKey,
        strength: 0.3,
        lastActivityAt: now,
      });
    }
  }

  // Decay stale links
  state.links = state.links.filter(
    (l) => now - l.lastActivityAt < LINK_TIMEOUT_MS,
  );
}
