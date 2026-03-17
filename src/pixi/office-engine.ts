/**
 * Office Engine — manages the Pixi app, map, characters, and state sync.
 *
 * Architecture: The engine subscribes to the Zustand store directly via
 * useOfficeStore.subscribe(). React only handles mount/unmount/resize.
 * Movement is store-driven: the Zustand store owns semantic movement state
 * and Pixi projects that canonical state into the compact office map.
 *
 * Lifecycle:
 *  - Active characters follow projected canonical store positions
 *  - When removed from the store, agents walk to the exit before being destroyed
 */

import * as PIXI from "pixi.js";
import type { VisualAgent } from "@/gateway/types";
import { useOfficeStore } from "@/store";
import {
  parseMap,
  gridToPixel,
  pixelToGrid,
  type OfficeGrid,
} from "./office-map";
import { createMapGraphics, createZoneLabels } from "./office-renderer";
import {
  createCharacterState,
  createCharacterContainer,
  updateCharacterVisuals,
  tickCharacterMovement,
  type CharacterState,
} from "./character-sprite";
import { findPath, smoothPath } from "./pathfinder";
import { getAgentDisplayName } from "@/lib/agent-identities";
import { projectVisualAgentPosition } from "./store-position-projection";

/** Corridor entrance — where sub-agents enter/exit */
const ENTRANCE_GRID = { gx: 14, gy: 9 }; // Center of cross corridor

export class OfficeEngine {
  app: PIXI.Application;
  grid: OfficeGrid;
  private mapContainer: PIXI.Container | null = null;
  private characterLayer: PIXI.Container;
  private characters: Map<string, { state: CharacterState; container: PIXI.Container }> = new Map();
  private isDark: boolean;
  private onAgentClick: ((agentId: string) => void) | null = null;

  /** Agents walking to exit before removal */
  private departing: Map<string, { state: CharacterState; container: PIXI.Container }> = new Map();

  /** IDs known to the store — used for departure detection */
  private knownAgentIds: Set<string> = new Set();

  /** Store subscription teardown */
  private unsubscribe: (() => void) | null = null;

  constructor(isDark = false) {
    this.isDark = isDark;
    this.grid = parseMap();
    this.app = new PIXI.Application({
      width: this.grid.pixelWidth,
      height: this.grid.pixelHeight,
      backgroundColor: isDark ? 0x12121f : 0x1a1a2e,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });

    this.characterLayer = new PIXI.Container();
    this.characterLayer.sortableChildren = true;

    // Build map + meeting seats
    this.rebuildMap();

    // Add character layer on top
    this.app.stage.addChild(this.characterLayer);

    // Subscribe to store — this is the bridge, not React useEffect
    this.subscribeToStore();

    // Initial sync from current state
    this.syncAgents(useOfficeStore.getState().agents);

    // Game loop
    this.app.ticker.add(this.tick.bind(this));

    if (import.meta.env.DEV) {
      console.log("[PixiEngine] Created. Grid:", this.grid.pixelWidth, "x", this.grid.pixelHeight);
      console.log("[PixiEngine] Stage children:", this.app.stage.children.length);
      console.log("[PixiEngine] Map container children:", this.mapContainer?.children.length);
    }
  }

  get view(): HTMLCanvasElement {
    return this.app.view as HTMLCanvasElement;
  }

  setOnAgentClick(cb: (agentId: string) => void): void {
    this.onAgentClick = cb;
  }

  setTheme(isDark: boolean): void {
    if (this.isDark === isDark) return;
    this.isDark = isDark;
    this.rebuildMap();
    this.app.renderer.background.color = isDark ? 0x12121f : 0x1a1a2e;
  }

  // ── Store subscription ──────────────────────────────────────────────

  private subscribeToStore(): void {
    this.unsubscribe = useOfficeStore.subscribe((state) => {
      this.syncAgents(state.agents);
      this.setTheme(state.theme === "dark");
    });
  }

