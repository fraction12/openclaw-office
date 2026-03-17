/**
 * Procedurally generated top-down office map.
 * The Pixi tilemap now derives from the canonical office layout config so the
 * renderer, projection logic, and movement paths share the same room geometry.
 */

import { getActiveLayout, getZoneByPurpose, type ZoneConfig } from "@/lib/zone-config";

export const TILE_SIZE = 32;

const GRID_PADDING = 1;
const OUTER_WALL = 1;
const PARTITION_WALL = 1;
const TARGET_MAP_WIDTH = 30;
const TARGET_MAP_HEIGHT = 20;

export type TileType =
  | "void"
  | "wall"
  | "floor_office"
  | "floor_meeting"
  | "floor_hotdesk"
  | "floor_lounge"
  | "corridor"
  | "door"
  | "desk"
  | "chair"
  | "table"
  | "sofa"
  | "plant"
  | "machine";

/** Which floor type furniture sits on, based on zone */
export type FloorVariant = "office" | "meeting" | "hotdesk" | "lounge";
export type MapZone = "desk" | "meeting" | "hotDesk" | "lounge" | "corridor";

interface TileRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

interface GeneratedLayout {
  width: number;
  height: number;
  officeBounds: TileRect;
  corridorCols: { left: number; right: number };
  corridorRows: { top: number; bottom: number };
  roomRects: Record<Exclude<MapZone, "corridor">, TileRect>;
  roomDoors: Record<Exclude<MapZone, "corridor">, { gx: number; gy: number }>;
  entrance: { gx: number; gy: number };
  labelAnchors: Record<Exclude<MapZone, "corridor">, { gx: number; gy: number }>;
}

export interface OfficeGrid {
  width: number;
  height: number;
  tiles: TileType[][];
  pixelWidth: number;
  pixelHeight: number;
  roomRects: Record<Exclude<MapZone, "corridor">, TileRect>;
  labelAnchors: Record<Exclude<MapZone, "corridor">, { gx: number; gy: number }>;
  entrance: { gx: number; gy: number };
}

const WALKABLE: Set<TileType> = new Set([
  "floor_office",
  "floor_meeting",
  "floor_hotdesk",
  "floor_lounge",
  "corridor",
  "door",
]);

function createBlankTiles(width: number, height: number): TileType[][] {
  return Array.from({ length: height }, () => Array.from({ length: width }, () => "void" as TileType));
}

function clampToRect(value: number, start: number, end: number): number {
  return Math.max(start, Math.min(end, value));
}

function centerOf(rect: TileRect): { gx: number; gy: number } {
  return {
    gx: Math.floor((rect.left + rect.right) / 2),
    gy: Math.floor((rect.top + rect.bottom) / 2),
  };
}

function zoneRatio(zone: ZoneConfig | undefined, otherZone: ZoneConfig | undefined, axis: "width" | "height"): number {
  const zoneSize = zone?.[axis] ?? 1;
  const otherSize = otherZone?.[axis] ?? 1;
  return zoneSize / (zoneSize + otherSize);
}

