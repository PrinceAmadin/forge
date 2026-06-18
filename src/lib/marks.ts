import { createClient } from "@/lib/supabase/server";
import type { Challenge, RankedRow } from "@/lib/types";

export function marksEnabled(c: Challenge): boolean {
  return c.marks_enabled === true;
}

export interface LeaderboardMarks {
  // active marks AGAINST each user (target_user_id → count)
  againstCount: Map<string, number>;
  // marks fulfilled in the last 24h, by marker → target ids (for the overtake badge)
  recentOvertakes: Map<string, string[]>;
}

// Only call when marksEnabled(challenge) is true.
export async function getLeaderboardMarks(challengeId: string): Promise<LeaderboardMarks> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("marks")
    .select("marker_user_id, target_user_id, status, fulfilled_at")
    .eq("challenge_id", challengeId);

  const againstCount = new Map<string, number>();
  const recentOvertakes = new Map<string, string[]>();
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;

  for (const m of data ?? []) {
    if (m.status === "active") {
      againstCount.set(m.target_user_id, (againstCount.get(m.target_user_id) ?? 0) + 1);
    }
    if (m.status === "fulfilled" && m.fulfilled_at && Date.parse(m.fulfilled_at) >= cutoff) {
      const list = recentOvertakes.get(m.marker_user_id) ?? [];
      list.push(m.target_user_id);
      recentOvertakes.set(m.marker_user_id, list);
    }
  }
  return { againstCount, recentOvertakes };
}

export interface MarkEligibility {
  canMark: boolean;
  reason?: string;
}

// Hours-based, matching the DB's above-only trigger and fulfillment check.
export function markEligibility(
  viewer: RankedRow | undefined,
  target: RankedRow | undefined,
  viewerActiveCount: number,
  alreadyMarking: boolean
): MarkEligibility {
  if (!viewer || !target) return { canMark: false, reason: "Standings are still loading." };
  if (viewer.participant_id === target.participant_id) return { canMark: false };
  if (target.is_disqualified) return { canMark: false, reason: "This reader is out of the running." };
  if (alreadyMarking) return { canMark: false, reason: "You're already marking this reader." };
  if (!(target.total_hours > viewer.total_hours)) {
    return { canMark: false, reason: "You can only mark a reader ranked above you." };
  }
  if (viewerActiveCount >= 3) {
    return { canMark: false, reason: "You're at your limit of 3 marks. Release one first." };
  }
  return { canMark: true };
}
