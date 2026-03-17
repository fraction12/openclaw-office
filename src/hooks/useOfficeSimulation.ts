import { useEffect } from "react";
import { useOfficeStore } from "@/store";

const MAX_FRAME_DELTA_SECONDS = 0.05;

export function useOfficeSimulation() {
  useEffect(() => {
    let rafId = 0;
    let lastTime = 0;

    const tick = (time: number) => {
      if (lastTime === 0) {
        lastTime = time;
      } else {
        const deltaSeconds = Math.min((time - lastTime) / 1000, MAX_FRAME_DELTA_SECONDS);
        const store = useOfficeStore.getState();
        let hasMovement = false;
        for (const agent of store.agents.values()) {
          if (agent.movement) {
            hasMovement = true;
            break;
          }
        }
        if (hasMovement) {
          store.tickMovements(deltaSeconds);
        }
        lastTime = time;
      }

      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, []);
}
