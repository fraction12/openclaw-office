import type { AgentVisualStatus } from "@/gateway/types";
import i18n from "@/i18n";
import { getActiveLayout, getCorridorCenter, getCorridorEntrance, getOfficeFrame, getZoneByPurpose } from "./zone-config";

const layout = getActiveLayout();
const officeFrame = getOfficeFrame(layout);
const deskZone = getZoneByPurpose(layout, "desk");
const meetingZone = getZoneByPurpose(layout, "meeting");
const hotDeskZone = getZoneByPurpose(layout, "hotDesk");
const loungeZone = getZoneByPurpose(layout, "lounge");

export const SVG_WIDTH = layout.svgWidth;
export const SVG_HEIGHT = layout.svgHeight;

// Unified office floor plan: one building shell with internal partitions
export const OFFICE = {
  x: officeFrame.x,
  y: officeFrame.y,
  width: officeFrame.width,
  height: officeFrame.height,
  wallThickness: layout.wallThickness,
  cornerRadius: layout.cornerRadius,
  corridorWidth: layout.corridorWidth,
} as const;

export const ZONES = {
  desk: { x: deskZone?.x ?? OFFICE.x, y: deskZone?.y ?? OFFICE.y, width: deskZone?.width ?? OFFICE.width / 2, height: deskZone?.height ?? OFFICE.height / 2, label: "Main Office" },
  meeting: { x: meetingZone?.x ?? OFFICE.x, y: meetingZone?.y ?? OFFICE.y, width: meetingZone?.width ?? OFFICE.width / 2, height: meetingZone?.height ?? OFFICE.height / 2, label: "Meeting Room" },
  hotDesk: { x: hotDeskZone?.x ?? OFFICE.x, y: hotDeskZone?.y ?? OFFICE.y, width: hotDeskZone?.width ?? OFFICE.width / 2, height: hotDeskZone?.height ?? OFFICE.height / 2, label: "Subagent Desks" },
  lounge: { x: loungeZone?.x ?? OFFICE.x, y: loungeZone?.y ?? OFFICE.y, width: loungeZone?.width ?? OFFICE.width / 2, height: loungeZone?.height ?? OFFICE.height / 2, label: "Lounge" },
} as const;

// Corridor entrance point: bottom center of the building (main entrance door)
export const CORRIDOR_ENTRANCE = getCorridorEntrance(layout);

// Corridor center crossing point
export const CORRIDOR_CENTER = getCorridorCenter(layout);

export const ZONE_COLORS = {
  desk: "#f4f6f9",
  meeting: "#eef3fa",
  hotDesk: "#f1f3f7",
  lounge: "#f3f1f7",
  corridor: "#e8ecf1",
  wall: "#8b9bb0",
} as const;

export const ZONE_COLORS_DARK = {
  desk: "#1e293b",
  meeting: "#1a2744",
  hotDesk: "#1e2433",
  lounge: "#231e33",
  corridor: "#0f172a",
  wall: "#475569",
} as const;

export const STATUS_COLORS: Record<AgentVisualStatus, string> = {
  active: "#3B82F6",
  idle: "#6B7280",
  error: "#EF4444",
};

export const STATUS_LABELS: Record<AgentVisualStatus, string> = {
  active: "Active",
  idle: "Idle",
  error: "Error",
};

export function getZoneLabel(zone: keyof typeof ZONES): string {
  return i18n.t(`common:zones.${zone}`);
}

export function getStatusLabel(status: AgentVisualStatus): string {
  return i18n.t(`common:agent.statusLabels.${status}`);
}

export const DESK_GRID_COLS = 4;
export const DESK_GRID_ROWS = 3;
export const DESK_MAX_AGENTS = DESK_GRID_COLS * DESK_GRID_ROWS;

export const HOT_DESK_GRID_COLS = 4;
export const HOT_DESK_GRID_ROWS = 3;

export const MIN_DESK_WIDTH = 100;
export const DEFAULT_MAX_SUB_AGENTS = 8;

// Furniture dimension constants (flat isometric 2D)
export const FURNITURE = {
  desk: { width: 100, height: 60 },
  chair: { size: 30 },
  meetingTable: { minRadius: 60, maxRadius: 100 },
  sofa: { width: 110, height: 50 },
  plant: { width: 28, height: 36 },
  coffeeCup: { size: 14 },
} as const;

// Desk unit (Desk + Chair + AgentAvatar)
export const DESK_UNIT = {
  width: 140,
  height: 110,
  avatarRadius: 20,
  avatarOffsetY: -8,
} as const;

// Agent avatar
export const AVATAR = {
  radius: 20,
  selectedRadius: 24,
  strokeWidth: 3,
  nameLabelMaxChars: 12,
} as const;

// 3D scene constants
// SVG 1200×700 maps to 3D building 16×12 world units
export const SCALE_X_2D_TO_3D = 16 / SVG_WIDTH;
export const SCALE_Z_2D_TO_3D = 12 / SVG_HEIGHT;
export const SCALE_2D_TO_3D = 0.01; // legacy — kept for tests
export const DESK_HEIGHT = 0.42;
export const CHARACTER_Y = 0;
export const MEETING_TABLE_RADIUS = 1.2;
export const MEETING_SEAT_RADIUS = 1.7;