function buildGeneratedLayout(): GeneratedLayout {
  const layout = getActiveLayout();
  const deskZone = getZoneByPurpose(layout, "desk");
  const meetingZone = getZoneByPurpose(layout, "meeting");
  const hotDeskZone = getZoneByPurpose(layout, "hotDesk");

  const width = TARGET_MAP_WIDTH;
  const height = TARGET_MAP_HEIGHT;

  const officeBounds = {
    left: GRID_PADDING,
    top: GRID_PADDING,
    right: width - GRID_PADDING - 1,
    bottom: height - GRID_PADDING - 1,
  };

  const corridorWidthTiles = Math.max(2, Math.round((layout.corridorWidth / layout.svgHeight) * TARGET_MAP_HEIGHT));
  const roomWidthTotal = width - GRID_PADDING * 2 - OUTER_WALL * 2 - PARTITION_WALL * 2 - corridorWidthTiles;
  const roomHeightTotal = height - GRID_PADDING * 2 - OUTER_WALL * 2 - PARTITION_WALL * 2 - corridorWidthTiles;

  const leftRatio = zoneRatio(deskZone, meetingZone, "width");
  const topRatio = zoneRatio(deskZone, hotDeskZone, "height");

  const leftRoomWidth = Math.max(8, Math.round(roomWidthTotal * leftRatio));
  const topRoomHeight = Math.max(5, Math.round(roomHeightTotal * topRatio));

  const deskRect: TileRect = {
    left: officeBounds.left + OUTER_WALL,
    top: officeBounds.top + OUTER_WALL,
    right: officeBounds.left + OUTER_WALL + leftRoomWidth - 1,
    bottom: officeBounds.top + OUTER_WALL + topRoomHeight - 1,
  };
  const meetingRect: TileRect = {
    left: deskRect.right + PARTITION_WALL + corridorWidthTiles + PARTITION_WALL + 1,
    top: deskRect.top,
    right: officeBounds.right - OUTER_WALL,
    bottom: deskRect.bottom,
  };
  const hotDeskRect: TileRect = {
    left: deskRect.left,
    top: deskRect.bottom + PARTITION_WALL + corridorWidthTiles + PARTITION_WALL + 1,
    right: deskRect.right,
    bottom: officeBounds.bottom - OUTER_WALL,
  };
  const loungeRect: TileRect = {
    left: meetingRect.left,
    top: hotDeskRect.top,
    right: meetingRect.right,
    bottom: hotDeskRect.bottom,
  };

  const corridorCols = {
    left: deskRect.right + PARTITION_WALL + 1,
    right: deskRect.right + PARTITION_WALL + corridorWidthTiles,
  };
  const corridorRows = {
    top: deskRect.bottom + PARTITION_WALL + 1,
    bottom: deskRect.bottom + PARTITION_WALL + corridorWidthTiles,
  };

  const roomDoors = {
    desk: {
      gx: clampToRect(Math.floor((deskRect.left + deskRect.right) / 2), deskRect.left + 1, deskRect.right - 1),
      gy: deskRect.bottom + 1,
    },
    meeting: {
      gx: clampToRect(Math.floor((meetingRect.left + meetingRect.right) / 2), meetingRect.left + 1, meetingRect.right - 1),
      gy: meetingRect.bottom + 1,
    },
    hotDesk: {
      gx: clampToRect(Math.floor((hotDeskRect.left + hotDeskRect.right) / 2), hotDeskRect.left + 1, hotDeskRect.right - 1),
      gy: hotDeskRect.top - 1,
    },
    lounge: {
      gx: clampToRect(Math.floor((loungeRect.left + loungeRect.right) / 2), loungeRect.left + 1, loungeRect.right - 1),
      gy: loungeRect.top - 1,
    },
  };

  const entrance = {
    gx: Math.floor((corridorCols.left + corridorCols.right) / 2),
    gy: officeBounds.bottom,
  };

  return {
    width,
    height,
    officeBounds,
    corridorCols,
    corridorRows,
    roomRects: {
      desk: deskRect,
      meeting: meetingRect,
      hotDesk: hotDeskRect,
      lounge: loungeRect,
    },
    roomDoors,
    entrance,
    labelAnchors: {
      desk: centerOf(deskRect),
      meeting: centerOf(meetingRect),
      hotDesk: centerOf(hotDeskRect),
      lounge: centerOf(loungeRect),
    },
  };
}

function setRect(tiles: TileType[][], rect: TileRect, tile: TileType): void {
  for (let gy = rect.top; gy <= rect.bottom; gy++) {
    for (let gx = rect.left; gx <= rect.right; gx++) {
      tiles[gy][gx] = tile;
    }
  }
}

function setTile(tiles: TileType[][], gx: number, gy: number, tile: TileType): void {
  if (gy < 0 || gy >= tiles.length || gx < 0 || gx >= tiles[0].length) return;
  tiles[gy][gx] = tile;
}

function placeDeskCluster(tiles: TileType[][], rect: TileRect, rows: number, cols: number): void {
  const colStep = rect.right - rect.left <= 4 ? 2 : Math.max(3, Math.floor((rect.right - rect.left) / Math.max(cols, 1)));
  const rowStep = rect.bottom - rect.top <= 4 ? 2 : Math.max(2, Math.floor((rect.bottom - rect.top) / Math.max(rows, 1)));

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const gx = clampToRect(rect.left + 1 + col * colStep, rect.left + 1, rect.right - 1);
      const gy = clampToRect(rect.top + 1 + row * rowStep, rect.top + 1, rect.bottom - 1);
      setTile(tiles, gx, gy, "desk");
    }
  }
}

