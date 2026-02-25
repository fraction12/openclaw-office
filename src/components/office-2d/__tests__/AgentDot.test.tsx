import { describe, it, expect, beforeEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { AgentDot } from "@/components/office-2d/AgentDot";
import { useOfficeStore } from "@/store/office-store";
import type { VisualAgent } from "@/gateway/types";

const mockAgent: VisualAgent = {
  id: "a1",
  name: "TestBot",
  status: "idle",
  position: { x: 200, y: 150 },
  currentTool: null,
  speechBubble: null,
  lastActiveAt: Date.now(),
  toolCallCount: 0,
  toolCallHistory: [],
  runId: null,
  isSubAgent: false,
};

function renderDot(agent: VisualAgent = mockAgent) {
  return render(
    <svg>
      <AgentDot agent={agent} />
    </svg>,
  );
}

describe("AgentDot", () => {
  beforeEach(() => {
    useOfficeStore.setState({ selectedAgentId: null });
  });

  it("renders circle with correct fill color for idle", () => {
    const { container } = renderDot();
    const circles = container.querySelectorAll("circle");
    const mainCircle = circles[0];
    expect(mainCircle.getAttribute("fill")).toBe("#22c55e");
  });

  it("renders circle with error color", () => {
    const { container } = renderDot({ ...mockAgent, status: "error" });
    const circle = container.querySelector("circle");
    expect(circle?.getAttribute("fill")).toBe("#ef4444");
  });

  it("shows initial letter", () => {
    const { container } = renderDot();
    const text = container.querySelector("text");
    expect(text?.textContent).toBe("T");
  });

  it("clicking triggers selectAgent", () => {
    const { container } = renderDot();
    const g = container.querySelector("g");
    fireEvent.click(g!);
    expect(useOfficeStore.getState().selectedAgentId).toBe("a1");
  });
});
