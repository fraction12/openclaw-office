import type {
  AgentEventPayload,
  AgentVisualStatus,
  SpeechBubble,
  ToolInfo,
} from "./types";

export interface ParsedAgentEvent {
  runId: string;
  sessionKey?: string;
  status: AgentVisualStatus;
  currentTool: ToolInfo | null;
  speechBubble: SpeechBubble | null;
  clearTool: boolean;
  clearSpeech: boolean;
  incrementToolCount: boolean;
  toolRecord: { name: string; timestamp: number } | null;
  summary: string;
}

export function parseAgentEvent(event: AgentEventPayload): ParsedAgentEvent {
  const base: ParsedAgentEvent = {
    runId: event.runId,
    sessionKey: event.sessionKey,
    status: "idle",
    currentTool: null,
    speechBubble: null,
    clearTool: false,
    clearSpeech: false,
    incrementToolCount: false,
    toolRecord: null,
    summary: "",
  };

  switch (event.stream) {
    case "lifecycle":
      return parseLifecycle(base, event);
    case "tool":
      return parseTool(base, event);
    case "assistant":
      return parseAssistant(base, event);
    case "error":
      return parseError(base, event);
    default:
      base.summary = `unknown stream: ${event.stream}`;
      return base;
  }
}

function parseLifecycle(
  result: ParsedAgentEvent,
  event: AgentEventPayload,
): ParsedAgentEvent {
  const phase = event.data.phase as string | undefined;

  switch (phase) {
    case "start":
    case "thinking":
      result.status = "thinking";
      result.summary = phase === "start" ? "开始运行" : "思考中";
      break;
    case "end":
      result.status = "idle";
      result.clearTool = true;
      result.clearSpeech = true;
      result.summary = "运行结束";
      break;
    case "fallback":
      result.status = "error";
      result.summary = "降级处理";
      break;
    default:
      result.status = "thinking";
      result.summary = `lifecycle: ${phase ?? "unknown"}`;
  }

  return result;
}

function parseTool(
  result: ParsedAgentEvent,
  event: AgentEventPayload,
): ParsedAgentEvent {
  const phase = event.data.phase as string | undefined;
  const name = (event.data.name as string) ?? "unknown";

  if (phase === "start") {
    result.status = "tool_calling";
    result.currentTool = {
      name,
      args: event.data.args as Record<string, unknown> | undefined,
      startedAt: event.ts,
    };
    result.incrementToolCount = true;
    result.toolRecord = { name, timestamp: event.ts };
    result.summary = `调用工具: ${name}`;
  } else {
    result.status = "thinking";
    result.clearTool = true;
    result.summary = `工具完成: ${name}`;
  }

  return result;
}

function parseAssistant(
  result: ParsedAgentEvent,
  event: AgentEventPayload,
): ParsedAgentEvent {
  const text = (event.data.text as string) ?? "";
  result.status = "speaking";
  result.speechBubble = { text, timestamp: event.ts };
  result.summary = text.length > 40 ? `${text.slice(0, 40)}...` : text;
  return result;
}

function parseError(
  result: ParsedAgentEvent,
  event: AgentEventPayload,
): ParsedAgentEvent {
  const message = (event.data.message as string) ?? "未知错误";
  result.status = "error";
  result.summary = `错误: ${message}`;
  return result;
}
