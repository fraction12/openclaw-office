/**
 * Pixi.js renderer for the top-down office.
 * Renders tilemap, furniture with recognizable shapes, zone labels.
 */

import * as PIXI from "pixi.js";
import type { OfficeGrid, TileType, FloorVariant } from "./office-map";
import { TILE_SIZE, getFloorForFurniture } from "./office-map";
import { getZoneLabel } from "@/lib/constants";

// ──────────────── Light palette ────────────────

const L = {
  void: 0x1a1a2e,
  wall: 0x4a4e6d,
  wallAccent: 0x5a5f80,

  // Per-zone floors
  floorOffice:    0xf2ece0,
  floorOfficeAlt: 0xeae4d8,
  floorMeeting:   0xe8eef6,
  floorMeetingAlt:0xe0e6ee,
  floorHotdesk:   0xf0f0e0,
  floorHotdeskAlt:0xe8e8d8,
  floorLounge:    0xf5ede5,
  floorLoungeAlt: 0xede5dd,

  corridor:       0xd8d2c6,
  corridorLine:   0xccc6ba,

  // Furniture
  deskBody:  0x6b5540,
  deskTop:   0x8b7555,
  monitor:   0x2d3748,
  monitorGlow: 0x63b3ed,
  chairSeat: 0x4a5568,
  chairBack: 0x2d3748,
  tableBody: 0x6b5540,
  tableTop:  0x9b8565,
  sofaBody:  0x5b51b5,
  sofaCushion:0x7b6fdf,
  sofaArm:   0x4a41a0,
  plantPot:  0x8b6b4a,
  plantLeaf: 0x38a169,
  plantLeafDark: 0x2d8555,
  machineBody: 0x718096,
  machineFront: 0x4a5568,
  machineLed:  0x48bb78,
};

const D = {
  void: 0x12121f,
  wall: 0x3a3d55,
  wallAccent: 0x4a4d65,

  floorOffice:    0x252940,
  floorOfficeAlt: 0x212538,
  floorMeeting:   0x222842,
  floorMeetingAlt:0x1e2438,
  floorHotdesk:   0x252935,
  floorHotdeskAlt:0x21252f,
  floorLounge:    0x2a2835,
  floorLoungeAlt: 0x262430,

  corridor:       0x1c2035,
  corridorLine:   0x252940,

  deskBody:  0x5a4830,
  deskTop:   0x6b5940,
  monitor:   0x252d3e,
  monitorGlow: 0x4a9ae8,
  chairSeat: 0x3d4555,
  chairBack: 0x2a3245,
  tableBody: 0x5a4830,
  tableTop:  0x7a6848,
  sofaBody:  0x4a4290,
  sofaCushion:0x5a52a8,
  sofaArm:   0x3a3280,
  plantPot:  0x6b5838,
  plantLeaf: 0x2a7545,
  plantLeafDark: 0x1f5a35,
  machineBody: 0x4a5268,
  machineFront: 0x3a4255,
  machineLed:  0x48cc78,
};

type Pal = typeof L;

function floorColor(variant: FloorVariant, gx: number, gy: number, pal: Pal): number {
  const alt = (gx + gy) % 2 === 0;
  switch (variant) {
    case "office":  return alt ? pal.floorOffice  : pal.floorOfficeAlt;
    case "meeting": return alt ? pal.floorMeeting : pal.floorMeetingAlt;
    case "hotdesk": return alt ? pal.floorHotdesk : pal.floorHotdeskAlt;
    case "lounge":  return alt ? pal.floorLounge  : pal.floorLoungeAlt;
  }
}

// ──────────────── Map building ────────────────

