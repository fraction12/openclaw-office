import type { AgentZone, VisualAgent } from "@/gateway/types";
import { CORRIDOR_ENTRANCE, OFFICE, ZONES } from "@/lib/constants";
import { corridorCenter, interpolatePathPosition } from "@/lib/movement-animator";
import { getZoneAt, gridToPixel, isWalkable, type MapZone, type OfficeGrid } from "./office-map";

interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

const halfW = (OFFICE.width - OFFICE.corridorWidth) / 2;
const halfH = (OFFICE.height - OFFICE.corridorWidth) / 2;
const corridorLeft = OFFICE.x + halfW;
const corridorTop = OFFICE.y + halfH;

const SVG_ZONE_RECTS: Record<AgentZone, Rect> = {
  desk: rectFromZone(ZONES.desk),
  meeting: rectFromZone(ZONES.meeting),
  hotDesk: rectFromZone(ZONES.hotDesk),
  lounge: rectFromZone(ZONES.lounge),
  corridor: {
    left: corridorLeft,
    top: corridorTop,
    right: corridorLeft + OFFICE.corridorWidth,
    bottom: OFFICE.y + OFFICE.height,
  },
};

function rectFromZone(zone: { x: number; y: number; width: number; height: number }): Rect {
  return {
    left: zone.x,
    top: zone.y,
    right: zone.x + zone.width,
    bottom: zone.y + zone.height,
  };
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function rectWidth(rect: Rect): number {
  return Math.max(1, rect.right - rect.left);
}

function rectHeight(rect: Rect): number {
  return Math.max(1, rect.bottom - rect.top);
}

function rectCenterX(rect: Rect): number {
  return (rect.left + rect.right) / 2;
}

function rectCenterY(rect: Rect): number {
  return (rect.top + rect.bottom) / 2;
}

function zoneForTile(grid: OfficeGrid, gx: number, gy: number): MapZone {
  return getZoneAt(grid, gx, gy);
}

function getWalkableBounds(grid: OfficeGrid, zone: MapZone): Rect {
  let minGx = Number.POSITIVE_INFINITY;
  let minGy = Number.POSITIVE_INFINITY;
  let maxGx = Number.NEGATIVE_INFINITY;
  let maxGy = Number.NEGATIVE_INFINITY;

  for (let gy = 0; gy < grid.height; gy++) {
    for (let gx = 0; gx < grid.width; gx++) {
      if (!isWalkable(grid.tiles[gy][gx])) continue;
      if (zoneForTile(grid, gx, gy) !== zone) continue;
      minGx = Math.min(minGx, gx);
      minGy = Math.min(minGy, gy);
      maxGx = Math.max(maxGx, gx);
      maxGy = Math.max(maxGy, gy);
    }
  }

  if (!Number.isFinite(minGx) || !Number.isFinite(minGy) || !Number.isFinite(maxGx) || !Number.isFinite(maxGy)) {
    return {
      left: 0,
      top: 0,
      right: grid.pixelWidth,
      bottom: grid.pixelHeight,
    };
  }

  const topLeft = gridToPixel(minGx, minGy);
  const bottomRight = gridToPixel(maxGx, maxGy);

  return {
    left: topLeft.x,
    top: topLeft.y,
    right: bottomRight.x,
    bottom: bottomRight.y,
  };
}

function getPixiZoneDoorPoint(grid: OfficeGrid, zone: AgentZone): { x: number; y: number } {
  if (zone === "corridor") {
    return projectCorridorPoint(grid, CORRIDOR_ENTRANCE);
  }

  const bounds = getWalkableBounds(grid, zone);
  const x = rectCenterX(bounds);

  switch (zone) {
    case "desk":
    case "meeting":
      return { x, y: bounds.bottom };
    case "hotDesk":
    case "lounge":
      return { x, y: bounds.top };
  }
}

function sameCorridorArm(a: AgentZone, b: AgentZone): boolean {
  if (a === "corridor" || b === "corridor") return false;

  const verticalLeft: AgentZone[] = ["desk", "hotDesk"];
  const verticalRight: AgentZone[] = ["meeting", "lounge"];
  const horizontalTop: AgentZone[] = ["desk", "meeting"];
  const horizontalBottom: AgentZone[] = ["hotDesk", "lounge"];

  if (verticalLeft.includes(a) && verticalLeft.includes(b)) return true;
  if (verticalRight.includes(a) && verticalRight.includes(b)) return true;
  if (horizontalTop.includes(a) && horizontalTop.includes(b)) return true;
  if (horizontalBottom.includes(a) && horizontalBottom.includes(b)) return true;
  return false;
}

function projectRectPosition(
  position: { x: number; y: number },
  sourceRect: Rect,
  targetRect: Rect,
): { x: number; y: number } {
  const tx = clamp01((position.x - sourceRect.left) / rectWidth(sourceRect));
  const ty = clamp01((position.y - sourceRect.top) / rectHeight(sourceRect));

  return {
    x: targetRect.left + tx * rectWidth(targetRect),
    y: targetRect.top + ty * rectHeight(targetRect),
  };
}

function projectCorridorPoint(grid: OfficeGrid, position: { x: number; y: number }): { x: number; y: number } {
  const corridorBounds = getWalkableBounds(grid, "corridor");
  const entrance = {
    x: rectCenterX(corridorBounds),
    y: corridorBounds.bottom,
  };
  const center = {
    x: rectCenterX(corridorBounds),
    y: rectCenterY(corridorBounds),
  };

  const srcDy = corridorCenter.y - CORRIDOR_ENTRANCE.y;
  const progress = srcDy === 0
    ? 1
    : clamp01((position.y - CORRIDOR_ENTRANCE.y) / srcDy);

  return {
    x: entrance.x + (center.x - entrance.x) * progress,
    y: entrance.y + (center.y - entrance.y) * progress,
  };
}

export function projectStorePosition(
  grid: OfficeGrid,
  position: { x: number; y: number },
  zone: AgentZone,
): { x: number; y: number } {
  if (zone === "corridor") {
    return projectCorridorPoint(grid, position);
  }

  return projectRectPosition(
    position,
    SVG_ZONE_RECTS[zone],
    getWalkableBounds(grid, zone),
  );
}

export function projectMovementPath(
  grid: OfficeGrid,
  agent: VisualAgent,
): Array<{ x: number; y: number }> {
  const movement = agent.movement;
  if (!movement || movement.path.length === 0) {
    return [projectStorePosition(grid, agent.position, agent.zone)];
  }

  const from = movement.path[0];
  const to = movement.path[movement.path.length - 1] ?? movement.path[0];
  const projectedPath = [
    projectStorePosition(grid, from, movement.fromZone),
    getPixiZoneDoorPoint(grid, movement.fromZone),
  ];

  if (!sameCorridorArm(movement.fromZone, movement.toZone)) {
    projectedPath.push(projectCorridorPoint(grid, corridorCenter));
  }

  projectedPath.push(
    getPixiZoneDoorPoint(grid, movement.toZone),
    projectStorePosition(grid, to, movement.toZone),
  );

  return projectedPath;
}

export function projectVisualAgentPosition(
  grid: OfficeGrid,
  agent: VisualAgent,
): { x: number; y: number } {
  if (agent.movement && agent.movement.path.length > 0) {
    return interpolatePathPosition(projectMovementPath(grid, agent), agent.movement.progress);
  }
  return projectStorePosition(grid, agent.position, agent.zone);
}
