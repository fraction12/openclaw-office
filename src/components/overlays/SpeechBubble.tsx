import { useEffect, useMemo, useState } from "react";
import Markdown from "react-markdown";
import { useTranslation } from "react-i18next";
import type { VisualAgent } from "@/gateway/types";
import { SVG_HEIGHT, SVG_WIDTH } from "@/lib/constants";

interface SpeechBubbleOverlayProps {
  agent: VisualAgent;
}

const FULLY_VISIBLE_MS = 5_000;
const FADE_DURATION_MS = 2_000;

export function SpeechBubbleOverlay({ agent }: SpeechBubbleOverlayProps) {
  const { t } = useTranslation("common");
  const [dismissed, setDismissed] = useState(false);
  const [fadeStartAt, setFadeStartAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const speechText = agent.speechBubble?.text ?? "";
  const speechTimestamp = agent.speechBubble?.timestamp ?? 0;

  useEffect(() => {
    setDismissed(false);
    setFadeStartAt(null);
    setNow(Date.now());
  }, [speechText, speechTimestamp]);

  useEffect(() => {
    if (!agent.speechBubble || dismissed) return;
    if (agent.status === "active") {
      setFadeStartAt(null);
      return;
    }

    if (fadeStartAt !== null) return;
    const timer = window.setTimeout(() => {
      setFadeStartAt(Date.now());
    }, FULLY_VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, [agent.status, agent.speechBubble, dismissed, fadeStartAt]);

  useEffect(() => {
    if (fadeStartAt === null || dismissed) return;
    const interval = window.setInterval(() => setNow(Date.now()), 50);
    const timeout = window.setTimeout(() => setDismissed(true), FADE_DURATION_MS);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [fadeStartAt, dismissed]);

  const opacity = useMemo(() => {
    if (dismissed) return 0;
    if (!agent.speechBubble) return 0;
    if (agent.status === "active" || fadeStartAt === null) return 1;
    const elapsed = now - fadeStartAt;
    return Math.max(0, 1 - elapsed / FADE_DURATION_MS);
  }, [agent.speechBubble, agent.status, dismissed, fadeStartAt, now]);

  if (!agent.speechBubble || dismissed || opacity <= 0) return null;

  const leftPct = (agent.position.x / SVG_WIDTH) * 100;
  const topPct = (agent.position.y / SVG_HEIGHT) * 100;
  const nearLeft = leftPct < 25;
  const nearRight = leftPct > 75;

  let translateX = "-50%";
  let arrowAlign: "center" | "left" | "right" = "center";
  if (nearLeft) {
    translateX = "-10%";
    arrowAlign = "left";
  } else if (nearRight) {
    translateX = "-90%";
    arrowAlign = "right";
  }

  return (
    <div
      className="pointer-events-none absolute"
      data-testid="speech-bubble-anchor"
      style={{
        left: `${leftPct}%`,
        top: `${topPct}%`,
        transform: `translate(${translateX}, -100%) translateY(-52px)`,
        opacity,
        transition: fadeStartAt === null ? "opacity 150ms ease" : "none",
        zIndex: 21,
      }}
    >
      <div
        className="pointer-events-auto min-w-[320px] w-[min(54vw,520px)] max-w-[min(94vw,560px)] max-h-[40vh] overflow-y-auto rounded-2xl border border-slate-300/80 bg-white px-4 py-3.5 text-[14px] leading-7 text-slate-900 shadow-2xl [overflow-wrap:anywhere] dark:border-slate-600/90 dark:bg-slate-900 dark:text-slate-100"
        data-testid="speech-bubble-overlay"
      >
        <div className="mb-2 flex items-start justify-end">
          <button
            type="button"
            onClick={() => {
              setDismissed(true);
            }}
            aria-label={t("actions.close")}
            className="rounded-md px-1.5 py-0.5 text-sm leading-none text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100"
          >
            ×
          </button>
        </div>
        <div className="[&_p]:my-0 [&_p+*]:mt-2.5 [&_ul]:my-1.5 [&_ol]:my-1.5 [&_li]:my-0.5">
          <Markdown>{agent.speechBubble.text}</Markdown>
        </div>
      </div>
      <div
        className="h-0 w-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-gray-200 dark:border-t-gray-700"
        data-testid={`speech-bubble-arrow-${arrowAlign}`}
        style={{
          marginLeft: arrowAlign === "left" ? "16px" : "auto",
          marginRight: arrowAlign === "right" ? "16px" : "auto",
        }}
      />
    </div>
  );
}
