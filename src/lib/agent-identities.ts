import type { SvgAvatarData } from "@/lib/avatar-generator";

export type AgentAvatarStyle = "professional" | "technical";

export interface AgentIdentity {
  displayName: string;
  color: string;
  accentColor: string;
  emoji: string;
  description: string;
  avatarStyle: AgentAvatarStyle;
}

export const AGENT_IDENTITIES: Record<string, AgentIdentity> = {
  main: {
    displayName: "Jarvis",
    color: "#4A90D9",
    accentColor: "#2E5A8A",
    emoji: "🔵",
    description: "Primary assistant — Opus 4.6",
    avatarStyle: "professional",
  },
  friday: {
    displayName: "Friday",
    color: "#E67E22",
    accentColor: "#D35400",
    emoji: "🟠",
    description: "Coding agent — GPT-5.4 Codex",
    avatarStyle: "technical",
  },
};

const AVATAR_STYLE_OVERRIDES: Record<AgentAvatarStyle, Partial<SvgAvatarData>> = {
  professional: {
    faceShape: "oval",
    hairStyle: "side-part",
    eyeStyle: "line",
    skinColor: "#d4956b",
    hairColor: "#2c1b0e",
  },
  technical: {
    faceShape: "round",
    hairStyle: "spiky",
    eyeStyle: "wide",
    skinColor: "#f5c5a0",
    hairColor: "#5a3214",
  },
};

export function getAgentIdentity(agentId: string): AgentIdentity | undefined {
  return AGENT_IDENTITIES[agentId];
}

export function getAgentDisplayName(agentId: string, fallbackName?: string): string {
  return getAgentIdentity(agentId)?.displayName ?? fallbackName ?? agentId;
}

export function getAgentIdentityColors(agentId: string): { color?: string; accentColor?: string } {
  const identity = getAgentIdentity(agentId);
  return identity ? { color: identity.color, accentColor: identity.accentColor } : {};
}

export function applyIdentityAvatarStyle(
  agentId: string,
  baseAvatar: SvgAvatarData,
): SvgAvatarData {
  const identity = getAgentIdentity(agentId);
  if (!identity) {
    return baseAvatar;
  }

  return {
    ...baseAvatar,
    ...AVATAR_STYLE_OVERRIDES[identity.avatarStyle],
    shirtColor: identity.color,
  };
}
