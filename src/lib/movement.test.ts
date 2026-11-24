import { describe, expect, it } from "vitest";
import { deriveMovement, type SnapshotEntry } from "@/lib/movement";
import type { LeaderboardRow } from "@/lib/types";

function row(over: Partial<LeaderboardRow> = {}): LeaderboardRow {
  return {
    rank: 1,
    participant_id: "p1",
    full_name: "Ada Reader",
    course: "Law",
    hall_name: "Idia Hall",
    verified_days: 5,
    total_hours: 40,
    earliest_submission: "2026-06-17T20:00:00Z",
    last_submission: "2026-06-21T20:00:00Z",
    is_disqualified: false,
    ...over,
  };
}

const PRIZE_LINE = 15;

describe("deriveMovement without a snapshot", () => {
  // This is today's production state: nothing writes leaderboard_snapshots,
  // so every delta must be null rather than a misleading zero.
  const rows = [row({ participant_id: "p1", rank: 1 }), row({ participant_id: "p2", rank: 2 })];

  it("reports no movement at all", () => {
    const out = deriveMovement(rows, null, PRIZE_LINE, null);
    expect(out.map((r) => r.delta)).toEqual([null, null]);
  });

  it("does not mark everyone as new", () => {
    const out = deriveMovement(rows, null, PRIZE_LINE, null);
    expect(out.every((r) => r.isNew === false)).toBe(true);
  });

  it("treats an empty snapshot array the same as no snapshot", () => {
    const out = deriveMovement(rows, [], PRIZE_LINE, null);
    expect(out.every((r) => r.delta === null && !r.isNew)).toBe(true);
  });
});

describe("deriveMovement with a snapshot", () => {
  const snapshot: SnapshotEntry[] = [
    { participant_id: "p1", rank: 3 },
    { participant_id: "p2", rank: 1 },
  ];

  it("reports positions gained as positive and lost as negative", () => {
    const rows = [row({ participant_id: "p1", rank: 1 }), row({ participant_id: "p2", rank: 2 })];
    const out = deriveMovement(rows, snapshot, PRIZE_LINE, null);
    expect(out[0]?.delta).toBe(2); // 3 -> 1
    expect(out[1]?.delta).toBe(-1); // 1 -> 2
  });

  it("marks a participant absent from the snapshot as new", () => {
    const rows = [row({ participant_id: "p9", rank: 4 })];
    const out = deriveMovement(rows, snapshot, PRIZE_LINE, null);
    expect(out[0]?.isNew).toBe(true);
    expect(out[0]?.delta).toBeNull();
  });

  it("suppresses delta and the new badge for a disqualified reader", () => {
    const rows = [row({ participant_id: "p1", rank: 1, is_disqualified: true })];
    const out = deriveMovement(rows, snapshot, PRIZE_LINE, null);
    expect(out[0]?.delta).toBeNull();
    expect(out[0]?.isNew).toBe(false);
  });
});

describe("deriveMovement and the prize line", () => {
  it("flags a reader who crossed into the prize zone", () => {
    const rows = [row({ participant_id: "p1", rank: 14 })];
    const out = deriveMovement(rows, [{ participant_id: "p1", rank: 16 }], PRIZE_LINE, null);
    expect(out[0]?.crossedIntoPrize).toBe(true);
    expect(out[0]?.ejectedFromPrize).toBe(false);
  });

  it("flags a reader who fell out of the prize zone", () => {
    const rows = [row({ participant_id: "p1", rank: 16 })];
    const out = deriveMovement(rows, [{ participant_id: "p1", rank: 14 }], PRIZE_LINE, null);
    expect(out[0]?.ejectedFromPrize).toBe(true);
    expect(out[0]?.crossedIntoPrize).toBe(false);
  });

  it("treats the cut as inclusive — rank equal to the line is inside", () => {
    const rows = [row({ participant_id: "p1", rank: 15 })];
    const out = deriveMovement(rows, [{ participant_id: "p1", rank: 16 }], PRIZE_LINE, null);
    expect(out[0]?.crossedIntoPrize).toBe(true);
  });

  it("flags nothing when the challenge has no prize line (friendly challenge)", () => {
    const rows = [row({ participant_id: "p1", rank: 1 })];
    const out = deriveMovement(rows, [{ participant_id: "p1", rank: 20 }], null, null);
    expect(out[0]?.crossedIntoPrize).toBe(false);
    expect(out[0]?.ejectedFromPrize).toBe(false);
    // Movement itself still works — only the money framing disappears.
    expect(out[0]?.delta).toBe(19);
  });
});

describe("deriveMovement viewer context", () => {
  it("marks only the viewer's own row", () => {
    const rows = [row({ participant_id: "p1" }), row({ participant_id: "p2", rank: 2 })];
    const out = deriveMovement(rows, null, PRIZE_LINE, "p2");
    expect(out.map((r) => r.isYou)).toEqual([false, true]);
  });

  it("marks nobody when there is no viewer", () => {
    const rows = [row({ participant_id: "p1" })];
    expect(deriveMovement(rows, null, PRIZE_LINE, null)[0]?.isYou).toBe(false);
  });

  it("coerces total_hours to a number (postgres numeric arrives as a string)", () => {
    const rows = [row({ total_hours: "40.25" as unknown as number })];
    const out = deriveMovement(rows, null, PRIZE_LINE, null);
    expect(out[0]?.total_hours).toBe(40.25);
    expect(typeof out[0]?.total_hours).toBe("number");
  });
});
