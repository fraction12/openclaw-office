import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GatewayWsClient } from "@/gateway/ws-client";

class MockWebSocket {
  static CONNECTING = 0 as const;
  static OPEN = 1 as const;
  static CLOSING = 2 as const;
  static CLOSED = 3 as const;

  static instances: MockWebSocket[] = [];
  readyState: number = MockWebSocket.CONNECTING;
  onopen: (() => void) | null = null;
  onmessage: ((e: MessageEvent) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  sent: string[] = [];

  constructor(_url: string) {
    MockWebSocket.instances.push(this);
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      this.onopen?.();
    }, 0);
  }

  send(data: string) {
    this.sent.push(data);
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
  }

  simulateMessage(data: unknown) {
    this.onmessage?.(new MessageEvent("message", { data: JSON.stringify(data) }));
  }

  simulateClose() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.();
  }

  static reset() {
    MockWebSocket.instances = [];
  }
}

describe("GatewayWsClient", () => {
  let originalWs: typeof WebSocket;
  let client: GatewayWsClient;

  beforeEach(() => {
    vi.useFakeTimers();
    originalWs = globalThis.WebSocket;
    globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket;
    MockWebSocket.reset();
    client = new GatewayWsClient();
  });

  afterEach(() => {
    client.disconnect();
    globalThis.WebSocket = originalWs;
    vi.useRealTimers();
  });

  it("sends connect request after challenge", async () => {
    const statusHandler = vi.fn();
    client.onStatusChange(statusHandler);
    client.connect("ws://localhost:18789", "test-token");

    await vi.advanceTimersByTimeAsync(10);

    const ws = MockWebSocket.instances[0];
    ws.simulateMessage({
      type: "event",
      event: "connect.challenge",
      payload: { nonce: "abc" },
    });

    expect(ws.sent.length).toBe(1);
    const req = JSON.parse(ws.sent[0]);
    expect(req.type).toBe("req");
    expect(req.method).toBe("connect");
    expect(req.params.client.id).toBe("webchat-ui");
    expect(req.params.auth.token).toBe("test-token");
  });

  it("updates status to connected on hello-ok", async () => {
    const statusHandler = vi.fn();
    client.onStatusChange(statusHandler);
    client.connect("ws://localhost:18789", "token");

    await vi.advanceTimersByTimeAsync(10);

    const ws = MockWebSocket.instances[0];
    ws.simulateMessage({
      type: "event",
      event: "connect.challenge",
      payload: {},
    });

    ws.simulateMessage({
      type: "res",
      id: "any",
      ok: true,
      payload: { type: "hello-ok", protocol: 3, server: { name: "gw", version: "1" }, features: [] },
    });

    expect(client.getStatus()).toBe("connected");
  });

  it("dispatches events to registered handlers", async () => {
    const handler = vi.fn();
    client.onEvent("agent", handler);
    client.connect("ws://localhost:18789", "");

    await vi.advanceTimersByTimeAsync(10);

    const ws = MockWebSocket.instances[0];
    ws.simulateMessage({
      type: "event",
      event: "agent",
      payload: { runId: "r1", seq: 1, stream: "lifecycle", ts: 1, data: {} },
    });

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("schedules reconnect on close", async () => {
    client.connect("ws://localhost:18789", "");
    await vi.advanceTimersByTimeAsync(10);

    const ws = MockWebSocket.instances[0];
    ws.simulateClose();

    expect(client.getStatus()).toBe("reconnecting");

    // After delay, a new WebSocket should be created
    await vi.advanceTimersByTimeAsync(2000);
    expect(MockWebSocket.instances.length).toBeGreaterThan(1);
  });

  it("stops reconnecting on shutdown event", async () => {
    client.connect("ws://localhost:18789", "");
    await vi.advanceTimersByTimeAsync(10);

    const ws = MockWebSocket.instances[0];
    ws.simulateMessage({
      type: "event",
      event: "shutdown",
      payload: { reason: "maintenance" },
    });

    expect(client.getStatus()).toBe("disconnected");
  });
});
