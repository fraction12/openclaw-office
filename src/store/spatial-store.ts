import type { StateCreator } from "zustand";
import type { AgentZone, OfficeStore, VisualAgent } from "@/gateway/types";
import { calculateLoungePositions } from "@/lib/position-allocator";
import { calculateWalkDuration, interpolatePathPosition, planWalkPath } from "@/lib/movement-animator";
import { allocateNextPosition, HOTDESK_TO_LOUNGE_DELAY_MS, isActiveStatus, LOUNGE_TO_HOTDESK_DEBOUNCE_MS, nextPlaceholderIndex, positionKey } from "./store-helpers";

export interface SpatialInternals {
  zoneMigrationTimers: Map<string, ReturnType<typeof setTimeout>>;
  clearSpatialTimers: () => void;
  scheduleZoneMigration: (agentId: string, prevStatus: VisualAgent["status"], newStatus: VisualAgent["status"]) => void;
}

export const createSpatialSlice = (
  internals: SpatialInternals,
): StateCreator<OfficeStore, [["zustand/immer", never]], [], Partial<OfficeStore> & { clearSpatialTimers: () => void }> =>
(set, get) => ({
  moveToMeeting: (agentId, meetingPosition) => {
    set((state) => {
      const agent = state.agents.get(agentId);
      if (agent && !agent.originalPosition) agent.originalPosition = { ...agent.position };
    });
    get().startMovement(agentId, "meeting", meetingPosition);
  },

  returnFromMeeting: (agentId) => {
    const agent = get().agents.get(agentId);
    if (!agent?.originalPosition) return;
    const fallbackZone: AgentZone = agent.isSubAgent ? "hotDesk" : "desk";
    const occupied = new Set<string>();
    for (const other of get().agents.values()) {
      if (other.id !== agentId && other.zone === fallbackZone) occupied.add(positionKey(other.position));
    }
    const originalStillMeaningful = agent.originalPosition.x >= 0 && agent.originalPosition.y >= 0 && !occupied.has(positionKey(agent.originalPosition));
    const returnPos = originalStillMeaningful ? { ...agent.originalPosition } : allocateNextPosition(get().agents, fallbackZone, get().maxSubAgents);
    set((state) => {
      const a = state.agents.get(agentId);
      if (a) a.originalPosition = null;
    });
    get().startMovement(agentId, fallbackZone, returnPos);
  },

  startMovement: (agentId, toZone, targetPos) => set((state) => {
    const agent = state.agents.get(agentId);
    if (!agent) return;
    const fromZone = agent.zone;
    const to = targetPos ?? allocateNextPosition(state.agents, toZone, state.maxSubAgents);
    if (agent.movement && agent.movement.toZone === toZone) {
      const currentTarget = agent.movement.path[agent.movement.path.length - 1];
      if (currentTarget?.x === to.x && currentTarget?.y === to.y) return;
    }
    const path = planWalkPath(agent.position, to, fromZone, toZone);
    agent.movement = {
      path,
      progress: 0,
      duration: calculateWalkDuration(path),
      startTime: Date.now(),
      fromZone,
      toZone,
    };
  }),

  tickMovement: (agentId, deltaTime) => set((state) => {
    const agent = state.agents.get(agentId);
    if (!agent?.movement) return;
    agent.movement.progress = Math.min(agent.movement.progress + deltaTime / agent.movement.duration, 1);
    agent.position = interpolatePathPosition(agent.movement.path, agent.movement.progress);
    if (agent.movement.progress >= 1) {
      const finalPos = agent.movement.path[agent.movement.path.length - 1];
      agent.zone = agent.movement.toZone;
      agent.position = { ...finalPos };
      agent.movement = null;
    }
  }),

  completeMovement: (agentId) => set((state) => {
    const agent = state.agents.get(agentId);
    if (!agent?.movement) return;
    const finalPos = agent.movement.path[agent.movement.path.length - 1];
    agent.zone = agent.movement.toZone;
    agent.position = { ...finalPos };
    agent.movement = null;
  }),

  prefillLoungePlaceholders: (count) => set((state) => {
    const loungePositions = calculateLoungePositions(count);
    for (const agent of [...state.agents.values()]) {
      if (agent.isPlaceholder && agent.zone === "lounge" && !loungePositions.some((p) => p.x === agent.position.x && p.y === agent.position.y)) {
        state.agents.delete(agent.id);
      }
    }
    const activePlaceholders = [...state.agents.values()].filter((a) => a.isPlaceholder && a.zone === "lounge");
    const wanted = Math.min(count, loungePositions.length);
    const usedPositions = new Set(activePlaceholders.map((a) => positionKey(a.position)));
    for (let i = activePlaceholders.length; i < wanted; i++) {
      const pos = loungePositions.find((p) => !usedPositions.has(positionKey(p)));
      if (!pos) break;
      usedPositions.add(positionKey(pos));
      const idx = nextPlaceholderIndex(state.agents);
      state.agents.set(`placeholder-${idx}`, {
        id: `placeholder-${idx}`,
        name: `standby-${idx}`,
        status: "idle",
        position: { ...pos },
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
  }),

  setMaxSubAgents: (n) => {
    set((state) => { if (n >= 1 && n <= 50) state.maxSubAgents = n; });
    get().prefillLoungePlaceholders(get().maxSubAgents);
  },

  clearSpatialTimers: internals.clearSpatialTimers,
});

export function createSpatialInternals(getStore: () => OfficeStore): SpatialInternals {
  const zoneMigrationTimers = new Map<string, ReturnType<typeof setTimeout>>();
  return {
    zoneMigrationTimers,
    clearSpatialTimers() {
      for (const timer of zoneMigrationTimers.values()) clearTimeout(timer);
      zoneMigrationTimers.clear();
    },
    scheduleZoneMigration(agentId, prevStatus, newStatus) {
      const existingTimer = zoneMigrationTimers.get(agentId);
      if (existingTimer) {
        clearTimeout(existingTimer);
        zoneMigrationTimers.delete(agentId);
      }
      const wasActive = isActiveStatus(prevStatus);
      const nowActive = isActiveStatus(newStatus);
      if (!wasActive && nowActive) {
        const timer = setTimeout(() => {
          zoneMigrationTimers.delete(agentId);
          const state = getStore();
          const agent = state.agents.get(agentId);
          if (!agent || !agent.isSubAgent || agent.zone !== "lounge" || agent.movement?.toZone === "hotDesk") return;
          state.startMovement(agentId, "hotDesk");
        }, LOUNGE_TO_HOTDESK_DEBOUNCE_MS);
        zoneMigrationTimers.set(agentId, timer);
      } else if (wasActive && !nowActive && newStatus === "idle") {
        const timer = setTimeout(() => {
          zoneMigrationTimers.delete(agentId);
          const state = getStore();
          const agent = state.agents.get(agentId);
          if (!agent || !agent.isSubAgent || agent.zone !== "hotDesk" || isActiveStatus(agent.status) || agent.movement?.toZone === "lounge") return;
          state.startMovement(agentId, "lounge");
        }, HOTDESK_TO_LOUNGE_DELAY_MS);
        zoneMigrationTimers.set(agentId, timer);
      }
    },
  };
}
