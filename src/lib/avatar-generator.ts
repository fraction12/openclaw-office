const PALETTE = [
  "#ef4444", "#f97316", "#f59e0b", "#84cc16",
  "#22c55e", "#14b8a6", "#06b6d4", "#3b82f6",
  "#6366f1", "#8b5cf6", "#a855f7", "#ec4899",
];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    hash = ((hash << 5) - hash + ch) | 0;
  }
  return Math.abs(hash);
}

function luminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

export interface AvatarInfo {
  backgroundColor: string;
  textColor: string;
  initial: string;
}

export function generateAvatar(
  agentId: string,
  agentName?: string,
): AvatarInfo {
  const hash = hashString(agentId);
  const backgroundColor = PALETTE[hash % PALETTE.length];
  const textColor = luminance(backgroundColor) > 0.5 ? "#000000" : "#ffffff";

  const displayName = agentName ?? agentId;
  const initial = displayName.charAt(0).toUpperCase() || "?";

  return { backgroundColor, textColor, initial };
}
