import { describe, it, expect } from "vitest";
import { allocatePosition } from "@/lib/position-allocator";

describe("allocatePosition", () => {
  it("same agentId always gets same position (deterministic)", () => {
    const pos1 = allocatePosition("agent-alpha", false, new Set());
    const pos2 = allocatePosition("agent-alpha", false, new Set());
    expect(pos1).toEqual(pos2);
  });

  it("different agentIds get different positions", () => {
    const occupied = new Set<string>();
    const pos1 = allocatePosition("agent-a", false, occupied);
    occupied.add(`${pos1.x},${pos1.y}`);
    const pos2 = allocatePosition("agent-b", false, occupied);
    expect(pos1).not.toEqual(pos2);
  });

  it("sub-agents go to hot desk zone", () => {
    const pos = allocatePosition("sub-1", true, new Set());
    // Hot desk zone starts at y=380
    expect(pos.y).toBeGreaterThanOrEqual(380);
  });

  it("desk zone overflow falls back to hot desk", () => {
    const occupied = new Set<string>();
    const positions: Array<{ x: number; y: number }> = [];

    // Fill up 12 desk positions
    for (let i = 0; i < 15; i++) {
      const pos = allocatePosition(`agent-${i}`, false, occupied);
      occupied.add(`${pos.x},${pos.y}`);
      positions.push(pos);
    }

    // Some positions should be in hot desk zone (y >= 380)
    const hotDeskPositions = positions.filter((p) => p.y >= 380);
    expect(hotDeskPositions.length).toBeGreaterThan(0);
  });

  it("no collision between allocated positions", () => {
    const occupied = new Set<string>();
    const seen = new Set<string>();

    for (let i = 0; i < 20; i++) {
      const pos = allocatePosition(`agent-${i}`, false, occupied);
      const key = `${pos.x},${pos.y}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
      occupied.add(key);
    }
  });
});
