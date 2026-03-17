import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import type { Group } from "three";
import type { VisualAgent } from "@/gateway/types";
import { generateAvatar3dColor } from "@/lib/avatar-generator";
import {
  formatLastActive,
  getAgentConfidence,
  getConfidenceVisualStyle,
  getStatusIndicator,
} from "@/lib/agent-visuals";
import { STATUS_COLORS } from "@/lib/constants";
import { position2dTo3d } from "@/lib/position-allocator";
import { useOfficeStore } from "@/store";
import { ErrorIndicator } from "./ErrorIndicator";
import { SkillHologram } from "./SkillHologram";
import { ThinkingIndicator } from "./ThinkingIndicator";

interface AgentCharacterProps {
  agent: VisualAgent;
}

function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

export function AgentCharacter({ agent }: AgentCharacterProps) {
  const { t } = useTranslation("common");
  const groupRef = useRef<Group>(null);
  const bodyRef = useRef<Group>(null);
  const spawnElapsed = useRef(0);
  const spawnDone = useRef(!agent.isSubAgent);
  const selectAgent = useOfficeStore((s) => s.selectAgent);
  const selectedAgentId = useOfficeStore((s) => s.selectedAgentId);
  const [hovered, setHovered] = useState(false);

  const isSelected = selectedAgentId === agent.id;
  const isSubAgent = agent.isSubAgent;
  const isPlaceholder = agent.isPlaceholder;
  const isUnconfirmed = !agent.confirmed;
  const isWalking = agent.movement !== null;
  const statusColor = STATUS_COLORS[agent.status] ?? "#6b7280";
  const confidence = getAgentConfidence(agent);
  const confidenceStyle = getConfidenceVisualStyle(confidence);
  const baseColor = isSubAgent ? "#60a5fa" : generateAvatar3dColor(agent.id);
  const isDesaturated = false;
  const displayColor = isDesaturated || isPlaceholder || isUnconfirmed ? "#6b7280" : baseColor;
  const bodyOpacity = isPlaceholder ? 0.25 : isUnconfirmed ? 0.35 : Math.min(confidenceStyle.opacity, isSubAgent ? 0.78 : 1);
  const indicator = getStatusIndicator(agent.status);
  const tooltipLines = useMemo(
    () => [
      agent.name,
      `${t(`agent.statusLabels.${agent.status}`)} · ${Math.round(confidence * 100)}%`,
      (agent.statusReason ?? agent.derivationReason) ? `Reason: ${agent.statusReason ?? agent.derivationReason}` : null,
      agent.status === "active" && agent.currentTool ? `Tool: ${agent.currentTool.name}` : null,
      `Last active: ${formatLastActive(agent.lastActiveAt)}`,
    ].filter(Boolean) as string[],
    [agent, confidence, t],
  );

  const ringScale = isSelected ? 1.18 : 1;
  const [targetX, , targetZ] = position2dTo3d(agent.position);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    const time = state.clock.elapsedTime;

    if (!spawnDone.current) {
      spawnElapsed.current += delta;
      const progress = Math.min(spawnElapsed.current / 0.8, 1);
      const scale = easeOutBack(progress);
      groupRef.current.scale.setScalar(scale);
      if (progress >= 1) spawnDone.current = true;
      return;
    }

    if (isWalking) {
      const curAgent = useOfficeStore.getState().agents.get(agent.id);
      if (curAgent) {
        const [wx, , wz] = position2dTo3d(curAgent.position);
        const walkLerp = Math.min(2.5 * delta, 0.1);
        const pos = groupRef.current.position;
        pos.x += (wx - pos.x) * walkLerp;
        pos.z += (wz - pos.z) * walkLerp;

        if (bodyRef.current) {
          bodyRef.current.rotation.z = Math.sin(time * 8 * Math.PI * 2) * 0.08;
          bodyRef.current.position.y = Math.abs(Math.sin(time * 8)) * 0.03;
        }
      }
    } else {
      const lerpFactor = 1 - Math.pow(0.05, delta);
      const pos = groupRef.current.position;
      pos.x += (targetX - pos.x) * lerpFactor;
      pos.z += (targetZ - pos.z) * lerpFactor;

      if (bodyRef.current) {
        bodyRef.current.position.y = Math.sin(time * 2) * 0.02;
        bodyRef.current.rotation.z = 0;
      }
    }

    const emissivePulse = agent.status === "active" ? 0.08 + Math.sin(time * 1.6) * 0.06 : 0;
    const hoverPulse = isSubAgent && !isPlaceholder ? 1.0 + Math.sin(time * 3) * 0.05 : 1;
    const scale = hoverPulse * ringScale;
    groupRef.current.scale.setScalar(scale);

    const ring = groupRef.current.getObjectByName("status-ring");
    if (ring) ring.rotation.z += delta * (agent.status === "active" ? 1 : 0.2);

    const glow = groupRef.current.getObjectByName("status-glow");
    if (glow) glow.scale.setScalar(1 + emissivePulse);
  });

  return (
    <group
      ref={groupRef}
      position={[targetX, 0, targetZ]}
      scale={isSubAgent && !spawnDone.current ? 0 : 1}
      onClick={(e) => {
        e.stopPropagation();
        if (!isPlaceholder) selectAgent(agent.id);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        if (!isPlaceholder) {
          setHovered(true);
          document.body.style.cursor = "pointer";
        }
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = "auto";
      }}
    >
      <group ref={bodyRef}>
        <mesh position={[0, 0.35, 0]} castShadow>
          <capsuleGeometry args={[0.15, 0.4, 8, 16]} />
          <meshStandardMaterial
            color={displayColor}
            emissive={statusColor}
            emissiveIntensity={confidenceStyle.emissiveIntensity}
            transparent={bodyOpacity < 1}
            opacity={bodyOpacity}
            roughness={0.55}
          />
        </mesh>

        <mesh position={[0, 0.7, 0]} castShadow>
          <sphereGeometry args={[0.12, 16, 16]} />
          <meshStandardMaterial
            color={displayColor}
            emissive={statusColor}
            emissiveIntensity={Math.max(0.04, confidenceStyle.emissiveIntensity * 0.8)}
            transparent={bodyOpacity < 1}
            opacity={bodyOpacity}
            roughness={0.48}
          />
        </mesh>
      </group>

      <mesh name="status-ring" position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.29, confidenceStyle.ringWidth * 0.008, 8, 48]} />
        <meshStandardMaterial
          color={statusColor}
          emissive={statusColor}
          emissiveIntensity={confidenceStyle.emissiveIntensity + (agent.status === "active" ? 0.12 : 0)}
          transparent
          opacity={confidenceStyle.ringOpacity}
        />
      </mesh>

      {agent.status === "error" && (
        <mesh name="status-glow" position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.33, 0.35, 32]} />
          <meshBasicMaterial color={statusColor} transparent opacity={0.18} />
        </mesh>
      )}

      {agent.status === "active" && !agent.currentTool && <ThinkingIndicator />}
      {agent.status === "active" && agent.currentTool && (
        <SkillHologram tool={{ name: agent.currentTool.name }} position={[0.3, 0.5, -0.3]} />
      )}
      {agent.status === "error" && <ErrorIndicator />}

      {agent.status === "active" && agent.speechBubble && (
        <Html position={[0, 1.0, 0]} center transform={false}>
          <div className="flex items-center justify-center">
            <div className="relative flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white shadow-md">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
                <path
                  fillRule="evenodd"
                  d="M3.43 2.524A41.29 41.29 0 0110 2c2.236 0 4.43.18 6.57.524 1.437.231 2.43 1.49 2.43 2.902v5.148c0 1.413-.993 2.67-2.43 2.902a41.102 41.102 0 01-3.55.414c-.28.02-.521.18-.643.413l-1.712 3.293a.75.75 0 01-1.33 0l-1.713-3.293a.783.783 0 00-.642-.413 41.108 41.108 0 01-3.55-.414C1.993 13.245 1 11.986 1 10.574V5.426c0-1.413.993-2.67 2.43-2.902z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
            </div>
          </div>
        </Html>
      )}

      {indicator && (
        <Html position={[0.22, 0.98, 0]} center transform={false}>
          <div className="pointer-events-none rounded-full border border-white/30 bg-slate-900/90 px-1.5 py-0.5 text-[10px] font-bold text-white shadow-md">
            {indicator}
          </div>
        </Html>
      )}

      {isSelected && (
        <mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.25, 0.3, 32]} />
          <meshStandardMaterial color="#3b82f6" emissive="#3b82f6" emissiveIntensity={0.5} transparent opacity={0.8} />
        </mesh>
      )}

      {hovered && (
        <Html position={[0, 1.15, 0]} center transform={false} style={{ pointerEvents: "none" }}>
          <div className="pointer-events-none min-w-[180px] rounded bg-gray-800/95 px-3 py-2 text-[11px] text-white shadow">
            {tooltipLines.map((line, index) => (
              <div key={`${agent.id}-${index}`} className="leading-4 whitespace-normal">
                {line}
              </div>
            ))}
          </div>
        </Html>
      )}
    </group>
  );
}
