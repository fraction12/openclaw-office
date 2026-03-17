import { useEffect, useRef } from "react";
import { setWsAdapter, setMockAdapter, isMockMode, resetAdapter } from "@/gateway/adapter-provider";
import { GatewayRpcClient } from "@/gateway/rpc-client";
import type {
  AgentEventPayload,
  AgentSummary,
  AgentsListResponse,
  GatewayEventFrame,
  HealthSnapshot,
} from "@/gateway/types";
import { GatewayWsClient } from "@/gateway/ws-client";
import { getAgentDisplayName } from "@/lib/agent-identities";
import { EventThrottle } from "@/lib/event-throttle";
import { useOfficeStore } from "@/store";
import { processAgentEvent, rederiveAllAgentStates } from "@/store/event-orchestrator";
import { evidenceStore } from "@/store/evidence-store";
import { useSubAgentPoller } from "./useSubAgentPoller";
import { useUsagePoller } from "./useUsagePoller";

interface UseGatewayConnectionOptions {
  url: string;
  token: string;
}

export function useGatewayConnection({ url, token }: UseGatewayConnectionOptions) {
  const wsRef = useRef<GatewayWsClient | null>(null);
  const rpcRef = useRef<GatewayRpcClient | null>(null);
  const throttleRef = useRef<EventThrottle | null>(null);
  const rederiveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const setConnectionStatus = useOfficeStore((s) => s.setConnectionStatus);
  const initAgents = useOfficeStore((s) => s.initAgents);
  const setOperatorScopes = useOfficeStore((s) => s.setOperatorScopes);
  const setMaxSubAgents = useOfficeStore((s) => s.setMaxSubAgents);
  const setAgentToAgentConfig = useOfficeStore((s) => s.setAgentToAgentConfig);

  const handleAgentEvent = (payload: AgentEventPayload) => {
    processAgentEvent(
      useOfficeStore.getState() as never,
      (updater) => useOfficeStore.setState((state) => {
        updater(state as never);
      }),
      payload,
    );
  };

  useEffect(() => {
    if (!url) return;

    if (isMockMode()) {
      let unsubEvent: (() => void) | null = null;
      void setMockAdapter().then(async (adapter) => {
        unsubEvent = adapter.onEvent((event: string, payload: unknown) => {
          if (event === "agent") handleAgentEvent(payload as AgentEventPayload);
        });

        const config = await adapter.configGet();
        const cfg = config.config as Record<string, unknown>;
        const agentsCfg = cfg.agents as Record<string, unknown> | undefined;
        const defaults = agentsCfg?.defaults as Record<string, unknown> | undefined;
        const subagents = defaults?.subagents as { maxConcurrent?: number } | undefined;
        if (subagents?.maxConcurrent) setMaxSubAgents(subagents.maxConcurrent);
        const tools = cfg.tools as Record<string, unknown> | undefined;
        const a2a = tools?.agentToAgent as { enabled?: boolean; allow?: string[] } | undefined;
        if (a2a) setAgentToAgentConfig({ enabled: a2a.enabled ?? false, allow: Array.isArray(a2a.allow) ? a2a.allow : [] });

        const agentList = await adapter.agentsList() as AgentsListResponse;
        initAgents(agentList.agents);
        setOperatorScopes(["operator.admin"]);
        setConnectionStatus("connected");
      });
      return () => { unsubEvent?.(); };
    }

    const ws = new GatewayWsClient();
    const rpc = new GatewayRpcClient(ws);
    const throttle = new EventThrottle();
    wsRef.current = ws;
    rpcRef.current = rpc;
    throttleRef.current = throttle;

    throttle.onBatch((events) => { for (const event of events) handleAgentEvent(event); });
    throttle.onImmediate((event) => { handleAgentEvent(event); });

    ws.onStatusChange((status, error) => {
      setConnectionStatus(status, error);
      const agentIds = [...useOfficeStore.getState().agents.keys()];
      evidenceStore.setConnectionHealthyForAgents(agentIds, status === "connected");
      rederiveAllAgentStates(
        useOfficeStore.getState() as never,
        (updater) => useOfficeStore.setState((state) => { updater(state as never); }),
      );
      if (status === "connected") {
        setWsAdapter(ws, rpc);
        void bootstrapAgents(ws, rpc, initAgents);
        const snapshot = ws.getSnapshot();
        const scopes = (snapshot as Record<string, unknown>)?.scopes;
        setOperatorScopes(Array.isArray(scopes) ? (scopes as string[]) : ["operator"]);
        void fetchGatewayConfig(rpc, setMaxSubAgents, setAgentToAgentConfig);
      }
    });

    ws.onEvent("agent", (frame: GatewayEventFrame) => throttle.push(frame.payload as AgentEventPayload));
    ws.onEvent("health", (frame: GatewayEventFrame) => {
      const health = frame.payload as HealthSnapshot;
      if (health?.agents) initAgents(healthAgentsToSummaries(health));
    });

    rederiveTimerRef.current = setInterval(() => {
      rederiveAllAgentStates(
        useOfficeStore.getState() as never,
        (updater) => useOfficeStore.setState((state) => { updater(state as never); }),
      );
    }, 5_000);

    // Defer connection slightly so React Strict Mode's immediate
    // mount→unmount→remount cycle doesn't create & kill a WebSocket
    // before it even opens (which causes browser console warnings).
    let cancelled = false;
    const connectTimer = setTimeout(() => {
      if (!cancelled) ws.connect(url, token);
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(connectTimer);
      throttle.destroy();
      ws.disconnect();
      resetAdapter();
      if (rederiveTimerRef.current) {
        clearInterval(rederiveTimerRef.current);
        rederiveTimerRef.current = null;
      }
      wsRef.current = null;
      rpcRef.current = null;
      throttleRef.current = null;
    };
  }, [url, token, setConnectionStatus, initAgents, setOperatorScopes, setMaxSubAgents, setAgentToAgentConfig]);

  useSubAgentPoller(rpcRef);
  useUsagePoller(rpcRef);

  return { wsClient: wsRef, rpcClient: rpcRef };
}

function healthAgentsToSummaries(health: HealthSnapshot): AgentSummary[] {
  if (!health.agents) return [];
  return health.agents.map((a) => ({ id: a.agentId, name: getAgentDisplayName(a.agentId, a.agentId) }));
}

function initAgentsFromSnapshot(ws: GatewayWsClient, initAgents: (agents: AgentSummary[]) => void): void {
  const snapshot = ws.getSnapshot();
  const health = snapshot?.health as HealthSnapshot | undefined;
  if (health?.agents?.length) initAgents(healthAgentsToSummaries(health));
}

async function bootstrapAgents(
  ws: GatewayWsClient,
  rpc: GatewayRpcClient,
  initAgents: (agents: AgentSummary[]) => void,
): Promise<void> {
  const applyIfAny = (agents: AgentSummary[] | undefined | null): boolean => {
    if (!agents || agents.length === 0) return false;
    initAgents(agents);
    return true;
  };

  const storeHasAgents = () => useOfficeStore.getState().agents.size > 0;

  // 1) Original repo path: trust hello-ok snapshot when present.
  initAgentsFromSnapshot(ws, initAgents);
  if (storeHasAgents()) return;

  // 2) Best RPC source: agents.list.
  try {
    const result = await rpc.request<AgentsListResponse>("agents.list");
    if (applyIfAny(result?.agents)) return;
  } catch {
    // continue
  }

  // 3) Direct health RPC as another authoritative source.
  try {
    const health = await rpc.request<HealthSnapshot>("health");
    if (health?.agents?.length && applyIfAny(healthAgentsToSummaries(health))) return;
  } catch {
    // continue
  }

  // 4) Config fallback for older/odd environments.
  try {
    const configResp = await rpc.request<{ config?: Record<string, unknown> }>("config.get");
    const agentsCfg = configResp.config?.agents as Record<string, unknown> | undefined;
    if (agentsCfg) {
      const agentList = agentsCfg.list as Array<{ id: string; name?: string; identity?: { name?: string } }> | undefined;
      if (applyIfAny(agentList?.map((a) => ({
        id: a.id,
        name: getAgentDisplayName(a.id, a.identity?.name ?? a.name ?? a.id),
      })))) return;

      const agentIds = Object.keys(agentsCfg).filter((k) => k !== "defaults" && k !== "list");
      if (applyIfAny(agentIds.map((id) => ({ id, name: getAgentDisplayName(id, id) })))) return;
    }
  } catch {
    // continue
  }

  // 5) Last-resort session inference.
  try {
    const sessResp = await rpc.request<{ sessions?: Array<{ agentId?: string; sessionKey?: string }> }>("sessions.list");
    const sessions = sessResp.sessions ?? [];
    if (sessions.length > 0) {
      const agentIds = new Set<string>();
      for (const s of sessions) {
        if (s.agentId) agentIds.add(s.agentId);
        else if (s.sessionKey) {
          const match = s.sessionKey.match(/^agent:([^:]+):/);
          if (match) agentIds.add(match[1]);
        }
      }
      if (applyIfAny([...agentIds].map((id) => ({ id, name: getAgentDisplayName(id, id) })))) return;
    }
  } catch {
    // continue
  }

  // 6) Bounded retry window: some environments race the initial snapshot/health update.
  for (let attempt = 0; attempt < 5 && !storeHasAgents(); attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
    initAgentsFromSnapshot(ws, initAgents);
    if (storeHasAgents()) return;
    try {
      const result = await rpc.request<AgentsListResponse>("agents.list");
      if (applyIfAny(result?.agents)) return;
    } catch {
      // ignore
    }
  }
}

async function fetchGatewayConfig(
  rpc: GatewayRpcClient,
  setMaxSubAgents: (n: number) => void,
  setAgentToAgentConfig: (config: { enabled: boolean; allow: string[] }) => void,
): Promise<void> {
  try {
    const resp = await rpc.request<{ config?: Record<string, unknown> }>("config.get");
    const config = resp.config;
    if (!config) return;
    const agentsCfg = config.agents as Record<string, unknown> | undefined;
    const defaults = agentsCfg?.defaults as Record<string, unknown> | undefined;
    const subagents = defaults?.subagents as { maxConcurrent?: number } | undefined;
    if (subagents?.maxConcurrent && subagents.maxConcurrent >= 1 && subagents.maxConcurrent <= 50) setMaxSubAgents(subagents.maxConcurrent);
    const tools = config.tools as Record<string, unknown> | undefined;
    const a2a = tools?.agentToAgent as { enabled?: boolean; allow?: string[] } | undefined;
    if (a2a) setAgentToAgentConfig({ enabled: a2a.enabled ?? false, allow: Array.isArray(a2a.allow) ? a2a.allow : [] });
  } catch {}
}
