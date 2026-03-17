/**
 * Character sprite rendering for top-down Pixi office.
 * Each agent is a small top-down character with status indicators.
 */

import * as PIXI from "pixi.js";
import type { AgentVisualStatus } from "@/gateway/types";
import { gridToPixel } from "./office-map";

const BODY_RADIUS = 11;
const HEAD_RADIUS = 7;

const STATUS_COLORS: Record<AgentVisualStatus, number> = {
  active: 0x3b82f6,
  idle: 0x6b7280,
  error: 0xef4444,
};

const AGENT_PALETTES: Record<string, { body: number; shirt: number; accent: number }> = {
  main: { body: 0x3b82f6, shirt: 0x2563eb, accent: 0x60a5fa },     // Jarvis — blue
  friday: { body: 0xec4899, shirt: 0xdb2777, accent: 0xf9a8d4 },   // Friday — pink
};

const DEFAULT_PALETTE = { body: 0x64748b, shirt: 0x475569, accent: 0x94a3b8 };

export interface CharacterState {
  agentId: string;
  name: string;
  status: AgentVisualStatus;
  currentTool: string | null;
  isSubAgent: boolean;
  confidence: number;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  path: Array<{ gx: number; gy: number }>;
  pathIndex: number;
  speed: number;
  moving: boolean;
  walkPhase: number;
  facing: number;
  /** Accumulator for status ring pulse animation */
  pulsePhase: number;
}

export function createCharacterState(
  agentId: string,
  name: string,
  gx: number,
  gy: number,
): CharacterState {
  const pos = gridToPixel(gx, gy);
  return {
    agentId,
    name,
    status: "idle",
    currentTool: null,
    isSubAgent: false,
    confidence: 1,
    x: pos.x,
    y: pos.y,
    targetX: pos.x,
    targetY: pos.y,
    path: [],
    pathIndex: 0,
    speed: 80,
    moving: false,
    walkPhase: 0,
    facing: Math.PI / 2,
    pulsePhase: 0,
  };
}

export function createCharacterContainer(state: CharacterState): PIXI.Container {
  const container = new PIXI.Container();
  container.sortableChildren = true;

  // Shadow
  const shadow = new PIXI.Graphics();
  shadow.name = "shadow";
  shadow.zIndex = 0;
  container.addChild(shadow);

  // Status glow ring (rendered behind body)
  const glow = new PIXI.Graphics();
  glow.name = "glow";
  glow.zIndex = 1;
  container.addChild(glow);

  // Body
  const body = new PIXI.Graphics();
  body.name = "body";
  body.zIndex = 2;
  container.addChild(body);

  // Head
  const head = new PIXI.Graphics();
  head.name = "head";
  head.zIndex = 3;
  container.addChild(head);

  // Direction indicator
  const dir = new PIXI.Graphics();
  dir.name = "direction";
  dir.zIndex = 4;
  container.addChild(dir);

  // Name label background
  const labelBg = new PIXI.Graphics();
  labelBg.name = "labelBg";
  labelBg.zIndex = 9;
  container.addChild(labelBg);

  // Name label
  const label = new PIXI.Text(state.name, {
    fontFamily: "system-ui, -apple-system, sans-serif",
    fontSize: 9,
    fontWeight: "600",
    fill: 0xffffff,
    letterSpacing: 0.3,
  });
  label.name = "label";
  label.anchor.set(0.5, 0);
  label.y = BODY_RADIUS + 6;
  label.zIndex = 10;
  container.addChild(label);

  // Status bubble background
  const bubbleBg = new PIXI.Graphics();
  bubbleBg.name = "bubbleBg";
  bubbleBg.zIndex = 11;
  container.addChild(bubbleBg);

  // Status bubble text
  const bubbleText = new PIXI.Text("", {
    fontFamily: "system-ui, -apple-system, sans-serif",
    fontSize: 8,
    fontWeight: "500",
    fill: 0xffffff,
  });
  bubbleText.name = "bubbleText";
  bubbleText.anchor.set(0.5, 1);
  bubbleText.y = -(BODY_RADIUS + HEAD_RADIUS + 6);
  bubbleText.zIndex = 12;
  container.addChild(bubbleText);

  container.x = state.x;
  container.y = state.y;
  container.eventMode = "static";
  container.cursor = "pointer";

  // Initial draw
  drawAll(container, state);

  return container;
}

