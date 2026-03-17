/**
 * Adapter provider — synchronous singleton.
 *
 * The adapter is created and stored synchronously when the WS connection
 * establishes. Console stores call getAdapter() which returns it or null.
 * No promises, no waiters, no race conditions.
 */
import type { GatewayAdapter } from "./adapter";
import type { GatewayRpcClient } from "./rpc-client";
import type { GatewayWsClient } from "./ws-client";
import { WsAdapter } from "./ws-adapter";

let adapterInstance: GatewayAdapter | null = null;

/** Get the current adapter, or null if not yet connected. */
export function getAdapter(): GatewayAdapter | null {
  return adapterInstance;
}

/** Get the current adapter, or throw if not connected. */
export function getAdapterOrThrow(): GatewayAdapter {
  if (!adapterInstance) throw new Error("Gateway not connected");
  return adapterInstance;
}

/** Create and store the WS adapter synchronously. Called by useGatewayConnection on connect. */
export function setWsAdapter(wsClient: GatewayWsClient, rpcClient: GatewayRpcClient): GatewayAdapter {
  // Disconnect previous adapter if any
  if (adapterInstance) {
    adapterInstance.disconnect();
  }
  const adapter = new WsAdapter(wsClient, rpcClient);
  // WsAdapter.connect() is synchronous — just subscribes to events
  void adapter.connect();
  adapterInstance = adapter;
  return adapter;
}

/** Create and store a mock adapter (lazy import). */
export async function setMockAdapter(): Promise<GatewayAdapter> {
  if (adapterInstance) {
    adapterInstance.disconnect();
  }
  const { MockAdapter } = await import("@/gateway/mock-adapter");
  const adapter = new MockAdapter();
  await adapter.connect();
  adapterInstance = adapter;
  return adapter;
}

/** Clear the adapter (on disconnect/cleanup). */
export function resetAdapter(): void {
  if (adapterInstance) {
    adapterInstance.disconnect();
  }
  adapterInstance = null;
}

export function isMockMode(): boolean {
  if (import.meta.env.VITE_MOCK === "true") return true;
  return new URLSearchParams(window.location.search).get("mock") === "true";
}

export function __resetAdapterForTests(): void {
  resetAdapter();
}
