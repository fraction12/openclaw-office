import { useEffect, useRef } from "react";
import { useOfficeStore } from "@/store";
import {
  computeActivityLevel,
  applyAmbientStyles,
  setSoundEnabled,
  isSoundEnabled,
  playAgentActive,
  playAgentIdle,
  playError,
  playSubAgentSpawn,
} from "@/lib/ambient";

const RECENT_WINDOW_MS = 60_000;

/**
 * Hook that drives ambient feel from office state.
 * Call once at the app root (e.g. in OfficeView or AppShell).
 */
export function useAmbient() {
  const agents = useOfficeStore((s) => s.agents);
  const eventHistory = useOfficeStore((s) => s.eventHistory);
  const prevStatusRef = useRef<Map<string, string>>(new Map());

  // Compute and apply activity level
  useEffect(() => {
    const agentList = Array.from(agents.values());
    const total = agentList.length;
    const active = agentList.filter(
      (a) => a.status !== "idle" && a.status !== "offline" && a.status !== "sleeping",
    ).length;

    const now = Date.now();
    const recentEvents = eventHistory.filter((e) => now - e.timestamp < RECENT_WINDOW_MS).length;

    const level = computeActivityLevel(total, active, recentEvents);
    applyAmbientStyles(level);
  }, [agents, eventHistory]);

  // Play sounds on state transitions
  useEffect(() => {
    if (!isSoundEnabled()) return;

    const prevStatuses = prevStatusRef.current;
    const newStatuses = new Map<string, string>();

    for (const [id, agent] of agents) {
      newStatuses.set(id, agent.status);
      const prev = prevStatuses.get(id);

      if (!prev) {
        // New agent appeared
        if (agent.isSubAgent) {
          playSubAgentSpawn();
        }
        continue;
      }

      if (prev === agent.status) continue;

      // State changed
      if (agent.status === "error") {
        playError();
      } else if (
        agent.status === "thinking" ||
        agent.status === "tool_calling" ||
        agent.status === "speaking"
      ) {
        if (prev === "idle" || prev === "sleeping") {
          playAgentActive();
        }
      } else if (agent.status === "idle" || agent.status === "sleeping") {
        if (prev === "thinking" || prev === "tool_calling" || prev === "speaking") {
          playAgentIdle();
        }
      }
    }

    prevStatusRef.current = newStatuses;
  }, [agents]);
}

/**
 * Enable/disable ambient sounds from user preference.
 * Can be called from settings UI.
 */
export function toggleAmbientSound(enabled: boolean): void {
  setSoundEnabled(enabled);
  try {
    localStorage.setItem("openclaw-ambient-sound", enabled ? "1" : "0");
  } catch {
    // storage unavailable
  }
}

/** Restore sound preference from localStorage */
export function restoreAmbientSound(): void {
  try {
    const stored = localStorage.getItem("openclaw-ambient-sound");
    if (stored === "1") {
      setSoundEnabled(true);
    }
  } catch {
    // storage unavailable
  }
}
