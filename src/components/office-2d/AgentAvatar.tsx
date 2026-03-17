import { useState, memo, useRef, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { VisualAgent } from "@/gateway/types";
import { generateAvatarAccentColor, generateSvgAvatar, type SvgAvatarData } from "@/lib/avatar-generator";
import { getAgentDisplayName, getAgentIdentity } from "@/lib/agent-identities";
import { STATUS_COLORS, AVATAR } from "@/lib/constants";
import {
  formatLastActive,
  getAgentConfidence,
  getConfidenceVisualStyle,
  getStatusAnimation,
  getStatusIndicator,
  getStatusRingDasharray,
} from "@/lib/agent-visuals";
import { getToolIcon, getToolPillLabel } from "@/lib/tool-display";
import { useOfficeStore } from "@/store";

const WALK_BOB_AMPLITUDE = 2;
const WALK_BOB_FREQ = 8;

interface AgentAvatarProps {
  agent: VisualAgent;
}

export const AgentAvatar = memo(function AgentAvatar({ agent }: AgentAvatarProps) {
  const { t } = useTranslation("common");
  const selectedAgentId = useOfficeStore((s) => s.selectedAgentId);
  const selectAgent = useOfficeStore((s) => s.selectAgent);
  const theme = useOfficeStore((s) => s.theme);
  const [hovered, setHovered] = useState(false);
  const gRef = useRef<SVGGElement>(null);
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  const isSelected = selectedAgentId === agent.id;
  const r = isSelected ? AVATAR.selectedRadius : AVATAR.radius;
  const isPlaceholder = agent.isPlaceholder;
  const isUnconfirmed = !agent.confirmed;
  const isWalking = agent.movement !== null;
  const statusColor = STATUS_COLORS[agent.status] ?? "#6b7280";
  const color = isPlaceholder || isUnconfirmed ? "#6b7280" : generateAvatarAccentColor(agent.id);
  const isDark = theme === "dark";
  const identity = getAgentIdentity(agent.id);
  const avatarData = generateSvgAvatar(agent.id);
  const clipId = `avatar-clip-${agent.id}`;
  const confidence = getAgentConfidence(agent);
  const confidenceStyle = getConfidenceVisualStyle(confidence);
  const stateOpacity = isPlaceholder ? 0.3 : isUnconfirmed ? 0.5 : confidenceStyle.opacity;
  const badgeText = getStatusIndicator(agent.status);
  const bodyDesaturated = false;
  const fullDisplayName = getAgentDisplayName(agent.id, agent.name);
  const displayName =
    fullDisplayName.length > AVATAR.nameLabelMaxChars
      ? `${fullDisplayName.slice(0, AVATAR.nameLabelMaxChars)}…`
      : fullDisplayName;

  const tooltipLines = [
    fullDisplayName,
    `${t(`agent.statusLabels.${agent.status}`)} · ${Math.round(confidence * 100)}%`,
    (agent.statusReason ?? agent.derivationReason) ? `Reason: ${agent.statusReason ?? agent.derivationReason}` : null,
    agent.status === "active" && agent.currentTool ? `${getToolIcon(agent.currentTool.name)} ${getToolPillLabel(agent.currentTool)}` : null,
    `Last active: ${formatLastActive(agent.lastActiveAt)}`,
  ].filter(Boolean) as string[];

  const agentIdRef = useRef(agent.id);
  agentIdRef.current = agent.id;

  const animate = useCallback(
    (time: number) => {
      if (!gRef.current) return;
      lastTimeRef.current = time;

      const state = useOfficeStore.getState();
      const a = state.agents.get(agentIdRef.current);
      if (!a) return;

      let bobY = 0;
      let walkScale = 1;
      if (a.movement) {
        const p = a.movement.progress;
        const elapsed = (Date.now() - a.movement.startTime) / 1000;
        bobY = Math.sin(elapsed * WALK_BOB_FREQ * Math.PI * 2) * WALK_BOB_AMPLITUDE;
        if (p < 0.1) walkScale = 0.9 + p;
        else if (p > 0.9) {
          const t = (p - 0.9) / 0.1;
          walkScale = 1 - 0.05 * Math.sin(t * Math.PI);
        }
      }

      gRef.current.setAttribute(
        "transform",
        `translate(${a.position.x}, ${a.position.y + bobY}) scale(${walkScale})`,
      );

      if (a.movement) rafRef.current = requestAnimationFrame(animate);
    },
    [],
  );

  useEffect(() => {
    if (isWalking) {
      lastTimeRef.current = 0;
      rafRef.current = requestAnimationFrame(animate);
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isWalking, animate]);

  return (
    <g
      ref={gRef}
      transform={`translate(${agent.position.x}, ${agent.position.y})`}
      style={{ cursor: isPlaceholder ? "default" : "pointer" }}
      opacity={stateOpacity}
      onClick={() => !isPlaceholder && selectAgent(agent.id)}
      onMouseEnter={() => !isPlaceholder && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {isSelected && (
        <circle
          r={r + 8}
          fill={color}
          opacity={0.18}
          style={{ filter: `drop-shadow(0 0 10px ${color})` }}
        />
      )}

      <StatusRing agent={agent} r={r} color={color} isWalking={isWalking} isPlaceholder={isPlaceholder} />

      <defs>
        <clipPath id={clipId}>
          <circle r={r - 2} />
        </clipPath>
      </defs>
      <circle r={r - 2} fill={isDark ? "#1e293b" : "#f8fafc"} />
      <g clipPath={`url(#${clipId})`} style={bodyDesaturated ? { filter: "grayscale(1) saturate(0.25)" } : undefined}>
        <AvatarFace agentId={agent.id} data={avatarData} size={r * 2 - 4} />
      </g>
      {identity && (
        <g transform={`translate(0, ${r * 0.55})`}>
          <circle
            r={r * 0.32}
            fill={isDark ? "rgba(15,23,42,0.92)" : "rgba(255,255,255,0.92)"}
            stroke={color}
            strokeWidth={1.4}
          />
          <text textAnchor="middle" dy="3.4" fontSize="10" fill={color} fontWeight="bold">
            {identity.displayName.charAt(0)}
          </text>
        </g>
      )}

      {agent.isSubAgent && (
        <g transform={`translate(${r * 0.6}, ${r * 0.5})`}>
          <circle r={7} fill={isDark ? "#1e293b" : "#fff"} stroke={color} strokeWidth={1.2} />
          <text textAnchor="middle" dy="3.5" fontSize="9" fill={color} fontWeight="bold">
            S
          </text>
        </g>
      )}

      {agent.status === "active" && !agent.currentTool && <ThinkingDots r={r} />}
      

      {badgeText && (
        <StatusBadge r={r} color={statusColor} text={badgeText} isDark={isDark} />
      )}

      {agent.status === "active" && agent.currentTool && (
        <foreignObject x={-75} y={r + 2} width={150} height={22} style={{ pointerEvents: "none" }}>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <span
              style={{
                fontSize: "9px",
                fontWeight: 600,
                color: "#fff",
                backgroundColor: "#f97316",
                borderRadius: "5px",
                padding: "2px 7px",
                whiteSpace: "nowrap",
                maxWidth: "140px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                lineHeight: "1.3",
              }}
            >
              {getToolIcon(agent.currentTool.name)} {getToolPillLabel(agent.currentTool)}
            </span>
          </div>
        </foreignObject>
      )}

      <foreignObject
        x={-60}
        y={r + (agent.status === "active" && agent.currentTool ? 18 : 4)}
        width={120}
        height={22}
        style={{ pointerEvents: "none" }}
      >
        <div style={{ display: "flex", justifyContent: "center" }}>
          <span
            title={fullDisplayName}
            style={{
              fontSize: "11px",
              fontWeight: 500,
              color: isDark ? "#cbd5e1" : "#475569",
              backgroundColor: isDark ? "rgba(30,41,59,0.7)" : "rgba(255,255,255,0.75)",
              backdropFilter: "blur(6px)",
              borderRadius: "6px",
              padding: "1px 8px",
              whiteSpace: "nowrap",
              border: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}`,
            }}
          >
            {displayName}
          </span>
        </div>
      </foreignObject>

      {agent.cronLabel && agent.status === "active" && (
        <foreignObject x={-60} y={r + (agent.status === "active" && agent.currentTool ? 36 : 22)} width={120} height={18} style={{ pointerEvents: "none" }}>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <span
              style={{
                fontSize: "8px",
                fontWeight: 600,
                color: isDark ? "#a5b4fc" : "#6366f1",
                backgroundColor: isDark ? "rgba(99,102,241,0.15)" : "rgba(99,102,241,0.1)",
                borderRadius: "3px",
                padding: "1px 5px",
                whiteSpace: "nowrap",
                maxWidth: "100px",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              ⏱ {agent.cronLabel}
            </span>
          </div>
        </foreignObject>
      )}

      {hovered && (
        <foreignObject x={-110} y={-r - 72} width={220} height={78} style={{ pointerEvents: "none" }}>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <div
              style={{
                fontSize: "11px",
                fontWeight: 500,
                color: isDark ? "#e2e8f0" : "#374151",
                backgroundColor: isDark ? "rgba(30,41,59,0.9)" : "rgba(255,255,255,0.94)",
                backdropFilter: "blur(8px)",
                borderRadius: "10px",
                padding: "6px 10px",
                boxShadow: isDark ? "0 4px 8px rgba(0,0,0,0.3)" : "0 4px 8px rgba(0,0,0,0.1)",
                border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"}`,
                minWidth: "180px",
              }}
            >
              {tooltipLines.map((line, index) => (
                <div key={`${agent.id}-${index}`} style={{ whiteSpace: "normal", lineHeight: 1.35 }}>
                  {line}
                </div>
              ))}
            </div>
          </div>
        </foreignObject>
      )}
    </g>
  );
});

