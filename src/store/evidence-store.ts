import type { AgentVisualStatus } from "@/gateway/types";

export type AgentStatus = AgentVisualStatus;

export interface AgentEvidence {
  agentId: string;
  wsLifecycle: { phase: string; timestamp: number } | null;
  wsToolCall: { name: string; phase: string; timestamp: number } | null;
  wsSpeech: { text: string; timestamp: number } | null;
  wsError: { message: string; timestamp: number } | null;
  httpSessionStatus: { status: AgentStatus; updatedAt: number } | null;
  httpLastTool: { name: string; timestamp: number } | null;
  lastWsEventAt: number | null;
  lastHttpRefreshAt: number | null;
  connectionHealthy: boolean;
}

const DEFAULT_CONNECTION_HEALTHY = true;

function createBlankEvidence(agentId: string): AgentEvidence {
  return {
    agentId,
    wsLifecycle: null,
    wsToolCall: null,
    wsSpeech: null,
    wsError: null,
    httpSessionStatus: null,
    httpLastTool: null,
    lastWsEventAt: null,
    lastHttpRefreshAt: null,
    connectionHealthy: DEFAULT_CONNECTION_HEALTHY,
  };
}

class EvidenceStore {
  private byAgent = new Map<string, AgentEvidence>();

  get(agentId: string): AgentEvidence {
    const existing = this.byAgent.get(agentId);
    if (existing) return existing;
    const created = createBlankEvidence(agentId);
    this.byAgent.set(agentId, created);
    return created;
  }

  list(): AgentEvidence[] {
    return [...this.byAgent.values()];
  }

  ensure(agentId: string): AgentEvidence {
    return this.get(agentId);
  }

  merge(agentId: string, patch: Partial<AgentEvidence>): AgentEvidence {
    const next = { ...this.get(agentId), ...patch, agentId } satisfies AgentEvidence;
    this.byAgent.set(agentId, next);
    return next;
  }

  touchWs(agentId: string, timestamp: number): AgentEvidence {
    return this.merge(agentId, { lastWsEventAt: timestamp });
  }

  touchHttp(agentId: string, timestamp: number): AgentEvidence {
    return this.merge(agentId, { lastHttpRefreshAt: timestamp });
  }

  setHttpSessionStatus(agentId: string, status: AgentStatus, updatedAt: number): AgentEvidence {
    return this.merge(agentId, {
      httpSessionStatus: { status, updatedAt },
      lastHttpRefreshAt: updatedAt,
    });
  }

  setHttpLastTool(agentId: string, name: string, timestamp: number): AgentEvidence {
    return this.merge(agentId, {
      httpLastTool: { name, timestamp },
      lastHttpRefreshAt: timestamp,
    });
  }

  setConnectionHealthy(agentId: string, connectionHealthy: boolean): AgentEvidence {
    return this.merge(agentId, { connectionHealthy });
  }

  setConnectionHealthyForAgents(agentIds: string[], connectionHealthy: boolean): void {
    for (const agentId of agentIds) this.setConnectionHealthy(agentId, connectionHealthy);
  }

  remove(agentId: string): void {
    this.byAgent.delete(agentId);
  }

  clear(): void {
    this.byAgent.clear();
  }
}

export const evidenceStore = new EvidenceStore();
