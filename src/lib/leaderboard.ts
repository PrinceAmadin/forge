import { createClient } from "@/lib/supabase/server";
import type { Challenge, LeaderboardRow, RankedRow } from "@/lib/types";

interface SnapshotEntry {
  participant_id: string;
  rank: number;
}

export interface LeaderboardData {
  rows: RankedRow[];
  prizeLine: number;
  activeCount: number;
  disqualifiedCount: number;
  totalVerifiedHours: number;
  hrsToCross: number | null; // gap between first below-cut and last above-cut
  updatedLabel: string;
}

// Fetches the ranked board, joins the most recent snapshot for movement, and
// attaches viewer context. One RPC + one small snapshot read. §12
export async function getLeaderboard(
  challenge: Challenge,
  viewerId: string | null
): Promise<LeaderboardData> {
  const supabase = await createClient();

  const { data: raw } = await supabase.rpc("get_leaderboard", {
    p_challenge_id: challenge.id,
  });
  const rows = (raw ?? []) as LeaderboardRow[];

  const { data: snap } = await supabase
    .from("leaderboard_snapshots")
    .select("rankings")
    .eq("challenge_id", challenge.id)
    .order("taken_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const prevRank = new Map<string, number>();
  if (snap?.rankings) {
    for (const e of snap.rankings as SnapshotEntry[]) {
      prevRank.set(e.participant_id, e.rank);
    }
  }
  const hasSnapshot = prevRank.size > 0;
  const prizeLine = challenge.prize_line_position;

  const ranked: RankedRow[] = rows.map((r) => {
    const prev = prevRank.get(r.participant_id);
    const delta = prev != null ? prev - r.rank : null;
    const isNew = hasSnapshot && prev == null && !r.is_disqualified;

    const crossedIntoPrize =
      !r.is_disqualified && prev != null && r.rank <= prizeLine && prev > prizeLine;
    const ejectedFromPrize =
      !r.is_disqualified && prev != null && r.rank > prizeLine && prev <= prizeLine;

    return {
      ...r,
      total_hours: Number(r.total_hours),
      delta: r.is_disqualified ? null : delta,
      isNew,
      isYou: viewerId != null && r.participant_id === viewerId,
      crossedIntoPrize,
      ejectedFromPrize,
    };
  });

  const active = ranked.filter((r) => !r.is_disqualified);
  const disqualifiedCount = ranked.length - active.length;
  const totalVerifiedHours = active.reduce((sum, r) => sum + r.total_hours, 0);

  // "7.5 hrs to cross" — gap between position prizeLine+1 and prizeLine. §6.1
  let hrsToCross: number | null = null;
  const lastIn = active[prizeLine - 1];
  const firstOut = active[prizeLine];
  if (lastIn && firstOut) {
    hrsToCross = Math.max(0, Math.round((lastIn.total_hours - firstOut.total_hours) * 100) / 100);
  }

  return {
    rows: ranked,
    prizeLine,
    activeCount: active.length,
    disqualifiedCount,
    totalVerifiedHours: Math.round(totalVerifiedHours * 100) / 100,
    hrsToCross,
    updatedLabel: "moments ago",
  };
}
