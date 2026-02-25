import type { AgentVisualStatus } from "@/gateway/types";

export const SVG_WIDTH = 1200;
export const SVG_HEIGHT = 700;

export const ZONES = {
  desk: { x: 40, y: 40, width: 540, height: 300, label: "固定工位区" },
  meeting: { x: 620, y: 40, width: 540, height: 300, label: "会议区" },
  hotDesk: { x: 40, y: 380, width: 540, height: 280, label: "热工位区" },
  lounge: { x: 620, y: 380, width: 540, height: 280, label: "休息区" },
} as const;

export const ZONE_COLORS = {
  desk: "#1e293b",
  meeting: "#1a2332",
  hotDesk: "#1c2230",
  lounge: "#1a1f2e",
} as const;

export const STATUS_COLORS: Record<AgentVisualStatus, string> = {
  idle: "#22c55e",
  thinking: "#3b82f6",
  tool_calling: "#f97316",
  speaking: "#a855f7",
  spawning: "#06b6d4",
  error: "#ef4444",
  offline: "#6b7280",
};

export const STATUS_LABELS: Record<AgentVisualStatus, string> = {
  idle: "空闲",
  thinking: "思考中",
  tool_calling: "工具调用",
  speaking: "回复中",
  spawning: "创建中",
  error: "错误",
  offline: "离线",
};

export const DESK_GRID_COLS = 4;
export const DESK_GRID_ROWS = 3;
export const DESK_MAX_AGENTS = DESK_GRID_COLS * DESK_GRID_ROWS;

export const HOT_DESK_GRID_COLS = 4;
export const HOT_DESK_GRID_ROWS = 3;
