import { useEffect, useRef } from "react";
import { GatewayWsClient } from "@/gateway/ws-client";
import { GatewayRpcClient } from "@/gateway/rpc-client";
import { EventThrottle } from "@/lib/event-throttle";
import { useOfficeStore } from "@/store/office-store";
import type {
  AgentEventPayload,
  AgentsListResponse,
  GatewayEventFrame,
} from "@/gateway/types";

interface UseGatewayConnectionOptions {
  url: string;
  token: string;
}

export function useGatewayConnection({ url, token }: UseGatewayConnectionOptions) {
  const wsRef = useRef<GatewayWsClient | null>(null);
  const rpcRef = useRef<GatewayRpcClient | null>(null);
  const throttleRef = useRef<EventThrottle | null>(null);

  const setConnectionStatus = useOfficeStore((s) => s.setConnectionStatus);
  const initAgents = useOfficeStore((s) => s.initAgents);
  const processAgentEvent = useOfficeStore((s) => s.processAgentEvent);

  useEffect(() => {
    if (!url) return;

    const ws = new GatewayWsClient();
    const rpc = new GatewayRpcClient(ws);
    const throttle = new EventThrottle();

    wsRef.current = ws;
    rpcRef.current = rpc;
    throttleRef.current = throttle;

    throttle.onBatch((events) => {
      for (const event of events) {
        processAgentEvent(event);
      }
    });

    throttle.onImmediate((event) => {
      processAgentEvent(event);
    });

    ws.onStatusChange((status, error) => {
      setConnectionStatus(status, error);

      if (status === "connected") {
        fetchInitialData(rpc, initAgents);
      }
    });

    ws.onEvent("agent", (frame: GatewayEventFrame) => {
      throttle.push(frame.payload as AgentEventPayload);
    });

    ws.connect(url, token);

    return () => {
      throttle.destroy();
      ws.disconnect();
      wsRef.current = null;
      rpcRef.current = null;
      throttleRef.current = null;
    };
  }, [url, token, setConnectionStatus, initAgents, processAgentEvent]);

  return { wsClient: wsRef, rpcClient: rpcRef };
}

async function fetchInitialData(
  rpc: GatewayRpcClient,
  initAgents: (agents: AgentsListResponse["agents"]) => void,
): Promise<void> {
  try {
    const result = await rpc.request<AgentsListResponse>("agents.list");
    if (result.agents) {
      initAgents(result.agents);
    }
  } catch (e) {
    console.warn("[Gateway] Failed to fetch agents list:", e);
  }

  try {
    await rpc.request("tools.catalog");
  } catch {
    // tools catalog is optional
  }

  try {
    await rpc.request("usage.status");
  } catch {
    // usage is optional
  }
}
