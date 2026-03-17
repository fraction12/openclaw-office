import type { VisualAgent } from "@/gateway/types";
import { ZONES } from "@/lib/constants";
import { allocateMeetingPositions } from "@/lib/position-allocator";

const MAX_CONCURRENT_MEETINGS = 3;

export interface MeetingGroup {
  /** The parent agent driving this meeting */
  parentId: string;
  /** All participants: parent + active sub-agents */
  agentIds: string[];
}

/** Multiple meeting table center positions (up to 3 groups) */
const MEETING_TABLE_CENTERS = [
  { x: ZONES.meeting.x + ZONES.meeting.width / 2, y: ZONES.meeting.y + ZONES.meeting.height / 2 },
  {
    x: ZONES.meeting.x + ZONES.meeting.width * 0.25,
    y: ZONES.meeting.y + ZONES.meeting.height * 0.3,
  },
  {
    x: ZONES.meeting.x + ZONES.meeting.width * 0.75,
    y: ZONES.meeting.y + ZONES.meeting.height * 0.7,
  },
];

const ACTIVE_STATUSES = new Set(["active"]);

/**
 * Detect meeting groups from active delegation relationships.
 *
 * A meeting forms when a parent agent has one or more active (non-idle,
 * non-placeholder) sub-agents. The parent and all active children gather
 * at the meeting table — representing real back-and-forth delegation.
 */
export function detectMeetingGroups(
  agents: Map<string, VisualAgent>,
): MeetingGroup[] {
  const groups: MeetingGroup[] = [];

  for (const agent of agents.values()) {
    // Only main (non-sub) agents can convene meetings
    if (agent.isSubAgent || agent.isPlaceholder) continue;
    if (agent.childAgentIds.length === 0) continue;

    // Find active children
    const activeChildren = agent.childAgentIds.filter((childId) => {
      const child = agents.get(childId);
      if (!child || child.isPlaceholder) return false;
      // Child must be doing real work
      return ACTIVE_STATUSES.has(child.status);
    });

    if (activeChildren.length === 0) continue;

    // Parent + active children form a meeting
    groups.push({
      parentId: agent.id,
      agentIds: [agent.id, ...activeChildren],
    });

    if (groups.length >= MAX_CONCURRENT_MEETINGS) break;
  }

  return groups;
}

/**
 * Calculate seat positions for a meeting group.
 */
export function calculateMeetingSeats(
  group: MeetingGroup,
  tableIndex: number,
): Map<string, { x: number; y: number }> {
  const center = MEETING_TABLE_CENTERS[tableIndex % MEETING_TABLE_CENTERS.length];
  const positions = allocateMeetingPositions(group.agentIds, center);
  const result = new Map<string, { x: number; y: number }>();

  group.agentIds.forEach((id, i) => {
    result.set(id, positions[i]);
  });

  return result;
}

/**
 * Apply meeting gathering: move agents to meeting positions and save originals.
 * Return agents that are no longer in any active meeting.
 */
export function applyMeetingGathering(
  agents: Map<string, VisualAgent>,
  groups: MeetingGroup[],
  moveToMeeting: (agentId: string, pos: { x: number; y: number }) => void,
  returnFromMeeting: (agentId: string) => void,
): void {
  const inMeeting = new Set<string>();

  groups.forEach((group, tableIndex) => {
    const seats = calculateMeetingSeats(group, tableIndex);
    for (const [agentId, pos] of seats) {
      const agent = agents.get(agentId);
      if (agent && agent.zone !== "meeting" && agent.movement?.toZone !== "meeting") {
        moveToMeeting(agentId, pos);
      }
      inMeeting.add(agentId);
    }
  });

  // Return agents no longer in any meeting
  for (const agent of agents.values()) {
    if (agent.zone === "meeting" && !inMeeting.has(agent.id)) {
      returnFromMeeting(agent.id);
    }
  }
}
