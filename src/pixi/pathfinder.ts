/**
 * Simple A* pathfinding on the office grid.
 * 8-directional movement, diagonal cost √2.
 */

import type { OfficeGrid } from "./office-map";
import { isWalkable } from "./office-map";

interface Node {
  gx: number;
  gy: number;
  g: number;
  h: number;
  f: number;
  parent: Node | null;
}

const DIRS = [
  { dx: 0, dy: -1, cost: 1 },    // N
  { dx: 1, dy: -1, cost: 1.414 }, // NE
  { dx: 1, dy: 0, cost: 1 },     // E
  { dx: 1, dy: 1, cost: 1.414 },  // SE
  { dx: 0, dy: 1, cost: 1 },     // S
  { dx: -1, dy: 1, cost: 1.414 }, // SW
  { dx: -1, dy: 0, cost: 1 },    // W
  { dx: -1, dy: -1, cost: 1.414 },// NW
];

function heuristic(ax: number, ay: number, bx: number, by: number): number {
  // Octile distance
  const dx = Math.abs(ax - bx);
  const dy = Math.abs(ay - by);
  return Math.max(dx, dy) + 0.414 * Math.min(dx, dy);
}

function key(gx: number, gy: number): number {
  return gy * 10000 + gx;
}

/**
 * Find a path from start to end on the grid.
 * Returns array of grid coordinates, or empty if no path.
 */
export function findPath(
  grid: OfficeGrid,
  startGx: number,
  startGy: number,
  endGx: number,
  endGy: number,
): Array<{ gx: number; gy: number }> {
  // Clamp to bounds
  const sx = Math.max(0, Math.min(startGx, grid.width - 1));
  const sy = Math.max(0, Math.min(startGy, grid.height - 1));
  const ex = Math.max(0, Math.min(endGx, grid.width - 1));
  const ey = Math.max(0, Math.min(endGy, grid.height - 1));

  if (sx === ex && sy === ey) return [{ gx: sx, gy: sy }];

  // If destination not walkable, find nearest walkable
  let targetX = ex;
  let targetY = ey;
  if (!isWalkable(grid.tiles[ey]?.[ex] ?? "void")) {
    const nearest = findNearestWalkable(grid, ex, ey);
    if (!nearest) return [];
    targetX = nearest.gx;
    targetY = nearest.gy;
  }

  const open: Node[] = [];
  const closed = new Set<number>();

  const startNode: Node = {
    gx: sx,
    gy: sy,
    g: 0,
    h: heuristic(sx, sy, targetX, targetY),
    f: heuristic(sx, sy, targetX, targetY),
    parent: null,
  };
  open.push(startNode);

  const gScores = new Map<number, number>();
  gScores.set(key(sx, sy), 0);

  let iterations = 0;
  const maxIterations = grid.width * grid.height * 2;

  while (open.length > 0 && iterations++ < maxIterations) {
    // Find lowest f in open (simple linear scan, fine for small grids)
    let bestIdx = 0;
    for (let i = 1; i < open.length; i++) {
      if (open[i].f < open[bestIdx].f) bestIdx = i;
    }
    const current = open.splice(bestIdx, 1)[0];
    const ck = key(current.gx, current.gy);

    if (current.gx === targetX && current.gy === targetY) {
      return reconstructPath(current);
    }

    closed.add(ck);

    for (const dir of DIRS) {
      const nx = current.gx + dir.dx;
      const ny = current.gy + dir.dy;

      if (nx < 0 || ny < 0 || nx >= grid.width || ny >= grid.height) continue;
      if (!isWalkable(grid.tiles[ny][nx])) continue;
      if (closed.has(key(nx, ny))) continue;

      // For diagonal moves, check that both cardinal neighbors are walkable (no corner cutting)
      if (dir.dx !== 0 && dir.dy !== 0) {
        if (!isWalkable(grid.tiles[current.gy][nx]) || !isWalkable(grid.tiles[ny][current.gx])) {
          continue;
        }
      }

      const tentativeG = current.g + dir.cost;
      const nk = key(nx, ny);
      const prevG = gScores.get(nk);

      if (prevG !== undefined && tentativeG >= prevG) continue;

      gScores.set(nk, tentativeG);
      const h = heuristic(nx, ny, targetX, targetY);
      const node: Node = {
        gx: nx,
        gy: ny,
        g: tentativeG,
        h,
        f: tentativeG + h,
        parent: current,
      };

      // Remove existing open node for this position if we found a better path
      const existingIdx = open.findIndex((n) => n.gx === nx && n.gy === ny);
      if (existingIdx >= 0) open.splice(existingIdx, 1);
      open.push(node);
    }
  }

  return []; // No path found
}

function reconstructPath(node: Node): Array<{ gx: number; gy: number }> {
  const path: Array<{ gx: number; gy: number }> = [];
  let current: Node | null = node;
  while (current) {
    path.unshift({ gx: current.gx, gy: current.gy });
    current = current.parent;
  }
  return path;
}

function findNearestWalkable(grid: OfficeGrid, gx: number, gy: number): { gx: number; gy: number } | null {
  for (let r = 1; r < 20; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
        const nx = gx + dx;
        const ny = gy + dy;
        if (nx >= 0 && ny >= 0 && nx < grid.width && ny < grid.height) {
          if (isWalkable(grid.tiles[ny][nx])) return { gx: nx, gy: ny };
        }
      }
    }
  }
  return null;
}

/**
 * Smooth a grid path by removing unnecessary intermediate waypoints.
 * Uses line-of-sight checks to create more natural movement.
 */
export function smoothPath(
  grid: OfficeGrid,
  path: Array<{ gx: number; gy: number }>,
): Array<{ gx: number; gy: number }> {
  if (path.length <= 2) return path;

  const smoothed: Array<{ gx: number; gy: number }> = [path[0]];
  let current = 0;

  while (current < path.length - 1) {
    let furthest = current + 1;
    for (let i = path.length - 1; i > current + 1; i--) {
      if (hasLineOfSight(grid, path[current], path[i])) {
        furthest = i;
        break;
      }
    }
    smoothed.push(path[furthest]);
    current = furthest;
  }

  return smoothed;
}

function hasLineOfSight(
  grid: OfficeGrid,
  a: { gx: number; gy: number },
  b: { gx: number; gy: number },
): boolean {
  // Bresenham-style line walk
  const dx = Math.abs(b.gx - a.gx);
  const dy = Math.abs(b.gy - a.gy);
  const sx = a.gx < b.gx ? 1 : -1;
  const sy = a.gy < b.gy ? 1 : -1;
  let err = dx - dy;
  let x = a.gx;
  let y = a.gy;

  while (x !== b.gx || y !== b.gy) {
    if (!isWalkable(grid.tiles[y]?.[x] ?? "void")) return false;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x += sx; }
    if (e2 < dx) { err += dx; y += sy; }
  }

  return true;
}