export function createMapGraphics(grid: OfficeGrid, isDark: boolean): PIXI.Container {
  const container = new PIXI.Container();
  const pal = isDark ? D : L;
  const T = TILE_SIZE;

  // Background fill
  const bg = new PIXI.Graphics();
  bg.beginFill(pal.void);
  bg.drawRect(0, 0, grid.pixelWidth, grid.pixelHeight);
  bg.endFill();
  container.addChild(bg);

  // ── Tile layer (floors, walls, corridor) ──
  const tileGfx = new PIXI.Graphics();
  for (let gy = 0; gy < grid.height; gy++) {
    for (let gx = 0; gx < grid.width; gx++) {
      const tile = grid.tiles[gy][gx];
      const px = gx * T;
      const py = gy * T;

      switch (tile) {
        case "void":
          break;

        case "wall":
          tileGfx.beginFill(pal.wall);
          tileGfx.drawRect(px, py, T, T);
          tileGfx.endFill();
          // Top accent line
          tileGfx.beginFill(pal.wallAccent);
          tileGfx.drawRect(px, py, T, 3);
          tileGfx.endFill();
          break;

        case "floor_office":
        case "floor_meeting":
        case "floor_hotdesk":
        case "floor_lounge": {
          const variant = tile.replace("floor_", "") as FloorVariant;
          tileGfx.beginFill(floorColor(variant, gx, gy, pal));
          tileGfx.drawRect(px, py, T, T);
          tileGfx.endFill();
          break;
        }

        case "corridor":
          tileGfx.beginFill(pal.corridor);
          tileGfx.drawRect(px, py, T, T);
          tileGfx.endFill();
          tileGfx.lineStyle(0.5, pal.corridorLine, 0.4);
          tileGfx.drawRect(px + 0.5, py + 0.5, T - 1, T - 1);
          tileGfx.lineStyle(0);
          break;

        case "door":
          tileGfx.beginFill(pal.corridor);
          tileGfx.drawRect(px, py, T, T);
          tileGfx.endFill();
          // Threshold accent
          tileGfx.beginFill(pal.corridorLine, 0.5);
          tileGfx.drawRect(px, py, T, 2);
          tileGfx.drawRect(px, py + T - 2, T, 2);
          tileGfx.endFill();
          break;

        // Furniture tiles get their zone's floor underneath
        default: {
          const fv = getFloorForFurniture(grid, gx, gy);
          tileGfx.beginFill(floorColor(fv, gx, gy, pal));
          tileGfx.drawRect(px, py, T, T);
          tileGfx.endFill();
          break;
        }
      }
    }
  }
  container.addChild(tileGfx);

  // ── Furniture layer ──
  const furnitureGfx = new PIXI.Graphics();
  for (let gy = 0; gy < grid.height; gy++) {
    for (let gx = 0; gx < grid.width; gx++) {
      const tile = grid.tiles[gy][gx];
      const px = gx * T;
      const py = gy * T;
      drawFurniture(furnitureGfx, tile, px, py, T, pal);
    }
  }
  container.addChild(furnitureGfx);

  return container;
}

