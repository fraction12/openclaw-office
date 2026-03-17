import type { AgentStatus, AgentEvidence } from "@/store/evidence-store";

export interface DerivedState {
  status: AgentStatus;
  confidence: number;
  derivationReason: string;
  currentTool: string | null;
  speechText: string | null;
}

const WS_STALE_MS = 30_000;
const VERY_STALE_MS = 5 * 60_000;

function clampConfidence(value: number): number {
  return Math.max(0, Math.min(1, Math.round(value * 100) / 100));
}

function decayedConfidence(ageMs: number, freshMs: number, staleMs: number, min: number, max: number): number {
  if (ageMs <= freshMs) return max;
  if (ageMs >= staleMs) return min;
  const progress = (ageMs - freshMs) / (staleMs - freshMs);
  return max - (max - min) * progress;
}

function isSleepHours(now: number): boolean {
  const hour = new Date(now).getHours();
  return hour >= 1 && hour < 6;
}

function formatAge(ageMs: number): string {
  const seconds = Math.max(0, Math.round(ageMs / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  return `${minutes}m ago`;
}

function buildState(
  status: AgentStatus,
  confidence: number,
  derivationReason: string,
  currentTool: string | null = null,
  speechText: string | null = null,
): DerivedState {
  return {
    status,
    confidence: clampConfidence(confidence),
    derivationReason,
    currentTool,
    speechText,
  };
}

export function deriveState(evidence: AgentEvidence, now: number): DerivedState {
  if (!evidence.connectionHealthy) {
    return buildState("disconnected", 1, "Connection health is false; agent is treated as disconnected.");
  }

  const wsAges = [evidence.wsLifecycle?.timestamp, evidence.wsToolCall?.timestamp, evidence.wsSpeech?.timestamp, evidence.wsError?.timestamp]
    .filter((value): value is number => typeof value === "number")
    .map((ts) => now - ts);
  const freshestWsAge = wsAges.length > 0 ? Math.min(...wsAges) : Infinity;
  const hasAnyWsEvidence = wsAges.length > 0;
  const hasAnyHttpEvidence = Boolean(evidence.httpSessionStatus || evidence.httpLastTool || evidence.lastHttpRefreshAt);
  const lastActivityAt = [
    evidence.wsLifecycle?.timestamp,
    evidence.wsToolCall?.timestamp,
    evidence.wsSpeech?.timestamp,
    evidence.wsError?.timestamp,
    evidence.httpSessionStatus?.updatedAt,
    evidence.httpLastTool?.timestamp,
    evidence.lastWsEventAt,
    evidence.lastHttpRefreshAt,
  ].filter((value): value is number => typeof value === "number");
  const freshestActivityAge = lastActivityAt.length > 0 ? now - Math.max(...lastActivityAt) : Infinity;

  if (freshestWsAge > WS_STALE_MS && evidence.httpSessionStatus) {
    const age = now - evidence.httpSessionStatus.updatedAt;
    return buildState(
      evidence.httpSessionStatus.status,
      decayedConfidence(age, 5_000, 90_000, 0.35, 0.75),
      `WebSocket evidence is stale; falling back to HTTP session status ${evidence.httpSessionStatus.status} from ${formatAge(age)}.`,
      evidence.httpLastTool?.name ?? null,
    );
  }

  if (evidence.wsError) {
    const age = now - evidence.wsError.timestamp;
    if (age <= VERY_STALE_MS) {
      return buildState(
        "error",
        decayedConfidence(age, 5_000, 60_000, 0.45, 1),
        `WebSocket error observed ${formatAge(age)}: ${evidence.wsError.message}`,
      );
    }
  }

  if (evidence.wsLifecycle?.phase === "end") {
    const age = now - evidence.wsLifecycle.timestamp;
    if (age <= VERY_STALE_MS) {
      return buildState(
        "idle",
        decayedConfidence(age, 5_000, 90_000, 0.35, 0.98),
        `Lifecycle end observed via WebSocket ${formatAge(age)}.`,
      );
    }
  }

  if (evidence.wsToolCall?.phase === "start") {
    const age = now - evidence.wsToolCall.timestamp;
    if (age <= VERY_STALE_MS) {
      return buildState(
        "tool_calling",
        decayedConfidence(age, 2_000, 60_000, 0.3, 0.97),
        `Tool start for ${evidence.wsToolCall.name} observed via WebSocket ${formatAge(age)}.`,
        evidence.wsToolCall.name,
      );
    }
  }

  if (evidence.wsSpeech) {
    const age = now - evidence.wsSpeech.timestamp;
    if (age <= VERY_STALE_MS) {
      return buildState(
        "speaking",
        decayedConfidence(age, 2_000, 45_000, 0.3, 0.96),
        `Assistant speech observed via WebSocket ${formatAge(age)}.`,
        evidence.wsToolCall?.phase === "start" ? evidence.wsToolCall.name : evidence.httpLastTool?.name ?? null,
        evidence.wsSpeech.text,
      );
    }
  }

  if (evidence.wsLifecycle && ["start", "thinking"].includes(evidence.wsLifecycle.phase)) {
    const age = now - evidence.wsLifecycle.timestamp;
    if (age <= VERY_STALE_MS) {
      return buildState(
        "thinking",
        decayedConfidence(age, 2_000, 60_000, 0.3, 0.95),
        `Lifecycle ${evidence.wsLifecycle.phase} observed via WebSocket ${formatAge(age)}.`,
        evidence.wsToolCall?.phase === "start" ? evidence.wsToolCall.name : evidence.httpLastTool?.name ?? null,
      );
    }
  }

  if (!hasAnyWsEvidence && evidence.httpSessionStatus) {
    const age = now - evidence.httpSessionStatus.updatedAt;
    return buildState(
      evidence.httpSessionStatus.status,
      decayedConfidence(age, 5_000, 120_000, 0.2, 0.55),
      `No WebSocket evidence yet; inferred ${evidence.httpSessionStatus.status} from HTTP session polling ${formatAge(age)}.`,
      evidence.httpLastTool?.name ?? null,
    );
  }

  if (isSleepHours(now) && freshestActivityAge > 15 * 60_000) {
    return buildState("sleeping", 0.6, "No recent activity during local sleep hours (1–6 AM).");
  }

  if (freshestActivityAge > VERY_STALE_MS && (hasAnyWsEvidence || hasAnyHttpEvidence)) {
    return buildState("stale", 0.2, `All evidence is older than 5 minutes; freshest signal was ${formatAge(freshestActivityAge)}.`);
  }

  if (!hasAnyWsEvidence && !hasAnyHttpEvidence) {
    return buildState("unknown", 0, "No evidence available for this agent yet.");
  }

  return buildState("unknown", 0.1, "Evidence exists, but it is insufficient to derive a trustworthy state.");
}