function drawAll(container: PIXI.Container, state: CharacterState): void {
  const pal = AGENT_PALETTES[state.agentId] ?? DEFAULT_PALETTE;
  const statusColor = STATUS_COLORS[state.status] ?? 0x6b7280;
  const isActive = state.status === "active";

  // Shadow
  const shadow = container.getChildByName("shadow") as PIXI.Graphics;
  shadow.clear();
  shadow.beginFill(0x000000, 0.15);
  shadow.drawEllipse(0, 5, BODY_RADIUS * 0.85, BODY_RADIUS * 0.35);
  shadow.endFill();

  // Glow ring
  const glow = container.getChildByName("glow") as PIXI.Graphics;
  glow.clear();
  if (isActive) {
    const pulse = 0.5 + Math.sin(state.pulsePhase) * 0.3;
    glow.beginFill(statusColor, pulse * 0.25);
    glow.drawCircle(0, -2, BODY_RADIUS + 6);
    glow.endFill();
  }
  glow.lineStyle(isActive ? 2 : 1.5, statusColor, isActive ? 0.9 : 0.5);
  if (state.status === "error") {
    // Dashed ring
    const r = BODY_RADIUS + 4;
    const segs = 10;
    for (let i = 0; i < segs; i++) {
      if (i % 2 === 0) {
        const a0 = (i / segs) * Math.PI * 2;
        const a1 = ((i + 0.7) / segs) * Math.PI * 2;
        glow.arc(0, -2, r, a0, a1);
        glow.moveTo(0, 0); // break path
      }
    }
  } else {
    glow.drawCircle(0, -2, BODY_RADIUS + 4);
  }
  glow.lineStyle(0);

  // Body (torso, viewed from above — oval)
  const body = container.getChildByName("body") as PIXI.Graphics;
  body.clear();
  body.beginFill(pal.shirt);
  body.drawEllipse(0, 0, BODY_RADIUS, BODY_RADIUS * 0.8);
  body.endFill();
  // Shoulders / shirt detail
  body.beginFill(pal.body, 0.5);
  body.drawEllipse(0, -1, BODY_RADIUS - 2, BODY_RADIUS * 0.6);
  body.endFill();

  // Head
  const head = container.getChildByName("head") as PIXI.Graphics;
  head.clear();
  // Head circle with hair color
  const skinColor = 0xfdbcb4;
  head.beginFill(skinColor);
  head.drawCircle(0, -(BODY_RADIUS * 0.4), HEAD_RADIUS);
  head.endFill();
  // Hair (top half of head)
  const hairColor = state.agentId === "friday" ? 0x8b4513 : 0x2d2d2d;
  head.beginFill(hairColor);
  head.drawEllipse(0, -(BODY_RADIUS * 0.4) - 2, HEAD_RADIUS, HEAD_RADIUS * 0.65);
  head.endFill();

  // Facing direction dot (small dot at edge of body showing which way they face)
  const dir = container.getChildByName("direction") as PIXI.Graphics;
  dir.clear();
  const fx = Math.cos(state.facing) * (BODY_RADIUS + 2);
  const fy = Math.sin(state.facing) * (BODY_RADIUS * 0.8 + 2);
  dir.beginFill(pal.accent, 0.7);
  dir.drawCircle(fx, fy, 2.5);
  dir.endFill();

  // Label
  const label = container.getChildByName("label") as PIXI.Text;
  const labelBg = container.getChildByName("labelBg") as PIXI.Graphics;
  if (label && labelBg) {
    label.text = state.name;
    labelBg.clear();
    const w = label.width + 8;
    const h = label.height + 3;
    labelBg.beginFill(pal.shirt, 0.9);
    labelBg.drawRoundedRect(-w / 2, BODY_RADIUS + 5, w, h, 3);
    labelBg.endFill();
  }

  // Status bubble
  const bubbleText = container.getChildByName("bubbleText") as PIXI.Text;
  const bubbleBg = container.getChildByName("bubbleBg") as PIXI.Graphics;
  if (bubbleText && bubbleBg) {
    let text = "";
    let color = 0x000000;

    if (state.status === "active" && state.currentTool) {
      text = `⚡ ${friendlyTool(state.currentTool)}`;
      color = 0x1d4ed8;
    } else if (state.status === "error") {
      text = "⚠ error";
      color = 0xb91c1c;
    }

    bubbleText.text = text;
    bubbleBg.clear();

    if (text) {
      const bw = Math.max(bubbleText.width + 12, 28);
      const bh = bubbleText.height + 6;
      const by = -(BODY_RADIUS + HEAD_RADIUS + 6 + bh);
      bubbleBg.beginFill(color, 0.9);
      bubbleBg.drawRoundedRect(-bw / 2, by, bw, bh, 4);
      bubbleBg.endFill();
      // Arrow
      bubbleBg.beginFill(color, 0.9);
      bubbleBg.moveTo(-3, by + bh);
      bubbleBg.lineTo(3, by + bh);
      bubbleBg.lineTo(0, by + bh + 4);
      bubbleBg.closePath();
      bubbleBg.endFill();
    }
  }

  // Confidence — lower confidence = more transparent
  container.alpha = state.confidence < 0.3 ? 0.4 : state.confidence < 0.6 ? 0.7 : 1;
}

