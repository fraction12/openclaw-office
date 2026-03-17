import { parseAgentEvent } from "@/gateway/event-parser";
import type { AgentEventPayload, EventHistoryItem, OfficeStore } from "@/gateway/types";
import { getAgentDisplayName } from "@/lib/agent-identities";
import { deriveState } from "@/lib/state-deriver";
import { applyEventToAgent } from "./agent-reducer";
import { evidenceStore } from "./evidence-store";
import { entityInternals, spatialInternals } from "./index";
import { computeMetrics } from "./metrics-reducer";
import { appendEventHistory } from "./telemetry-store";
import { createVisualAgent, extractParentFromSessionKey, isRegisteredMainAgentId, pickPreferredMappedAgentId } from "./store-helpers";

export function rederiveAllAgentStates(_store: OfficeStore, setState: (updater: (state: OfficeStore) => void) => void, now = Date.now()): void {
  setState((state) => {
    for (const [agentId, agent] of state.agents) {
      if (agent.isPlaceholder) continue;
      const evidence = evidenceStore.ensure(agentId);
      const derived = deriveState(evidence, now);
      agent.status = derived.status;
      agent.statusConfidence = derived.confidence;
      agent.statusReason = derived.derivationReason;
      agent.statusDerivedAt = now;
      agent.confidence = derived.confidence;
      agent.derivationReason = derived.derivationReason;
      if (!agent.currentTool && derived.currentTool) {
        agent.currentTool = { name: derived.currentTool, startedAt: now };
      }
      if (!agent.speechBubble && derived.speechText) {
        agent.speechBubble = { text: derived.speechText, timestamp: now };
      }
    }
    state.globalMetrics = computeMetrics(state.agents, state.globalMetrics);
  });
}