function StatusRing({
  agent,
  r,
  color,
  isWalking,
  isPlaceholder,
}: {
  agent: VisualAgent;
  r: number;
  color: string;
  isWalking: boolean;
  isPlaceholder: boolean;
}) {
  const confidence = getAgentConfidence(agent);
  const confidenceStyle = getConfidenceVisualStyle(confidence);
  const animation = getStatusAnimation(agent.status);
  const statusDash = getStatusRingDasharray(agent.status);
  const dashArray = isWalking ? "4 3" : statusDash ?? confidenceStyle.ringDasharray;
  const strokeColor = isWalking ? "#3b82f6" : color;

  return (
    <circle
      r={r}
      fill="none"
      stroke={strokeColor}
      strokeWidth={isPlaceholder ? 2 : confidenceStyle.ringWidth}
      strokeDasharray={isPlaceholder ? "6 3" : dashArray}
      opacity={isPlaceholder ? 0.5 : confidenceStyle.ringOpacity}
      style={{
        transition: "stroke 300ms ease, opacity 300ms ease, stroke-width 300ms ease",
        animation: !isWalking && !isPlaceholder ? animation : undefined,
      }}
    />
  );
}

function ThinkingDots({ r }: { r: number }) {
  return (
    <g transform={`translate(${r * 0.55}, ${-r * 0.7})`}>
      {[0, 1, 2].map((i) => (
        <circle
          key={i}
          cx={i * 5}
          cy={0}
          r={2}
          fill="#3b82f6"
          style={{ animation: `thinking-dots 1.2s ease-in-out ${i * 0.15}s infinite` }}
        />
      ))}
    </g>
  );
}