  // ── Map ─────────────────────────────────────────────────────────────

  private rebuildMap(): void {
    if (this.mapContainer) {
      this.app.stage.removeChild(this.mapContainer);
      this.mapContainer.destroy({ children: true });
    }
    this.mapContainer = new PIXI.Container();
    this.mapContainer.addChild(createMapGraphics(this.grid, this.isDark));
    this.mapContainer.addChild(createZoneLabels(this.grid, this.isDark));
    this.app.stage.addChildAt(this.mapContainer, 0);
  }

  // ── Agent sync ──────────────────────────────────────────────────────

  private syncAgents(agents: Map<string, VisualAgent>): void {
    // Collect current store IDs (excluding placeholders)
    const currentIds = new Set<string>();
    for (const [id, agent] of agents) {
      if (!agent.isPlaceholder) currentIds.add(id);
    }

    // Detect departures: was known, no longer in store, not already departing
    for (const id of this.knownAgentIds) {
      if (!currentIds.has(id) && !this.departing.has(id)) {
        const char = this.characters.get(id);
        if (char) {
          this.beginDeparture(id, char);
        }
      }
    }

    // Update known set
    this.knownAgentIds = currentIds;

    if (import.meta.env.DEV && currentIds.size > 0 && this.characters.size === 0) {
      console.log("[PixiEngine] Agent sync:", currentIds.size, "agents, creating characters");
    }

    // Add/update characters
    for (const [id, agent] of agents) {
      if (agent.isPlaceholder) continue;

      const projected = projectVisualAgentPosition(this.grid, agent);

      let char = this.characters.get(id);

      if (!char) {
        const projectedGrid = pixelToGrid(projected.x, projected.y);
        const state = createCharacterState(id, getAgentDisplayName(id, agent.name), projectedGrid.gx, projectedGrid.gy);
        state.isSubAgent = agent.isSubAgent;
        state.status = agent.status;
        state.currentTool = agent.currentTool?.name ?? null;
        state.confidence = agent.confidence ?? 1;
        state.moving = agent.movement !== null;
        state.x = projected.x;
        state.y = projected.y;
        state.targetX = projected.x;
        state.targetY = projected.y;

        const container = createCharacterContainer(state);
        container.eventMode = "static";
        container.cursor = "pointer";
        container.on("pointertap", () => this.onAgentClick?.(id));

        this.characterLayer.addChild(container);
        char = { state, container };
        this.characters.set(id, char);
        continue;
      }

      // Update visual state from store
      char.state.status = agent.status;
      char.state.name = getAgentDisplayName(id, agent.name);
      char.state.currentTool = agent.currentTool?.name ?? null;
      char.state.confidence = agent.confidence ?? 1;
      char.state.isSubAgent = agent.isSubAgent;
      char.state.moving = agent.movement !== null;

      const dx = projected.x - char.state.x;
      const dy = projected.y - char.state.y;
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
        char.state.facing = Math.atan2(dy, dx);
      }

      char.state.x = projected.x;
      char.state.y = projected.y;
      char.state.targetX = projected.x;
      char.state.targetY = projected.y;
    }
  }

  // ── Departure animation ─────────────────────────────────────────────

  private beginDeparture(id: string, char: { state: CharacterState; container: PIXI.Container }): void {
    // Remove from active characters
    this.characters.delete(id);

    // Set status to idle for visual during walkout
    char.state.status = "idle";
    char.state.currentTool = null;

    // Walk to corridor entrance, then destroy
    this.moveCharacterToGrid(char.state, ENTRANCE_GRID.gx, ENTRANCE_GRID.gy);
    this.departing.set(id, char);

    // If pathfinding failed (already at entrance or blocked), remove immediately
    if (!char.state.moving) {
      this.finalizeDeparture(id);
    }
  }

  private finalizeDeparture(id: string): void {
    const char = this.departing.get(id);
    if (!char) return;
    this.characterLayer.removeChild(char.container);
    char.container.destroy({ children: true });
    this.departing.delete(id);
  }

  // ── Movement ────────────────────────────────────────────────────────

  private moveCharacterToGrid(state: CharacterState, gx: number, gy: number): void {
    const current = pixelToGrid(state.x, state.y);

    // Don't pathfind if already there
    if (current.gx === gx && current.gy === gy) {
      state.moving = false;
      return;
    }

    const rawPath = findPath(this.grid, current.gx, current.gy, gx, gy);

    if (rawPath.length > 1) {
      const path = smoothPath(this.grid, rawPath);
      state.path = path;
      state.pathIndex = 0;
      state.moving = true;
      state.speed = 55 + Math.random() * 25; // Varied walk speed
      const firstTarget = gridToPixel(path[0].gx, path[0].gy);
      state.facing = Math.atan2(firstTarget.y - state.y, firstTarget.x - state.x);
    } else if (rawPath.length === 1) {
      const dest = gridToPixel(gx, gy);
      state.x = dest.x;
      state.y = dest.y;
      state.moving = false;
    }
  }

  // ── Game loop ───────────────────────────────────────────────────────

  private tick(): void {
    const delta = this.app.ticker.deltaMS / 1000;

    // Tick active characters
    for (const char of this.characters.values()) {
      this.tickCharacter(char, delta);
    }

    // Tick departing characters
    for (const [id, char] of this.departing) {
      const stillMoving = tickCharacterMovement(char.state, delta);

      // Fade out as they walk to exit
      char.container.alpha = Math.max(0.3, char.container.alpha - delta * 0.5);

      char.container.x += (char.state.x - char.container.x) * Math.min(delta * 12, 1);
      char.container.y += (char.state.y - char.container.y) * Math.min(delta * 12, 1);
      char.container.zIndex = Math.floor(char.state.y);

      updateCharacterVisuals(char.container, char.state, delta);

      if (!stillMoving && !char.state.moving) {
        this.finalizeDeparture(id);
      }
    }
  }

  private tickCharacter(char: { state: CharacterState; container: PIXI.Container }, delta: number): void {
    const dx = char.state.x - char.container.x;
    const dy = char.state.y - char.container.y;
    if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
      char.state.facing = Math.atan2(dy, dx);
    }
    if (char.state.moving) {
      char.state.walkPhase += delta * 4;
    }

    // Smooth position interpolation
    const lerpFactor = Math.min(delta * 12, 1);
    char.container.x += (char.state.x - char.container.x) * lerpFactor;
    char.container.y += (char.state.y - char.container.y) * lerpFactor;

    // Y-sort
    char.container.zIndex = Math.floor(char.state.y);

    // Update visuals (status ring, bubbles, labels, etc.)
    updateCharacterVisuals(char.container, char.state, delta);
  }

  // ── Resize ──────────────────────────────────────────────────────────

  resize(containerWidth: number, containerHeight: number): void {
    if (containerWidth === 0 || containerHeight === 0) return; // Skip zero-size resize
    const scaleX = containerWidth / this.grid.pixelWidth;
    const scaleY = containerHeight / this.grid.pixelHeight;
    const scale = Math.min(scaleX, scaleY);

    this.app.stage.scale.set(scale);

    const scaledW = this.grid.pixelWidth * scale;
    const scaledH = this.grid.pixelHeight * scale;
    this.app.stage.x = (containerWidth - scaledW) / 2;
    this.app.stage.y = (containerHeight - scaledH) / 2;

    this.app.renderer.resize(containerWidth, containerHeight);
  }

  // ── Cleanup ─────────────────────────────────────────────────────────

  destroy(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.app.ticker.stop();
    // Clean up departing agents too
    for (const char of this.departing.values()) {
      char.container.destroy({ children: true });
    }
    this.departing.clear();
    this.app.destroy(true, { children: true, texture: true });
    this.characters.clear();
  }
}