function placeMeetingFurniture(tiles: TileType[][], rect: TileRect): void {
  const center = centerOf(rect);
  const tableCells = [
    { gx: center.gx - 1, gy: center.gy - 1 },
    { gx: center.gx, gy: center.gy - 1 },
    { gx: center.gx + 1, gy: center.gy - 1 },
    { gx: center.gx - 1, gy: center.gy },
    { gx: center.gx, gy: center.gy },
    { gx: center.gx + 1, gy: center.gy },
  ];

  for (const cell of tableCells) {
    setTile(tiles, clampToRect(cell.gx, rect.left + 1, rect.right - 1), clampToRect(cell.gy, rect.top + 1, rect.bottom - 1), "table");
  }

  const chairs = [
    { gx: center.gx - 2, gy: center.gy - 1 },
    { gx: center.gx + 2, gy: center.gy - 1 },
    { gx: center.gx - 2, gy: center.gy },
    { gx: center.gx + 2, gy: center.gy },
  ];

  for (const chair of chairs) {
    setTile(tiles, clampToRect(chair.gx, rect.left + 1, rect.right - 1), clampToRect(chair.gy, rect.top + 1, rect.bottom - 1), "chair");
  }
}

function placeLoungeFurniture(tiles: TileType[][], rect: TileRect): void {
  setTile(tiles, rect.left + 2, rect.top + 2, "sofa");
  setTile(tiles, rect.left + 4, rect.top + 2, "sofa");
  setTile(tiles, rect.right - 2, rect.top + 2, "plant");
  setTile(tiles, rect.right - 2, rect.top + 4, "machine");
  setTile(tiles, rect.right - 4, rect.bottom - 2, "plant");
}

function buildFurniture(tiles: TileType[][], layout: GeneratedLayout): void {
  placeDeskCluster(tiles, layout.roomRects.desk, 2, 3);
  placeDeskCluster(tiles, layout.roomRects.hotDesk, 2, 2);
  setTile(tiles, layout.roomRects.desk.right - 1, layout.roomRects.desk.bottom - 1, "plant");
  setTile(tiles, layout.roomRects.hotDesk.right - 1, layout.roomRects.hotDesk.bottom - 1, "plant");
  placeMeetingFurniture(tiles, layout.roomRects.meeting);
  placeLoungeFurniture(tiles, layout.roomRects.lounge);
}

export function parseMap(): OfficeGrid {
  const layout = buildGeneratedLayout();
  const tiles = createBlankTiles(layout.width, layout.height);

  setRect(tiles, layout.officeBounds, "wall");

  setRect(tiles, layout.roomRects.desk, "floor_office");
  setRect(tiles, layout.roomRects.meeting, "floor_meeting");
  setRect(tiles, layout.roomRects.hotDesk, "floor_hotdesk");
  setRect(tiles, layout.roomRects.lounge, "floor_lounge");

  for (let gy = layout.officeBounds.top + OUTER_WALL; gy <= layout.officeBounds.bottom - OUTER_WALL; gy++) {
    for (let gx = layout.corridorCols.left; gx <= layout.corridorCols.right; gx++) {
      setTile(tiles, gx, gy, "corridor");
    }
  }

  for (let gy = layout.corridorRows.top; gy <= layout.corridorRows.bottom; gy++) {
    for (let gx = layout.officeBounds.left + OUTER_WALL; gx <= layout.officeBounds.right - OUTER_WALL; gx++) {
      setTile(tiles, gx, gy, "corridor");
    }
  }

  setTile(tiles, layout.entrance.gx, layout.entrance.gy, "door");
  setTile(tiles, layout.roomDoors.desk.gx, layout.roomDoors.desk.gy, "door");
  setTile(tiles, layout.roomDoors.meeting.gx, layout.roomDoors.meeting.gy, "door");
  setTile(tiles, layout.roomDoors.hotDesk.gx, layout.roomDoors.hotDesk.gy, "door");
  setTile(tiles, layout.roomDoors.lounge.gx, layout.roomDoors.lounge.gy, "door");

  buildFurniture(tiles, layout);

  return {
    width: layout.width,
    height: layout.height,
    tiles,
    pixelWidth: layout.width * TILE_SIZE,
    pixelHeight: layout.height * TILE_SIZE,
    roomRects: layout.roomRects,
    labelAnchors: layout.labelAnchors,
    entrance: layout.entrance,
  };
}

export function isWalkable(tile: TileType): boolean {
  return WALKABLE.has(tile);
}

export function getZoneAt(grid: OfficeGrid, gx: number, gy: number): MapZone {
  const tile = grid.tiles[gy]?.[gx];
  if (!tile) return "corridor";
  if (tile === "corridor" || tile === "door") return "corridor";
  if (tile === "floor_meeting" || tile === "chair" || tile === "table") return "meeting";
  if (tile === "floor_hotdesk") return "hotDesk";
  if (tile === "floor_lounge" || tile === "sofa" || tile === "machine" || tile === "plant") {
    const roomRectEntries = Object.entries(grid.roomRects) as Array<[Exclude<MapZone, "corridor">, TileRect]>;
    for (const [zone, rect] of roomRectEntries) {
      if (gx >= rect.left && gx <= rect.right && gy >= rect.top && gy <= rect.bottom) {
        if (zone === "desk") return "desk";
        if (zone === "meeting") return "meeting";
        if (zone === "hotDesk") return "hotDesk";
        return "lounge";
      }
    }
    return "lounge";
  }
  return "desk";
}

