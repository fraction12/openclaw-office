import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Settings, Bot, Clock, Radio, Wrench, BarChart3 } from "lucide-react";
import { isSoundEnabled, playEnableConfirmation } from "@/lib/ambient";
import { toggleAmbientSound } from "@/hooks/useAmbient";
import { useOfficeStore } from "@/store";

const LINKS = [
  { path: "/console", label: "Dashboard", icon: BarChart3 },
  { path: "/console/agents", label: "Agents", icon: Bot },
  { path: "/console/cron", label: "Cron Jobs", icon: Clock },
  { path: "/console/channels", label: "Channels", icon: Radio },
  { path: "/console/skills", label: "Skills", icon: Wrench },
  { path: "/console/settings", label: "Settings", icon: Settings },
] as const;

export function QuickSettingsPanel() {
  const navigate = useNavigate();
  const [soundOn, setSoundOn] = useState(isSoundEnabled);
  const connectionStatus = useOfficeStore((s) => s.connectionStatus);
  const agents = useOfficeStore((s) => s.agents);

  const agentCount = agents.size;
  const activeCount = Array.from(agents.values()).filter(
    (a) => a.status === "active",
  ).length;

  return (
    <div className="px-3 py-2 space-y-2">
      {/* Status bar */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5">
          <span
            className={`inline-block h-2 w-2 rounded-full ${
              connectionStatus === "connected" ? "bg-green-500" : connectionStatus === "connecting" ? "bg-yellow-500 animate-pulse" : "bg-red-500"
            }`}
          />
          <span className="text-gray-600 dark:text-gray-400">
            {connectionStatus === "connected" ? "Connected" : connectionStatus === "connecting" ? "Connecting…" : "Disconnected"}
          </span>
        </div>
        <span className="text-gray-400 dark:text-gray-500">
          {activeCount}/{agentCount} active
        </span>
      </div>

      {/* Sound toggle */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-gray-500 dark:text-gray-400">Ambient sounds</span>
        <button
          onClick={() => { const next = !soundOn; toggleAmbientSound(next); setSoundOn(next); if (next) playEnableConfirmation(); }}
          className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] transition-colors ${
            soundOn
              ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400"
              : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
          }`}
        >
          <span className="text-[10px]">{soundOn ? "🔊" : "🔇"}</span>
          {soundOn ? "On" : "Off"}
        </button>
      </div>

      {/* Quick navigation */}
      <div className="grid grid-cols-3 gap-1.5">
        {LINKS.map(({ path, label, icon: Icon }) => (
          <button
            key={path}
            onClick={() => navigate(path)}
            className="flex flex-col items-center gap-1 rounded-lg border border-gray-100 bg-gray-50 px-2 py-2 text-gray-600 transition-colors hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-blue-950 dark:hover:border-blue-800 dark:hover:text-blue-400"
          >
            <Icon className="h-4 w-4" />
            <span className="text-[9px] font-medium leading-tight">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