function friendlyTool(tool: string): string {
  const map: Record<string, string> = {
    Read: "reading",
    Write: "writing",
    Edit: "editing",
    exec: "running cmd",
    web_search: "searching",
    web_fetch: "fetching",
    memory_search: "remembering",
    sessions_spawn: "starting subagent",
    sessions_send: "messaging",
    image: "viewing",
  };
  for (const [k, v] of Object.entries(map)) {
    if (tool.startsWith(k)) return v;
  }
  return tool.length > 14 ? tool.slice(0, 14) + "…" : tool;
}

/**
 * Update character visuals — called each frame.
 */
export function updateCharacterVisuals(container: PIXI.Container, state: CharacterState, dt: number): void {
  state.pulsePhase += dt * 3;

  // Walk animation
  if (state.moving) {
    const bob = Math.sin(state.walkPhase * Math.PI * 2) * 2;
    const body = container.getChildByName("body") as PIXI.Graphics;
    const head = container.getChildByName("head") as PIXI.Graphics;
    const shadow = container.getChildByName("shadow") as PIXI.Graphics;
    if (body) body.y = -Math.abs(bob);
    if (head) head.y = -Math.abs(bob);
    if (shadow) shadow.scale.set(1 - Math.abs(bob) * 0.015, 1);
  } else {
    // Idle breathing
    const breath = Math.sin(Date.now() / 2000) * 0.6;
    const body = container.getChildByName("body") as PIXI.Graphics;
    const head = container.getChildByName("head") as PIXI.Graphics;
    if (body) body.y = breath;
    if (head) head.y = breath;
  }

  // Redraw to pick up state changes (only when needed in practice,
  // but for now we redraw every frame — cheap at this scale)
  drawAll(container, state);
}

/**
 * Tick movement along path. Returns true if still moving.
 */
export function tickCharacterMovement(state: CharacterState, delta: number): boolean {
  if (!state.moving || state.path.length === 0) return false;

  const target = gridToPixel(state.path[state.pathIndex].gx, state.path[state.pathIndex].gy);
  const dx = target.x - state.x;
  const dy = target.y - state.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist < 2) {
    state.x = target.x;
    state.y = target.y;
    state.pathIndex++;

    if (state.pathIndex >= state.path.length) {
      state.moving = false;
      state.path = [];
      state.pathIndex = 0;
      return false;
    }

    const next = gridToPixel(state.path[state.pathIndex].gx, state.path[state.pathIndex].gy);
    state.facing = Math.atan2(next.y - state.y, next.x - state.x);
    return true;
  }

  const moveAmount = state.speed * delta;
  const ratio = Math.min(moveAmount / dist, 1);
  state.x += dx * ratio;
  state.y += dy * ratio;
  state.facing = Math.atan2(dy, dx);
  state.walkPhase += delta * 4;

  return true;
}
