import type { ParsedAgentEvent } from "@/gateway/event-parser";
import type { VisualAgent } from "@/gateway/types";
import type { DerivedState } from "@/lib/state-deriver";

export function applyEventToAgent(
  agent: VisualAgent,
  parsed: ParsedAgentEvent,
  derived: DerivedState,
  eventTimestamp: number,
): void {
  agent.status = derived.status;
  agent.statusConfidence = derived.confidence;
  agent.statusReason = derived.derivationReason;
  agent.statusDerivedAt = eventTimestamp;
  agent.confidence = derived.confidence;
  agent.derivationReason = derived.derivationReason;
  agent.lastActiveAt = eventTimestamp;

  if (parsed.currentTool) {
    agent.currentTool = parsed.currentTool;
  } else if (derived.currentTool) {
    agent.currentTool = { name: derived.currentTool, startedAt: eventTimestamp };
  }
  if (parsed.clearTool) {
    agent.currentTool = null;
  }

  if (parsed.speechBubble) {
    agent.speechBubble = parsed.speechBubble;
  } else if (derived.speechText) {
    agent.speechBubble = { text: derived.speechText, timestamp: eventTimestamp };
  }
  if (parsed.clearSpeech) {
    agent.speechBubble = null;
  }

  // Clear cron label when session ends
  if (parsed.clearTool && parsed.clearSpeech) {
    agent.cronLabel = null;
  }

  if (parsed.incrementToolCount) {
    agent.toolCallCount++;
  }

  if (parsed.toolRecord) {
    agent.toolCallHistory = [parsed.toolRecord, ...agent.toolCallHistory.slice(0, 9)];
  }

  if (parsed.runId && !agent.runId) {
    agent.runId = parsed.runId;
  }
}