/** Get zone for furniture tiles — determines which floor to render underneath */
export function getFloorForFurniture(grid: OfficeGrid, gx: number, gy: number): FloorVariant {
  const zone = getZoneAt(grid, gx, gy);
  switch (zone) {
    case "meeting":
      return "meeting";
    case "hotDesk":
      return "hotdesk";
    case "lounge":
      return "lounge";
    default:
      return "office";
  }
}

export function getZoneAnchor(grid: OfficeGrid, zone: MapZone): { gx: number; gy: number } {
  const candidates: Array<{ gx: number; gy: number }> = [];

  for (let gy = 0; gy < grid.height; gy++) {
    for (let gx = 0; gx < grid.width; gx++) {
      if (!isWalkable(grid.tiles[gy][gx])) continue;
      if (getZoneAt(grid, gx, gy) === zone) {
        candidates.push({ gx, gy });
      }
    }
  }

  if (candidates.length === 0) {
    return { gx: Math.floor(grid.width / 2), gy: Math.floor(grid.height / 2) };
  }

  const avgX = candidates.reduce((sum, candidate) => sum + candidate.gx, 0) / candidates.length;
  const avgY = candidates.reduce((sum, candidate) => sum + candidate.gy, 0) / candidates.length;

  let best = candidates[0];
  let bestDist = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    const dist = (candidate.gx - avgX) ** 2 + (candidate.gy - avgY) ** 2;
    if (dist < bestDist) {
      best = candidate;
      bestDist = dist;
    }
  }

  return best;
}

export function getDeskPosition(grid: OfficeGrid, zone: MapZone, index: number): { gx: number; gy: number } {
  const desks: Array<{ gx: number; gy: number }> = [];

  for (let gy = 0; gy < grid.height; gy++) {
    for (let gx = 0; gx < grid.width; gx++) {
      if (grid.tiles[gy][gx] !== "desk") continue;
      const deskZone = getZoneAt(grid, gx, gy);
      const mappedZone = deskZone === "desk" ? "desk" : deskZone === "hotDesk" ? "hotDesk" : deskZone;
      if (mappedZone !== zone) continue;

      const neighbors = [
        { gx, gy: gy + 1 },
        { gx, gy: gy - 1 },
        { gx: gx + 1, gy },
        { gx: gx - 1, gy },
      ];
      for (const neighbor of neighbors) {
        if (neighbor.gx >= 0 && neighbor.gy >= 0 && neighbor.gx < grid.width && neighbor.gy < grid.height) {
          if (isWalkable(grid.tiles[neighbor.gy][neighbor.gx])) {
            desks.push(neighbor);
            break;
          }
        }
      }
    }
  }

  return desks[index % Math.max(desks.length, 1)] ?? getZoneAnchor(grid, zone);
}

export function getMeetingSeats(grid: OfficeGrid): Array<{ gx: number; gy: number }> {
  const tableTiles = new Set<string>();
  const seats: Array<{ gx: number; gy: number }> = [];

  for (let gy = 0; gy < grid.height; gy++) {
    for (let gx = 0; gx < grid.width; gx++) {
      if (grid.tiles[gy][gx] === "table") {
        tableTiles.add(`${gx},${gy}`);
      }
    }
  }

  const seen = new Set<string>();
  for (const key of tableTiles) {
    const [tx, ty] = key.split(",").map(Number);
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      const nx = tx + dx;
      const ny = ty + dy;
      const nextKey = `${nx},${ny}`;
      if (seen.has(nextKey) || tableTiles.has(nextKey)) continue;
      if (nx >= 0 && ny >= 0 && nx < grid.width && ny < grid.height && isWalkable(grid.tiles[ny][nx])) {
        seats.push({ gx: nx, gy: ny });
        seen.add(nextKey);
      }
    }
  }

  return seats;
}

export function gridToPixel(gx: number, gy: number): { x: number; y: number } {
  return { x: gx * TILE_SIZE + TILE_SIZE / 2, y: gy * TILE_SIZE + TILE_SIZE / 2 };
}

export function pixelToGrid(px: number, py: number): { gx: number; gy: number } {
  return { gx: Math.floor(px / TILE_SIZE), gy: Math.floor(py / TILE_SIZE) };
}
