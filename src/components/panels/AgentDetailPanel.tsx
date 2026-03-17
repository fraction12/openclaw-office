import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import Markdown from "react-markdown";
import { SvgAvatar } from "@/components/shared/SvgAvatar";
import { getAgentDisplayName } from "@/lib/agent-identities";
import { getAgentConfidence, formatLastActive } from "@/lib/agent-visuals";
import { getToolIcon, getToolLabel } from "@/lib/tool-display";
import { STATUS_COLORS } from "@/lib/constants";
import { evidenceStore } from "@/store/evidence-store";
import { useOfficeStore } from "@/store";
import { getAdapter } from "@/gateway/adapter-provider";

export function AgentDetailPanel() {
  const { t } = useTranslation("panels");
  const selectedId = useOfficeStore((s) => s.selectedAgentId);
  const agents = useOfficeStore((s) => s.agents);
  const selectAgent = useOfficeStore((s) => s.selectAgent);

  if (!selectedId) {
    return null;
  }
  const agent = agents.get(selectedId);
  if (!agent) {
    return null;
  }

  const displayName = getAgentDisplayName(agent.id, agent.name);
  const confidence = getAgentConfidence(agent);
  const evidence = evidenceStore.get(agent.id);
  const [evidenceOpen, setEvidenceOpen] = useState(false);

  const [taskInput, setTaskInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const isWorking = agent.status === "active";

  const handleSendTask = useCallback(async () => {
    if (!taskInput.trim()) return;
    const adapter = getAdapter();
    if (!adapter) return;
    setSending(true);
    setSendError(null);
    try {
      await adapter.chatSend({ text: taskInput.trim(), sessionKey: `agent:${agent.id}:main` });
      setTaskInput("");
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setSending(false);
    }
  }, [taskInput, agent.id]);

  const handleAbort = useCallback(async () => {
    const adapter = getAdapter();
    if (!adapter) return;
    try {
      await adapter.chatAbort(`agent:${agent.id}:main`);
    } catch {
      // best-effort
    }
  }, [agent.id]);

  const confidencePct = Math.round(confidence * 100);
  const confidenceColor = confidence > 0.8 ? "text-green-500" : confidence > 0.5 ? "text-yellow-500" : confidence > 0.2 ? "text-orange-500" : "text-red-500";

  return (
    <div className="px-3 py-2 space-y-2">
      {/* Header */}
      <div className="flex items-center gap-2">
        <SvgAvatar agentId={agent.id} size={32} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-gray-800 dark:text-gray-200">
            {displayName}
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: STATUS_COLORS[agent.status] }}
            />
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {t(`common:agent.statusLabels.${agent.status}`)}
            </span>
            <span className={`text-xs font-medium ${confidenceColor}`}>
              {confidencePct}%
            </span>
          </div>
        </div>
        {isWorking && (
          <button
            onClick={handleAbort}
            className="shrink-0 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-600 hover:bg-red-200 dark:bg-red-900/40 dark:text-red-400 dark:hover:bg-red-900/60"
            title="Abort current task"
          >
            ■ Stop
          </button>
        )}
        <button
          onClick={() => selectAgent(null)}
          className="shrink-0 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          title={t("agentDetail.deselect")}
        >
          ✕
        </button>
      </div>

      {/* Send task */}
      <div className="flex gap-1.5">
        <input
          type="text"
          value={taskInput}
          onChange={(e) => setTaskInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendTask(); } }}
          placeholder="Send a task…"
          disabled={sending}
          className="min-w-0 flex-1 rounded border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-800 placeholder-gray-400 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:placeholder-gray-500"
        />
        <button
          onClick={handleSendTask}
          disabled={sending || !taskInput.trim()}
          className="shrink-0 rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-40 transition-colors"
        >
          {sending ? "…" : "▶"}
        </button>
      </div>
      {sendError && (
        <div className="text-[10px] text-red-500">{sendError}</div>
      )}

      {/* Derivation reason */}
      {(agent.statusReason ?? agent.derivationReason) && (
        <div className="rounded bg-slate-50 px-2 py-1.5 text-xs text-slate-600 dark:bg-slate-800/60 dark:text-slate-400">
          <span className="font-medium text-slate-500 dark:text-slate-500">Why: </span>
          {agent.statusReason ?? agent.derivationReason}
        </div>
      )}

      {/* Active tool */}
      {agent.currentTool && (
        <div className="rounded bg-orange-50 px-2 py-1.5 text-xs dark:bg-orange-950/50">
          <div className="text-orange-600 dark:text-orange-400">
            {getToolIcon(agent.currentTool.name)} {getToolLabel(agent.currentTool)}
          </div>
        </div>
      )}

      {/* Speech */}
      {agent.speechBubble && (
        <div className="rounded bg-white px-2 py-1.5 text-xs leading-relaxed text-gray-700 shadow-sm dark:bg-gray-800 dark:text-gray-300">
          <Markdown>{agent.speechBubble.text}</Markdown>
        </div>
      )}

      {/* Last active */}
      <div className="text-xs text-gray-400 dark:text-gray-500">
        Last active: {formatLastActive(agent.lastActiveAt)}
        {agent.toolCallCount > 0 && ` · ${agent.toolCallCount} tool calls`}
      </div>

      {/* Evidence (collapsible) */}
      <div>
        <button
          onClick={() => setEvidenceOpen(!evidenceOpen)}
          className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <span className="text-[10px]">{evidenceOpen ? "▼" : "▶"}</span>
          Evidence
        </button>
        {evidenceOpen && (
          <div className="mt-1.5 space-y-1 rounded bg-slate-50 px-2 py-1.5 text-[11px] text-slate-600 dark:bg-slate-800/60 dark:text-slate-400">
            <EvidenceRow label="WS Lifecycle" value={evidence.wsLifecycle ? `${evidence.wsLifecycle.phase} (${formatLastActive(evidence.wsLifecycle.timestamp)})` : null} />
            <EvidenceRow label="WS Tool" value={evidence.wsToolCall ? `${evidence.wsToolCall.name} [${evidence.wsToolCall.phase}] (${formatLastActive(evidence.wsToolCall.timestamp)})` : null} />
            <EvidenceRow label="WS Speech" value={evidence.wsSpeech ? `"${evidence.wsSpeech.text.slice(0, 40)}…" (${formatLastActive(evidence.wsSpeech.timestamp)})` : null} />
            <EvidenceRow label="WS Error" value={evidence.wsError ? `${evidence.wsError.message.slice(0, 50)} (${formatLastActive(evidence.wsError.timestamp)})` : null} />
            <EvidenceRow label="HTTP Status" value={evidence.httpSessionStatus ? `${evidence.httpSessionStatus.status} (${formatLastActive(evidence.httpSessionStatus.updatedAt)})` : null} />
            <EvidenceRow label="HTTP Tool" value={evidence.httpLastTool ? `${evidence.httpLastTool.name} (${formatLastActive(evidence.httpLastTool.timestamp)})` : null} />
            <EvidenceRow label="Last WS Event" value={evidence.lastWsEventAt ? formatLastActive(evidence.lastWsEventAt) : null} />
            <EvidenceRow label="Last HTTP" value={evidence.lastHttpRefreshAt ? formatLastActive(evidence.lastHttpRefreshAt) : null} />
            <EvidenceRow label="Connection" value={evidence.connectionHealthy ? "✓ healthy" : "✗ unhealthy"} />
          </div>
        )}
      </div>

      {/* Tool history */}
      {agent.toolCallHistory.length > 0 && (
        <div>
          <div className="mb-1 text-xs font-medium text-gray-400 dark:text-gray-500">
            Recent Tools
          </div>
          {agent.toolCallHistory.map((rec, i) => (
            <div
              key={`${rec.name}-${rec.timestamp}-${i}`}
              className="flex items-center justify-between border-b border-gray-100 py-1 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400"
            >
              <span>{getToolIcon(rec.name)} {rec.name}</span>
              <span className="text-gray-400">{new Date(rec.timestamp).toLocaleTimeString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EvidenceRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="shrink-0 font-medium text-slate-500 dark:text-slate-500">{label}</span>
      <span className="text-right">{value ?? <span className="italic text-slate-400">none</span>}</span>
    </div>
  );
}