function StatusBadge({ r, color, text, isDark }: { r: number; color: string; text: string; isDark: boolean }) {
  return (
    <g transform={`translate(${r * 0.65}, ${-r * 0.65})`}>
      <circle r={8} fill={isDark ? "#0f172a" : "#fff"} stroke={color} strokeWidth={1.5} opacity={0.96} />
      <text textAnchor="middle" dy="3.5" fontSize={text.length > 1 ? "7" : "10"} fill={color} fontWeight="bold">
        {text}
      </text>
    </g>
  );
}

function AvatarFace({ agentId, data, size }: { agentId: string; data: SvgAvatarData; size: number }) {
  const s = size / 2;
  const faceRx = data.faceShape === "round" ? s * 0.8 : data.faceShape === "oval" ? s * 0.7 : s * 0.75;
  const faceRy = data.faceShape === "oval" ? s * 0.9 : faceRx;
  const identity = getAgentIdentity(agentId);
  const accentColor = generateAvatarAccentColor(agentId);
  const bodyVariant = identity?.avatarStyle ?? "generic";

  return (
    <g>
      {bodyVariant === "professional" ? (
        <g>
          <rect x={-s} y={s * 0.38} width={size} height={s * 1.22} fill="#172554" />
          <path d={`M ${-s * 0.78} ${s * 0.4} L ${-s * 0.15} ${s * 0.4} L ${-s * 0.36} ${s * 0.95} L ${-s} ${s * 1.35} Z`} fill="#0f172a" />
          <path d={`M ${s * 0.78} ${s * 0.4} L ${s * 0.15} ${s * 0.4} L ${s * 0.36} ${s * 0.95} L ${s} ${s * 1.35} Z`} fill="#0f172a" />
          <rect x={-s * 0.14} y={s * 0.42} width={s * 0.28} height={s * 0.76} rx={3} fill="#dbeafe" />
          <path d={`M 0 ${s * 0.5} L ${s * 0.16} ${s * 0.88} L 0 ${s * 1.18} L ${-s * 0.16} ${s * 0.88} Z`} fill={accentColor} />
        </g>
      ) : bodyVariant === "technical" ? (
        <g>
          <path d={`M ${-s} ${s * 1.4} L ${-s * 0.82} ${s * 0.52} Q 0 ${s * 0.2} ${s * 0.82} ${s * 0.52} L ${s} ${s * 1.4} Z`} fill={data.shirtColor} />
          <path d={`M ${-s * 0.7} ${s * 0.54} Q 0 ${s * 0.15} ${s * 0.7} ${s * 0.54} L ${s * 0.42} ${s * 0.8} Q 0 ${s * 0.46} ${-s * 0.42} ${s * 0.8} Z`} fill="#1f2937" opacity={0.9} />
          <rect x={-s * 0.36} y={s * 0.78} width={s * 0.72} height={s * 0.2} rx={3} fill={accentColor} opacity={0.9} />
          <circle cx={s * 0.42} cy={s * 0.96} r={s * 0.08} fill="#e5e7eb" opacity={0.9} />
          <circle cx={s * 0.6} cy={s * 0.96} r={s * 0.08} fill="#e5e7eb" opacity={0.7} />
        </g>
      ) : (
        <rect x={-s} y={s * 0.4} width={size} height={s * 1.2} fill={data.shirtColor} />
      )}
      <ellipse cx={0} cy={-s * 0.05} rx={faceRx} ry={faceRy} fill={data.skinColor} />
      <HairSvg style={data.hairStyle} color={data.hairColor} s={s} faceRx={faceRx} />
      <EyesSvg style={data.eyeStyle} s={s} />
      {bodyVariant === "technical" && (
        <path d={`M ${-s * 0.28} ${s * 0.06} Q 0 ${s * 0.22} ${s * 0.28} ${s * 0.06}`} fill="none" stroke="#475569" strokeWidth={1.3} strokeLinecap="round" />
      )}
    </g>
  );
}

