import type { StateCreator } from "zustand";
import type { OfficeStore, SubAgentInfo, VisualAgent } from "@/gateway/types";
import { computeMetrics } from "./metrics-reducer";
import {
  activateFromLoungePlaceholder,
  buildInitialAgents,
  createVisualAgent,
  nextPlaceholderIndex,
  positionKey,
  REMOVED_IDS_TTL_MS,
} from "./store-helpers";
import { calculateLoungePositions } from "@/lib/position-allocator";
import { evidenceStore } from "./evidence-store";

export interface EntityStoreInternals {
  confirmationTimers: Map<string, ReturnType<typeof setTimeout>>;
  removedAgentIds: Set<string>;
  trackRemovedId: (id: string) => void;
  clearEntityTimers: () => void;
  discardEphemeralAgent: (agentId: string) => void;
}

export const createEntitySlice = (
  internals: EntityStoreInternals,
): StateCreator<OfficeStore, [["zustand/immer", never]], [], Partial<OfficeStore>> =>
(set, get) => ({
  agents: new Map(),
  selectedAgentId: null,
  runIdMap: new Map(),
  sessionKeyMap: new Map(),

  addAgent: (agent: VisualAgent) => set((state) => {
    state.agents.set(agent.id, agent);
    state.globalMetrics = computeMetrics(state.agents, state.globalMetrics);
  }),

  updateAgent: (id, patch) => set((state) => {
    const agent = state.agents.get(id);
    if (agent) {
      Object.assign(agent, patch);
      state.globalMetrics = computeMetrics(state.agents, state.globalMetrics);
    }
  }),

  removeAgent: (id) => set((state) => {
    const agent = state.agents.get(id);
    if (!agent) return;

    state.agents.delete(id);
    if (state.selectedAgentId === id) state.selectedAgentId = null;

    const confirmationTimer = internals.confirmationTimers.get(id);
    if (confirmationTimer) {
      clearTimeout(confirmationTimer);
      internals.confirmationTimers.delete(id);
    }

    for (const [runId, mappedAgentId] of state.runIdMap) {
      if (mappedAgentId === id) {
        state.runIdMap.delete(runId);
        internals.trackRemovedId(runId);
      }
    }
    for (const [sessionKey, ids] of state.sessionKeyMap) {
      const filtered = ids.filter((mappedId) => mappedId !== id);
      if (filtered.length === 0) state.sessionKeyMap.delete(sessionKey);
      else state.sessionKeyMap.set(sessionKey, filtered);
    }

    if (agent.parentAgentId) {
      const parent = state.agents.get(agent.parentAgentId);
      if (parent) parent.childAgentIds = parent.childAgentIds.filter((childId) => childId !== id);
    }
    for (const other of state.agents.values()) {
      if (other.childAgentIds.includes(id)) other.childAgentIds = other.childAgentIds.filter((childId) => childId !== id);
    }

    state.links = state.links.filter((link) => link.sourceId !== id && link.targetId !== id);
    internals.trackRemovedId(id);
    evidenceStore.remove(id);
    state.globalMetrics = computeMetrics(state.agents, state.globalMetrics);
  }),

  addSubAgent: (parentId: string, info: SubAgentInfo) => {
    set((state) => {
      const existingAgent = state.agents.get(info.agentId);
      if (existingAgent && !existingAgent.confirmed) {
        const timer = internals.confirmationTimers.get(info.agentId);
        if (timer) {
          clearTimeout(timer);
          internals.confirmationTimers.delete(info.agentId);
        }
        existingAgent.confirmed = true;
        existingAgent.isSubAgent = true;
        existingAgent.parentAgentId = parentId;
        existingAgent.name = info.label || existingAgent.name;
        activateFromLoungePlaceholder(state, existingAgent);
      } else if (existingAgent && existingAgent.confirmed) {
        const wasMisclassified = !existingAgent.isSubAgent;
        existingAgent.isSubAgent = true;
        existingAgent.parentAgentId = parentId;
        existingAgent.name = info.label || existingAgent.name;
        if (wasMisclassified) {
          existingAgent.movement = null;
          activateFromLoungePlaceholder(state, existingAgent);
        }
      } else {
        let placeholder: VisualAgent | undefined;
        for (const a of state.agents.values()) {
          if (a.isPlaceholder && a.zone === "lounge") {
            placeholder = a;
            break;
          }
        }
        if (placeholder) {
          const oldId = placeholder.id;
          const startPos = { ...placeholder.position };
          state.agents.delete(oldId);
          placeholder.id = info.agentId;
          placeholder.name = info.label || `Sub-${info.agentId.slice(0, 6)}`;
          placeholder.isPlaceholder = false;
          placeholder.isSubAgent = true;
          placeholder.parentAgentId = parentId;
          placeholder.runId = info.sessionKey;
          placeholder.status = "idle";
          placeholder.position = startPos;
          placeholder.confirmed = true;
          state.agents.set(info.agentId, placeholder);
        } else {
          const occupied = new Set<string>();
          for (const a of state.agents.values()) occupied.add(positionKey(a.position));
          const agent = createVisualAgent(info.agentId, info.label || `Sub-${info.agentId.slice(0, 6)}`, true, occupied);
          agent.parentAgentId = parentId;
          agent.runId = info.sessionKey;
          agent.zone = "hotDesk";
          state.agents.set(info.agentId, agent);
        }
      }

      const parent = state.agents.get(parentId);
      if (parent && !parent.childAgentIds.includes(info.agentId)) parent.childAgentIds.push(info.agentId);

      if (info.sessionKey) {
        const existing = state.sessionKeyMap.get(info.sessionKey) ?? [];
        if (!existing.includes(info.agentId)) {
          existing.push(info.agentId);
          state.sessionKeyMap.set(info.sessionKey, existing);
        }
      }

      state.globalMetrics = computeMetrics(state.agents, state.globalMetrics);
    });

    const agent = get().agents.get(info.agentId);
    if (agent && agent.zone !== "hotDesk" && agent.zone !== "meeting") get().startMovement(info.agentId, "hotDesk");
  },

  removeSubAgent: (subAgentId: string) => {
    get().removeAgent(subAgentId);
    set((state) => {
      const loungePositions = calculateLoungePositions(state.maxSubAgents);
      const loungeOccupied = new Set<string>();
      for (const a of state.agents.values()) {
        if (a.zone === "lounge") loungeOccupied.add(positionKey(a.position));
      }
      const freeLounge = loungePositions.find((p) => !loungeOccupied.has(positionKey(p)));
      if (freeLounge) {
        const phIdx = nextPlaceholderIndex(state.agents);
        state.agents.set(`placeholder-${phIdx}`, {
          id: `placeholder-${phIdx}`,
          name: `standby-${phIdx}`,
          status: "idle",
          position: freeLounge,
          currentTool: null,
          speechBubble: null,
          confidence: 1,
          derivationReason: "Placeholder standby agent.",
          lastActiveAt: Date.now(),
          toolCallCount: 0,
          toolCallHistory: [],
          runId: null,
          isSubAgent: true,
          isPlaceholder: true,
          parentAgentId: null,
          childAgentIds: [],
          zone: "lounge",
          originalPosition: null,
          movement: null,
          confirmed: true,
          cronLabel: null,
        });
      }
      state.globalMetrics = computeMetrics(state.agents, state.globalMetrics);
    });
  },

  confirmAgent: (agentId, role, parentId) => {
    set((state) => {
      const agent = state.agents.get(agentId);
      if (!agent || agent.confirmed) return;
      agent.confirmed = true;
      const timer = internals.confirmationTimers.get(agentId);
      if (timer) {
        clearTimeout(timer);
        internals.confirmationTimers.delete(agentId);
      }
      if (role === "sub") {
        agent.isSubAgent = true;
        if (parentId) agent.parentAgentId = parentId;
        activateFromLoungePlaceholder(state, agent);
      } else {
        const occupied = new Set<string>();
        for (const a of state.agents.values()) if (a.zone === "desk" && a.id !== agentId) occupied.add(positionKey(a.position));
        agent.position = createVisualAgent(agentId, agent.name, false, occupied).position;
        agent.zone = "desk";
      }
      state.globalMetrics = computeMetrics(state.agents, state.globalMetrics);
    });
    const agent = get().agents.get(agentId);
    if (agent && !agent.movement) get().startMovement(agentId, role === "sub" ? "hotDesk" : "desk");
  },

  initAgents: (summaries) => {
    internals.clearEntityTimers();
    evidenceStore.clear();
    (get() as any).clearSpatialTimers?.();
    (get() as any).clearCollaborationTimers?.();
    set((state) => {
      state.agents = buildInitialAgents(summaries);
      state.runIdMap.clear();
      state.sessionKeyMap.clear();
      state.links = [];
      state.selectedAgentId = null;
      state.globalMetrics = computeMetrics(state.agents, state.globalMetrics);
    });
    get().prefillLoungePlaceholders(get().maxSubAgents);
  },

  selectAgent: (id) => set((state) => {
    state.selectedAgentId = state.selectedAgentId === id ? null : id;
  }),
});

export function createEntityInternals(): EntityStoreInternals {
  const confirmationTimers = new Map<string, ReturnType<typeof setTimeout>>();
  const removedAgentIds = new Set<string>();
  return {
    confirmationTimers,
    removedAgentIds,
    trackRemovedId(id: string) {
      removedAgentIds.add(id);
      setTimeout(() => removedAgentIds.delete(id), REMOVED_IDS_TTL_MS);
    },
    clearEntityTimers() {
      for (const timer of confirmationTimers.values()) clearTimeout(timer);
      confirmationTimers.clear();
      removedAgentIds.clear();
    },
    discardEphemeralAgent: () => {},
  };
}
