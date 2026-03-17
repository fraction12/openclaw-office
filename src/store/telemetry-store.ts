import type { StateCreator } from "zustand";
import type { OfficeStore } from "@/gateway/types";
import { localPersistence } from "@/lib/local-persistence";
import { EVENT_HISTORY_LIMIT } from "./store-helpers";

export const createTelemetrySlice: StateCreator<OfficeStore, [["zustand/immer", never]], [], Partial<OfficeStore>> =
(set) => ({
  eventHistory: [],
  tokenHistory: [],
  agentCosts: {},
  globalMetrics: { activeAgents: 0, totalAgents: 0, totalTokens: 0, tokenRate: 0, collaborationHeat: 0 },

  pushTokenSnapshot: (snapshot) => set((state) => {
    const previous = state.tokenHistory[state.tokenHistory.length - 1];
    state.tokenHistory.push(snapshot);
    if (state.tokenHistory.length > 30) state.tokenHistory = state.tokenHistory.slice(-30);
    const totalTokens = Math.max(0, Math.round(snapshot.total || 0));
    let tokenRate = state.globalMetrics.tokenRate;
    if (previous) {
      const elapsedMinutes = Math.max(1, snapshot.timestamp - previous.timestamp) / 60_000;
      const tokenDelta = snapshot.total - previous.total;
      tokenRate = Number.isFinite(tokenDelta / elapsedMinutes) ? Math.max(0, tokenDelta / elapsedMinutes) : 0;
      if (tokenDelta < 0) tokenRate = 0;
    } else {
      tokenRate = 0;
    }
    state.globalMetrics = { ...state.globalMetrics, totalTokens, tokenRate };
  }),

  setAgentCosts: (costs) => set((state) => { state.agentCosts = costs; }),

  initEventHistory: async () => {
    try {
      await localPersistence.open();
      const cached = await localPersistence.getEvents(EVENT_HISTORY_LIMIT);
      if (cached.length > 0) set((state) => { state.eventHistory = cached; });
      localPersistence.cleanup().catch(() => {});
    } catch {}
  },

  updateMetrics: () => set((state) => { state.globalMetrics = { ...state.globalMetrics }; }),
});

export function appendEventHistory(set: (updater: (state: OfficeStore) => void) => void, item: OfficeStore["eventHistory"][number]): void {
  set((state) => {
    state.eventHistory.push(item);
    if (state.eventHistory.length > EVENT_HISTORY_LIMIT) state.eventHistory = state.eventHistory.slice(-EVENT_HISTORY_LIMIT);
  });
  queueMicrotask(() => { localPersistence.saveEvent(item).catch(() => {}); });
}
