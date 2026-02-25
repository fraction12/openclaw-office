import { useEffect, useState } from "react";
import Markdown from "react-markdown";
import { SVG_WIDTH, SVG_HEIGHT } from "@/lib/constants";
import type { VisualAgent } from "@/gateway/types";

interface SpeechBubbleOverlayProps {
  agent: VisualAgent;
}

export function SpeechBubbleOverlay({ agent }: SpeechBubbleOverlayProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (agent.status !== "speaking") {
      const timer = setTimeout(() => setVisible(false), 5000);
      return () => clearTimeout(timer);
    }
    setVisible(true);
  }, [agent.status]);

  if (!agent.speechBubble || !visible) return null;

  const leftPct = (agent.position.x / SVG_WIDTH) * 100;
  const topPct = (agent.position.y / SVG_HEIGHT) * 100;

  return (
    <div
      className="pointer-events-none absolute"
      style={{
        left: `${leftPct}%`,
        top: `${topPct}%`,
        transform: "translate(-50%, -100%) translateY(-40px)",
        opacity: agent.status === "speaking" ? 1 : 0,
        transition: "opacity 500ms ease",
      }}
    >
      <div className="pointer-events-auto max-w-[280px] overflow-y-auto rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-200 shadow-lg">
        <Markdown>{agent.speechBubble.text}</Markdown>
      </div>
      {/* Arrow pointing down to agent dot */}
      <div className="mx-auto h-0 w-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-gray-700" />
    </div>
  );
}
