import { useEffect, useRef, useState } from "react";
import { useOfficeStore } from "@/store/office-store";
import { STATUS_COLORS } from "@/lib/constants";
import type { AgentStream } from "@/gateway/types";

const STREAM_ICONS: Record<AgentStream, string> = {
  lifecycle: "●",
  tool: "🔧",
  assistant: "💬",
  error: "⚠",
};

const MAX_DISPLAY = 50;

export function EventTimeline() {
  const eventHistory = useOfficeStore((s) => s.eventHistory);
  const selectAgent = useOfficeStore((s) => s.selectAgent);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const prevLenRef = useRef(0);

  const displayEvents = eventHistory.slice(-MAX_DISPLAY);

  useEffect(() => {
    if (autoScroll && scrollRef.current && eventHistory.length > prevLenRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    prevLenRef.current = eventHistory.length;
  }, [eventHistory.length, autoScroll]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const atBottom = scrollHeight - scrollTop - clientHeight < 30;
    setAutoScroll(atBottom);
  };

  return (
    <div className="flex flex-col border-t border-gray-800">
      <div className="flex items-center justify-between px-3 py-1.5">
        <span className="text-xs font-medium text-gray-500">事件时间轴</span>
        {!autoScroll && eventHistory.length > 0 && (
          <button
            onClick={() => {
              setAutoScroll(true);
              if (scrollRef.current) {
                scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
              }
            }}
            className="rounded bg-blue-600 px-1.5 py-0.5 text-[10px] text-white"
          >
            新事件 ↓
          </button>
        )}
      </div>
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="max-h-40 overflow-y-auto"
      >
        {displayEvents.map((evt, i) => (
          <button
            key={`${evt.timestamp}-${evt.agentId}-${i}`}
            onClick={() => selectAgent(evt.agentId)}
            className="flex w-full items-start gap-1.5 border-t border-gray-800/30 px-3 py-1 text-left text-xs hover:bg-gray-900"
          >
            <span className="mt-0.5 shrink-0 text-gray-600">
              {new Date(evt.timestamp).toLocaleTimeString("en-US", {
                hour12: false,
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </span>
            <span className="shrink-0">
              {STREAM_ICONS[evt.stream] ?? "·"}
            </span>
            <span
              className="shrink-0 font-medium"
              style={{
                color: STATUS_COLORS[
                  evt.stream === "error" ? "error" : "thinking"
                ],
              }}
            >
              {evt.agentName}
            </span>
            <span className="min-w-0 truncate text-gray-500">
              {evt.summary}
            </span>
          </button>
        ))}
        {displayEvents.length === 0 && (
          <div className="py-3 text-center text-xs text-gray-600">
            暂无事件
          </div>
        )}
      </div>
    </div>
  );
}
