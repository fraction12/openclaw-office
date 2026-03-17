import { generateAvatar } from "@/lib/avatar-generator";
import { getAgentDisplayName } from "@/lib/agent-identities";

interface AvatarProps {
  agentId: string;
  agentName?: string;
  size?: number;
}

export function Avatar({ agentId, agentName, size = 32 }: AvatarProps) {
  const displayName = getAgentDisplayName(agentId, agentName);
  const { backgroundColor, textColor, initial } = generateAvatar(agentId, displayName);

  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full font-bold"
      style={{
        width: size,
        height: size,
        backgroundColor,
        color: textColor,
        fontSize: size * 0.45,
      }}
    >
      {initial}
    </div>
  );
}
