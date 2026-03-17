/**
 * React wrapper for the Pixi.js top-down office.
 *
 * Thin shell: mounts the Pixi canvas and handles resize.
 * State sync happens inside OfficeEngine via direct Zustand subscription —
 * React is not in the loop for game-tick state updates.
 */

import { useEffect, useRef } from "react";
import { useOfficeStore } from "@/store";
import { OfficeEngine } from "./office-engine";

export function PixiOffice() {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<OfficeEngine | null>(null);

  const selectAgent = useOfficeStore((s) => s.selectAgent);

  // Mount engine once
  useEffect(() => {
    if (!containerRef.current) return;

    const isDark = useOfficeStore.getState().theme === "dark";
    const engine = new OfficeEngine(isDark);
    engineRef.current = engine;

    // Mount canvas — don't force 100% sizing; let Pixi's autoDensity
    // and our resize handler manage the canvas dimensions properly
    const canvas = engine.view;
    containerRef.current.appendChild(canvas);

    // Agent click → select in sidebar
    engine.setOnAgentClick((agentId) => {
      selectAgent(agentId);
    });

    // Initial resize
    const rect = containerRef.current.getBoundingClientRect();
    engine.resize(rect.width, rect.height);

    return () => {
      engine.destroy();
      engineRef.current = null;
      if (canvas.parentElement) canvas.parentElement.removeChild(canvas);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Resize handling
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        engineRef.current?.resize(width, height);
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full bg-gray-100 dark:bg-gray-950"
      style={{ overflow: "hidden" }}
    />
  );
}