function drawFurniture(g: PIXI.Graphics, tile: TileType, px: number, py: number, T: number, pal: Pal): void {
  const cx = px + T / 2;
  const cy = py + T / 2;

  switch (tile) {
    case "desk": {
      // Desk body (L-shaped from above)
      const m = 4;
      // Shadow
      g.beginFill(0x000000, 0.12);
      g.drawRoundedRect(px + m + 1, py + m + 1, T - m * 2, T - m * 2, 2);
      g.endFill();
      // Wood body
      g.beginFill(pal.deskBody);
      g.drawRoundedRect(px + m, py + m, T - m * 2, T - m * 2, 2);
      g.endFill();
      // Surface
      g.beginFill(pal.deskTop);
      g.drawRoundedRect(px + m + 2, py + m + 2, T - m * 2 - 4, T - m * 2 - 4, 1);
      g.endFill();
      // Monitor (small rectangle)
      const mw = 10;
      const mh = 7;
      g.beginFill(pal.monitor);
      g.drawRoundedRect(cx - mw / 2, py + m + 3, mw, mh, 1);
      g.endFill();
      // Monitor screen glow
      g.beginFill(pal.monitorGlow, 0.5);
      g.drawRect(cx - mw / 2 + 1, py + m + 4, mw - 2, mh - 2);
      g.endFill();
      // Monitor stand
      g.beginFill(pal.monitor);
      g.drawRect(cx - 1, py + m + 3 + mh, 2, 3);
      g.endFill();
      break;
    }

    case "chair": {
      // Office chair from above — circle seat + backrest arc
      g.beginFill(0x000000, 0.1);
      g.drawCircle(cx + 1, cy + 1, 8);
      g.endFill();
      g.beginFill(pal.chairSeat);
      g.drawCircle(cx, cy, 8);
      g.endFill();
      // Backrest (thick arc at top)
      g.beginFill(pal.chairBack);
      g.drawRoundedRect(cx - 6, cy - 9, 12, 5, 3);
      g.endFill();
      // Armrests
      g.beginFill(pal.chairBack, 0.7);
      g.drawRoundedRect(cx - 9, cy - 3, 3, 8, 1);
      g.drawRoundedRect(cx + 6, cy - 3, 3, 8, 1);
      g.endFill();
      break;
    }

    case "table": {
      // Large meeting table — rounded rectangle with wood grain lines
      const m = 2;
      g.beginFill(0x000000, 0.1);
      g.drawRoundedRect(px + m + 1, py + m + 1, T - m * 2, T - m * 2, 4);
      g.endFill();
      g.beginFill(pal.tableBody);
      g.drawRoundedRect(px + m, py + m, T - m * 2, T - m * 2, 4);
      g.endFill();
      g.beginFill(pal.tableTop);
      g.drawRoundedRect(px + m + 2, py + m + 2, T - m * 2 - 4, T - m * 2 - 4, 3);
      g.endFill();
      // Subtle grain lines
      g.lineStyle(0.5, pal.tableBody, 0.3);
      for (let i = 1; i <= 3; i++) {
        const ly = py + m + 2 + i * ((T - m * 2 - 4) / 4);
        g.moveTo(px + m + 4, ly);
        g.lineTo(px + T - m - 4, ly);
      }
      g.lineStyle(0);
      break;
    }

    case "sofa": {
      // Sofa from above — rectangular with rounded cushions and arms
      const m = 3;
      // Shadow
      g.beginFill(0x000000, 0.12);
      g.drawRoundedRect(px + m + 1, py + m + 1, T - m * 2, T - m * 2, 5);
      g.endFill();
      // Body
      g.beginFill(pal.sofaBody);
      g.drawRoundedRect(px + m, py + m, T - m * 2, T - m * 2, 5);
      g.endFill();
      // Arms (left + right)
      g.beginFill(pal.sofaArm);
      g.drawRoundedRect(px + m, py + m, 5, T - m * 2, 3);
      g.drawRoundedRect(px + T - m - 5, py + m, 5, T - m * 2, 3);
      g.endFill();
      // Cushions
      const cushW = (T - m * 2 - 14) / 2;
      g.beginFill(pal.sofaCushion);
      g.drawRoundedRect(px + m + 6, py + m + 3, cushW, T - m * 2 - 6, 3);
      g.drawRoundedRect(px + m + 7 + cushW, py + m + 3, cushW, T - m * 2 - 6, 3);
      g.endFill();
      break;
    }

    case "plant": {
      // Potted plant from above — round pot with leaf clusters
      // Pot
      g.beginFill(0x000000, 0.1);
      g.drawCircle(cx + 1, cy + 3, 6);
      g.endFill();
      g.beginFill(pal.plantPot);
      g.drawCircle(cx, cy + 2, 6);
      g.endFill();
      // Pot rim
      g.lineStyle(1, pal.plantPot, 0.7);
      g.drawCircle(cx, cy + 2, 7);
      g.lineStyle(0);
      // Leaves — overlapping ovals
      g.beginFill(pal.plantLeafDark);
      g.drawEllipse(cx - 4, cy - 3, 6, 4);
      g.drawEllipse(cx + 4, cy - 2, 5, 4);
      g.endFill();
      g.beginFill(pal.plantLeaf);
      g.drawEllipse(cx, cy - 5, 7, 5);
      g.drawEllipse(cx - 3, cy - 1, 5, 3);
      g.drawEllipse(cx + 3, cy - 1, 5, 3);
      g.endFill();
      break;
    }

    case "machine": {
      // Coffee machine — boxy with indicator
      const m = 5;
      g.beginFill(0x000000, 0.1);
      g.drawRoundedRect(px + m + 1, py + m + 1, T - m * 2, T - m * 2, 3);
      g.endFill();
      g.beginFill(pal.machineBody);
      g.drawRoundedRect(px + m, py + m, T - m * 2, T - m * 2, 3);
      g.endFill();
      // Front panel
      g.beginFill(pal.machineFront);
      g.drawRoundedRect(px + m + 2, py + m + 2, T - m * 2 - 4, (T - m * 2) * 0.5, 2);
      g.endFill();
      // LED indicator
      g.beginFill(pal.machineLed);
      g.drawCircle(cx + 5, py + m + 4, 2);
      g.endFill();
      // Coffee cup hint
      g.beginFill(0xffffff, 0.2);
      g.drawRoundedRect(cx - 3, cy + 2, 6, 5, 1);
      g.endFill();
      break;
    }
  }
}

/** Zone label overlays */
export function createZoneLabels(grid: OfficeGrid, isDark: boolean): PIXI.Container {
  const container = new PIXI.Container();
  const color = isDark ? 0x525b6e : 0x8895a8;

  const labels = [
    { text: getZoneLabel("desk").toUpperCase(), ...grid.labelAnchors.desk },
    { text: getZoneLabel("meeting").toUpperCase(), ...grid.labelAnchors.meeting },
    { text: getZoneLabel("hotDesk").toUpperCase(), ...grid.labelAnchors.hotDesk },
    { text: getZoneLabel("lounge").toUpperCase(), ...grid.labelAnchors.lounge },
  ];

  for (const l of labels) {
    const text = new PIXI.Text(l.text, {
      fontFamily: "system-ui, -apple-system, sans-serif",
      fontSize: 9,
      fontWeight: "700",
      fill: color,
      letterSpacing: 2,
    });
    text.anchor.set(0.5, 0.5);
    text.x = l.gx * TILE_SIZE + TILE_SIZE / 2;
    text.y = l.gy * TILE_SIZE + TILE_SIZE / 2;
    text.alpha = 0.5;
    container.addChild(text);
  }

  return container;
}