export function processAgentEvent(store: OfficeStore, setState: (updater: (state: OfficeStore) => void) => void, event: AgentEventPayload): void {
  const pendingSubAgentRef: { value: { parentId: string; info: OfficeStore["lastSessionsSnapshot"] extends infer _ ? import("@/gateway/types").SubAgentInfo : never } | null } = { value: null };
  let newUnconfirmedId: string | null = null;

  setState((state) => {
    const parsed = parseAgentEvent(event);
    const dataAgentId = event.data.agentId as string | undefined;
    const parentAgentId = event.data.parentAgentId as string | undefined;
    const isSubAgentStart = Boolean(dataAgentId) && Boolean(parentAgentId) && event.stream === "lifecycle" && event.data.phase === "start";
    const sessionKeyHintEarly = event.sessionKey ?? "";
    const isSubAgentSession = sessionKeyHintEarly.includes(":subagent:") && !sessionKeyHintEarly.startsWith("announce:");

    let agentId: string | undefined;
    if (isSubAgentSession) {
      agentId = state.runIdMap.get(event.runId);
      if (!agentId) agentId = state.sessionKeyMap.get(sessionKeyHintEarly)?.[0];
      if (!agentId) {
        const subIdx = sessionKeyHintEarly.indexOf(":subagent:");
        if (subIdx >= 0) agentId = sessionKeyHintEarly.slice(subIdx + ":subagent:".length);
      }
      if (!agentId) agentId = event.runId;
    } else {
      if (dataAgentId) agentId = dataAgentId;
      if (!agentId) agentId = state.runIdMap.get(event.runId);
      if (!agentId && event.sessionKey) {
        const sessionAgents = state.sessionKeyMap.get(event.sessionKey);
        if (sessionAgents?.length) agentId = pickPreferredMappedAgentId(state, sessionAgents);
      }
      if (!agentId && event.sessionKey) {
        const match = event.sessionKey.match(/^agent:([^:]+):/);
        if (match) {
          const agentName = match[1];
          for (const [id, a] of state.agents) {
            if (!a.isSubAgent && !a.isPlaceholder && (a.id === agentName || a.name === agentName)) { agentId = id; break; }
          }
        }
      }
      if (!agentId) agentId = event.runId;
    }

    if (entityInternals.removedAgentIds.has(agentId) || event.runId.startsWith("announce:")) return;

    const parentFromSessionKey = isSubAgentSession ? extractParentFromSessionKey(state, sessionKeyHintEarly) : null;
    if (isSubAgentStart && dataAgentId && parentAgentId && !state.agents.has(dataAgentId)) {
      pendingSubAgentRef.value = { parentId: parentAgentId, info: { sessionKey: event.sessionKey ?? event.runId, agentId: dataAgentId, label: `Sub-${dataAgentId.slice(0, 8)}`, task: "", requesterSessionKey: event.sessionKey ?? "", startedAt: event.ts } };
    } else if (!state.agents.has(agentId) && isSubAgentSession && parentFromSessionKey) {
      pendingSubAgentRef.value = { parentId: parentFromSessionKey, info: { sessionKey: sessionKeyHintEarly, agentId, label: `Sub-${agentId.slice(0, 8)}`, task: "", requesterSessionKey: sessionKeyHintEarly, startedAt: event.ts } };
    } else if (!state.agents.has(agentId)) {
      const isKnownMainAgent = isRegisteredMainAgentId(state, agentId, event.sessionKey);
      if (isKnownMainAgent || Boolean(dataAgentId)) {
        const occupied = new Set<string>([...state.agents.values()].map((a) => `${a.position.x},${a.position.y}`));
        const agent = createVisualAgent(agentId, getAgentDisplayName(agentId, `Agent-${agentId.slice(0, 6)}`), false, occupied, true);
        agent.runId = event.runId;
        state.agents.set(agentId, agent);
      } else {
        const agent = createVisualAgent(agentId, getAgentDisplayName(agentId, `Agent-${agentId.slice(0, 6)}`), false, new Set(), false);
        agent.runId = event.runId;
        state.agents.set(agentId, agent);
        newUnconfirmedId = agentId;
      }
    }

    // Detect cron-originated sessions and label the agent
    const cronMatch = sessionKeyHintEarly.match(/^cron:([^:]+):/);
    if (cronMatch) {
      const currentAgent = state.agents.get(agentId);
      if (currentAgent && !currentAgent.cronLabel) currentAgent.cronLabel = cronMatch[1];
    }

    const previouslyMappedAgentId = state.runIdMap.get(event.runId);
    if (previouslyMappedAgentId && previouslyMappedAgentId !== agentId && state.agents.has(previouslyMappedAgentId)) {
      const ephemeral = state.agents.get(previouslyMappedAgentId);
      const target = state.agents.get(agentId);
      if (ephemeral && target && !ephemeral.confirmed) {
        target.status = ephemeral.status;
        target.currentTool = ephemeral.currentTool;
        target.speechBubble = ephemeral.speechBubble;
        target.confidence = ephemeral.confidence;
        target.derivationReason = ephemeral.derivationReason;
        target.lastActiveAt = Math.max(target.lastActiveAt, ephemeral.lastActiveAt);
        target.toolCallCount = Math.max(target.toolCallCount, ephemeral.toolCallCount);
        if (ephemeral.toolCallHistory.length > 0) target.toolCallHistory = [...ephemeral.toolCallHistory];
        target.runId = ephemeral.runId ?? target.runId;
        state.agents.delete(previouslyMappedAgentId);
        if (state.selectedAgentId === previouslyMappedAgentId) state.selectedAgentId = agentId;
        entityInternals.trackRemovedId(previouslyMappedAgentId);
      }
    }

    state.runIdMap.set(event.runId, agentId);
    if (event.sessionKey) {
      const existing = state.sessionKeyMap.get(event.sessionKey) ?? [];
      if (previouslyMappedAgentId && previouslyMappedAgentId !== agentId) {
        const cleaned = existing.filter((id) => id !== previouslyMappedAgentId);
        existing.length = 0;
        existing.push(...cleaned);
      }
      if (!existing.includes(agentId)) {
        existing.push(agentId);
        state.sessionKeyMap.set(event.sessionKey, existing);
      }
    }

    if (event.sessionKey) {
      ((store as any).updateCollaborationLinks)?.(event.sessionKey, agentId);
      ((store as any).scheduleMeetingGathering)?.();
    }

    const evidence = evidenceStore.merge(agentId, parsed.evidencePatch);
    const derived = deriveState(evidence, event.ts);

    const agent = state.agents.get(agentId);
    if (agent) {
      const prevStatus = agent.status;
      applyEventToAgent(agent, parsed, derived, event.ts);
      if (agent.confirmed && !agent.isPlaceholder && agent.zone !== "meeting") {
        spatialInternals.scheduleZoneMigration(agent.id, prevStatus, agent.status);
      }
    }

    const historyItem: EventHistoryItem = { timestamp: event.ts, agentId, agentName: agent?.name ?? agentId, stream: event.stream, summary: parsed.summary };
    appendEventHistory(setState, historyItem);
    state.globalMetrics = computeMetrics(state.agents, state.globalMetrics);
  });

  const subToCreate = pendingSubAgentRef.value;
  if (subToCreate) store.addSubAgent(subToCreate.parentId, subToCreate.info);
  if (newUnconfirmedId) {
    const id = newUnconfirmedId;
    const timer = setTimeout(() => {
      entityInternals.confirmationTimers.delete(id);
      const a = store.agents.get(id);
      if (a && !a.confirmed) (store as any).discardEphemeralAgent(id);
    }, 5_000);
    entityInternals.confirmationTimers.set(id, timer);
  }
  if (event.stream === "lifecycle" && event.data.phase === "end") {
    if (event.data.agentId) {
      const endId = event.data.agentId as string;
      const sub = store.agents.get(endId);
      if (sub?.isSubAgent && !sub.isPlaceholder) store.removeSubAgent(endId);
    }
    const sk = event.sessionKey ?? "";
    if (sk.includes(":subagent:")) {
      const subIdx = sk.indexOf(":subagent:");
      if (subIdx >= 0) {
        const subUuid = sk.slice(subIdx + ":subagent:".length);
        const sub = store.agents.get(subUuid);
        if (sub?.isSubAgent && !sub.isPlaceholder) store.removeSubAgent(subUuid);
      }
    }
  }
}
