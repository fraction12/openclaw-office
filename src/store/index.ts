import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { OfficeStore } from "@/gateway/types";
import { computeMetrics } from "./metrics-reducer";
import { createCollaborationInternals, createCollaborationSlice } from "./collaboration-store";
import { createEntityInternals, createEntitySlice } from "./agent-entity-store";
import { createOfficeUiSlice } from "./office-ui-store";
import { createSpatialInternals, createSpatialSlice } from "./spatial-store";
import { createTelemetrySlice } from "./telemetry-store";
import { evidenceStore } from "./evidence-store";

type ExtendedOfficeStore = OfficeStore & {
  updateCollaborationLinks?: (sessionKey: string, agentId: string) => void;
  scheduleMeetingGathering?: () => void;
  clearSpatialTimers?: () => void;
  clearCollaborationTimers?: () => void;
};

let storeRef: any;
export const entityInternals = createEntityInternals();
export const spatialInternals = createSpatialInternals(() => storeRef.getState());
const collaborationInternals = createCollaborationInternals(
  () => storeRef.getState(),
  (updater) => storeRef.setState((state: ExtendedOfficeStore) => { updater(state as OfficeStore); }),
);

export const useOfficeStore = create<ExtendedOfficeStore>()(
  immer((set, get) => ({
    ...(createTelemetrySlice as any)(set, get),
    ...(createOfficeUiSlice as any)(set, get),
    ...(createEntitySlice(entityInternals) as any)(set, get),
    ...(createSpatialSlice(spatialInternals) as any)(set, get),
    ...(createCollaborationSlice(collaborationInternals) as any)(set, get),
    discardEphemeralAgent: (agentId: string) => set((state: ExtendedOfficeStore) => {
      const agent = state.agents.get(agentId);
      if (!agent || agent.confirmed) return;
      state.agents.delete(agentId);
      if (state.selectedAgentId === agentId) state.selectedAgentId = null;
      for (const [runId, mappedAgentId] of state.runIdMap) {
        if (mappedAgentId === agentId) {
          state.runIdMap.delete(runId);
          entityInternals.trackRemovedId(runId);
        }
      }
      for (const [sessionKey, mappedAgentIds] of state.sessionKeyMap) {
        const filtered = mappedAgentIds.filter((id) => id !== agentId);
        if (filtered.length === 0) state.sessionKeyMap.delete(sessionKey);
        else state.sessionKeyMap.set(sessionKey, filtered);
      }
      entityInternals.trackRemovedId(agentId);
      evidenceStore.remove(agentId);
      state.globalMetrics = computeMetrics(state.agents, state.globalMetrics);
    }),
    processAgentEvent: () => {},
  })),
);

storeRef = useOfficeStore;
