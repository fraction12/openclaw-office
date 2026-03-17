import type { StateCreator } from "zustand";
import type { CollaborationLink, OfficeStore } from "@/gateway/types";
import { applyMeetingGathering, detectMeetingGroups } from "./meeting-manager";
import { LINK_TIMEOUT_MS, MEETING_GATHERING_THROTTLE_MS } from "./store-helpers";

export interface CollaborationInternals {
  decayTimer: ReturnType<typeof setInterval> | null;
  meetingGatheringTimer: ReturnType<typeof setTimeout> | null;
  lastMeetingGroupsHash: string;
  clearCollaborationTimers: () => void;
  scheduleMeetingGathering: () => void;
}

export const createCollaborationSlice = (
  internals: CollaborationInternals,
): StateCreator<OfficeStore, [["zustand/immer", never]], [], Partial<OfficeStore> & { clearCollaborationTimers: () => void; updateCollaborationLinks: (sessionKey: string, agentId: string) => void }> =>
(set) => ({
  links: [],

  updateCollaborationLinks: (sessionKey, agentId) => set((state) => {
    const agents = state.sessionKeyMap.get(sessionKey);
    if (!agents || agents.length < 2) return;
    const now = Date.now();
    for (const otherId of agents) {
      if (otherId === agentId) continue;
      const existingIdx = state.links.findIndex((l) => l.sessionKey === sessionKey && ((l.sourceId === agentId && l.targetId === otherId) || (l.sourceId === otherId && l.targetId === agentId)));
      if (existingIdx >= 0) {
        const link = state.links[existingIdx];
        link.lastActivityAt = now;
        link.strength = Math.min(link.strength + 0.1, 1);
      } else {
        state.links.push({ sourceId: agentId, targetId: otherId, sessionKey, strength: 0.3, lastActivityAt: now });
      }
    }
    state.links = state.links.filter((l) => now - l.lastActivityAt < LINK_TIMEOUT_MS);
  }),

  clearCollaborationTimers: internals.clearCollaborationTimers,

  scheduleMeetingGathering: internals.scheduleMeetingGathering,
});

export function createCollaborationInternals(getStore: () => OfficeStore, setStore: (updater: (state: OfficeStore) => void) => void): CollaborationInternals {
  const internals: CollaborationInternals = {
    decayTimer: null,
    meetingGatheringTimer: null,
    lastMeetingGroupsHash: "",
    clearCollaborationTimers() {
      if (internals.decayTimer) clearInterval(internals.decayTimer);
      if (internals.meetingGatheringTimer) clearTimeout(internals.meetingGatheringTimer);
      internals.decayTimer = null;
      internals.meetingGatheringTimer = null;
      internals.lastMeetingGroupsHash = "";
    },
    scheduleMeetingGathering() {
      if (internals.meetingGatheringTimer) return;
      internals.meetingGatheringTimer = setTimeout(() => {
        internals.meetingGatheringTimer = null;
        const state = getStore();
        const allowList = state.agentToAgentConfig.enabled ? state.agentToAgentConfig.allow : undefined;
        const groups = detectMeetingGroups(state.links, state.agents, allowList);
        const hash = JSON.stringify(groups.map((g) => [...g.agentIds].sort()));
        if (hash === internals.lastMeetingGroupsHash) return;
        internals.lastMeetingGroupsHash = hash;
        applyMeetingGathering(state.agents, groups, (id, pos) => state.moveToMeeting(id, pos), (id) => state.returnFromMeeting(id));
      }, MEETING_GATHERING_THROTTLE_MS);
    },
  };

  internals.decayTimer = setInterval(() => {
    const now = Date.now();
    setStore((state) => {
      let changed = false;
      state.links = state.links
        .map((link): CollaborationLink | null => {
          const age = now - link.lastActivityAt;
          if (age >= LINK_TIMEOUT_MS) {
            changed = true;
            return null;
          }
          const nextStrength = Math.max(0, 1 - age / LINK_TIMEOUT_MS);
          if (Math.abs(nextStrength - link.strength) > 0.01) changed = true;
          return { ...link, strength: nextStrength };
        })
        .filter((link): link is CollaborationLink => Boolean(link));
      if (changed) state.globalMetrics = { ...state.globalMetrics };
    });
  }, 1000);

  return internals;
}
