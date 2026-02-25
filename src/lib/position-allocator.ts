import {
  ZONES,
  DESK_GRID_COLS,
  DESK_GRID_ROWS,
  DESK_MAX_AGENTS,
  HOT_DESK_GRID_COLS,
  HOT_DESK_GRID_ROWS,
} from "./constants";

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    hash = ((hash << 5) - hash + ch) | 0;
  }
  return Math.abs(hash);
}

function gridPositions(
  zone: { x: number; y: number; width: number; height: number },
  cols: number,
  rows: number,
): Array<{ x: number; y: number }> {
  const positions: Array<{ x: number; y: number }> = [];
  const cellW = zone.width / (cols + 1);
  const cellH = zone.height / (rows + 1);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      positions.push({
        x: Math.round(zone.x + cellW * (col + 1)),
        y: Math.round(zone.y + cellH * (row + 1)),
      });
    }
  }
  return positions;
}

const deskPositions = gridPositions(
  ZONES.desk,
  DESK_GRID_COLS,
  DESK_GRID_ROWS,
);
const hotDeskPositions = gridPositions(
  ZONES.hotDesk,
  HOT_DESK_GRID_COLS,
  HOT_DESK_GRID_ROWS,
);

function posKey(pos: { x: number; y: number }): string {
  return `${pos.x},${pos.y}`;
}

export function allocatePosition(
  agentId: string,
  isSubAgent: boolean,
  occupied: Set<string>,
): { x: number; y: number } {
  if (!isSubAgent) {
    const hash = hashString(agentId);
    const startIdx = hash % DESK_MAX_AGENTS;

    for (let i = 0; i < DESK_MAX_AGENTS; i++) {
      const idx = (startIdx + i) % DESK_MAX_AGENTS;
      const pos = deskPositions[idx];
      if (!occupied.has(posKey(pos))) {
        return pos;
      }
    }
  }

  // Fallback / SubAgent → Hot Desk Zone
  for (const pos of hotDeskPositions) {
    if (!occupied.has(posKey(pos))) {
      return pos;
    }
  }

  // All full — offset slightly from zone origin
  const fallbackZone = isSubAgent ? ZONES.hotDesk : ZONES.desk;
  return {
    x: fallbackZone.x + 30 + (hashString(agentId) % (fallbackZone.width - 60)),
    y: fallbackZone.y + 30 + (hashString(agentId) % (fallbackZone.height - 60)),
  };
}
