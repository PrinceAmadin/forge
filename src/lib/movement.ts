import type { LeaderboardRow, RankedRow } from "@/lib/types";

// One entry of a leaderboard_snapshots.rankings array.
export interface SnapshotEntry {
  participant_id: string;
  rank: number;
}

// Attaches movement (delta since the last snapshot) and viewer context to the
// ranked rows. Pure — extracted from getLeaderboard so the delta / isNew /
// cut-crossing rules are testable without touching the database. §12
//
// prizeLine is nullable: a friendly challenge has no cut, so no row can cross
// into or out of a prize zone.
export function deriveMovement(
  rows: LeaderboardRow[],
  snapshotRankings: SnapshotEntry[] | null,
  prizeLine: number | null,
  viewerId: string | null
): RankedRow[] {
  const prevRank = new Map<string, number>();
  for (const e of snapshotRankings ?? []) {
    prevRank.set(e.participant_id, e.rank);
  }
  // No snapshot yet means "no movement known", not "everyone is new".
  const hasSnapshot = prevRank.size > 0;

  return rows.map((r) => {
    const prev = prevRank.get(r.participant_id);
    const delta = prev != null ? prev - r.rank : null;
    const isNew = hasSnapshot && prev == null && !r.is_disqualified;

    const crossedIntoPrize =
      prizeLine != null &&
      !r.is_disqualified &&
      prev != null &&
      r.rank <= prizeLine &&
      prev > prizeLine;
    const ejectedFromPrize =
      prizeLine != null &&
      !r.is_disqualified &&
      prev != null &&
      r.rank > prizeLine &&
      prev <= prizeLine;

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
}