function HairSvg({ style, color, s, faceRx }: { style: SvgAvatarData["hairStyle"]; color: string; s: number; faceRx: number }) {
  switch (style) {
    case "short":
      return <ellipse cx={0} cy={-s * 0.55} rx={faceRx * 0.95} ry={s * 0.45} fill={color} />;
    case "spiky":
      return (
        <g>
          <ellipse cx={0} cy={-s * 0.55} rx={faceRx * 0.9} ry={s * 0.4} fill={color} />
          {[-0.4, -0.15, 0.1, 0.35].map((off) => (
            <polygon key={off} points={`${off * s * 2},-${s * 0.85} ${off * s * 2 - 3},-${s * 0.5} ${off * s * 2 + 3},-${s * 0.5}`} fill={color} />
          ))}
        </g>
      );
    case "side-part":
      return (
        <g>
          <ellipse cx={-s * 0.1} cy={-s * 0.55} rx={faceRx} ry={s * 0.45} fill={color} />
          <rect x={faceRx * 0.3} y={-s * 0.9} width={faceRx * 0.5} height={s * 0.3} rx={3} fill={color} />
        </g>
      );
    case "curly":
      return (
        <g>
          {[
            [-0.35, -0.7],
            [0, -0.78],
            [0.35, -0.7],
            [-0.5, -0.45],
            [0.5, -0.45],
          ].map(([ox, oy], i) => (
            <circle key={i} cx={ox * s} cy={oy * s} r={s * 0.22} fill={color} />
          ))}
        </g>
      );
    case "buzz":
      return <ellipse cx={0} cy={-s * 0.45} rx={faceRx * 0.85} ry={s * 0.35} fill={color} opacity={0.7} />;
    default:
      return null;
  }
}

function EyesSvg({ style, s }: { style: SvgAvatarData["eyeStyle"]; s: number }) {
  const ey = -s * 0.08;
  const gap = s * 0.28;
  switch (style) {
    case "dot":
      return (
        <g>
          <circle cx={-gap} cy={ey} r={2} fill="#333" />
          <circle cx={gap} cy={ey} r={2} fill="#333" />
        </g>
      );
    case "line":
      return (
        <g>
          <line x1={-gap - 3} y1={ey} x2={-gap + 3} y2={ey} stroke="#333" strokeWidth={1.5} strokeLinecap="round" />
          <line x1={gap - 3} y1={ey} x2={gap + 3} y2={ey} stroke="#333" strokeWidth={1.5} strokeLinecap="round" />
        </g>
      );
    case "wide":
      return (
        <g>
          <ellipse cx={-gap} cy={ey} rx={3} ry={2.5} fill="#fff" stroke="#333" strokeWidth={0.8} />
          <circle cx={-gap} cy={ey} r={1.2} fill="#333" />
          <ellipse cx={gap} cy={ey} rx={3} ry={2.5} fill="#fff" stroke="#333" strokeWidth={0.8} />
          <circle cx={gap} cy={ey} r={1.2} fill="#333" />
        </g>
      );
    default:
      return null;
  }
}
