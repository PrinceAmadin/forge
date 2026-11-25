import { describe, expect, it } from "vitest";
import {
  MAX_ACTIVE_MARKS,
  markEligibility,
  marksEnabled,
} from "@/lib/mark-eligibility";
import type { Challenge, RankedRow } from "@/lib/types";

function reader(over: Partial<RankedRow> = {}): RankedRow {
  return {
    rank: 10,
    participant_id: "viewer",
    full_name: "Ada Reader",
    course: "Law",
    hall_name: null,
    verified_days: 5,
    total_hours: 40,
    earliest_submission: null,
    last_submission: null,
    is_disqualified: false,
    delta: null,
    isNew: false,
    isYou: false,
    crossedIntoPrize: false,
    ejectedFromPrize: false,
    ...over,
  };
}

const viewer = reader({ participant_id: "viewer", rank: 10, total_hours: 40 });
const above = reader({ participant_id: "target", rank: 4, total_hours: 60 });

describe("marksEnabled", () => {
  it("is off unless the column is explicitly true", () => {
    const base = { marks_enabled: undefined } as unknown as Challenge;
    expect(marksEnabled(base)).toBe(false);
    expect(marksEnabled({ ...base, marks_enabled: false })).toBe(false);
    expect(marksEnabled({ ...base, marks_enabled: true })).toBe(true);
  });
});

describe("markEligibility", () => {
  it("allows marking a reader clearly above you", () => {
    expect(markEligibility(viewer, above, 0, false)).toEqual({ canMark: true });
  });

  it("refuses when standings have not loaded", () => {
    expect(markEligibility(undefined, above, 0, false).canMark).toBe(false);
    expect(markEligibility(viewer, undefined, 0, false).canMark).toBe(false);
  });

  it("refuses self-marking, and says nothing about it", () => {
    const result = markEligibility(viewer, viewer, 0, false);
    expect(result.canMark).toBe(false);
    // No reason string: the button is simply absent on your own profile.
    expect(result.reason).toBeUndefined();
  });

  it("refuses a disqualified target", () => {
    const out = markEligibility(viewer, reader({ participant_id: "t", total_hours: 60, is_disqualified: true }), 0, false);
    expect(out.canMark).toBe(false);
    expect(out.reason).toMatch(/out of the running/i);
  });

  it("refuses a duplicate mark", () => {
    expect(markEligibility(viewer, above, 0, true).reason).toMatch(/already marking/i);
  });

  it(`refuses past ${MAX_ACTIVE_MARKS} active marks`, () => {
    expect(markEligibility(viewer, above, MAX_ACTIVE_MARKS, false).canMark).toBe(false);
    expect(markEligibility(viewer, above, MAX_ACTIVE_MARKS - 1, false).canMark).toBe(true);
  });

  it("refuses a target below you", () => {
    const below = reader({ participant_id: "t", rank: 20, total_hours: 10 });
    expect(markEligibility(viewer, below, 0, false).reason).toMatch(/ranked above you/i);
  });

  // --- The Marks bug, now fixed. ---
  // Eligibility compares RANK. These two cases are why the feature did nothing
  // when it was switched on during a live challenge: the old test was
  // `target.total_hours > viewer.total_hours`, which is false for every tie and
  // false for the entire field while everyone sits at 0 confirmed hours.
  describe("rank-based gate", () => {
    it("allows marking a reader tied on hours but ranked above you", () => {
      // The board breaks ties on verified_days then earliest_submission, so
      // equal hours does NOT mean equal standing. The old hours comparison
      // ignored that and refused.
      const tied = reader({ participant_id: "t", rank: 4, total_hours: 40 });
      expect(markEligibility(viewer, tied, 0, false)).toEqual({ canMark: true });
    });

    it("works before anyone has confirmed hours", () => {
      // Day one: everyone on 0 hours, ranks already assigned. Previously this
      // froze every mark button on the site.
      const a = reader({ participant_id: "a", rank: 1, total_hours: 0 });
      const b = reader({ participant_id: "b", rank: 2, total_hours: 0 });
      expect(markEligibility(b, a, 0, false)).toEqual({ canMark: true });
      // Still one-directional: the leader cannot mark downward.
      expect(markEligibility(a, b, 0, false).canMark).toBe(false);
    });

    it("refuses someone on identical rank", () => {
      const same = reader({ participant_id: "t", rank: 10, total_hours: 40 });
      expect(markEligibility(viewer, same, 0, false).canMark).toBe(false);
    });

    it("ignores hours entirely — rank is the only ordering that counts", () => {
      // Ranked above despite FEWER hours is impossible on a real board, but if
      // the two ever disagree, rank wins. Pinning it stops a future refactor
      // quietly reintroducing the hours comparison.
      const oddlyAbove = reader({ participant_id: "t", rank: 2, total_hours: 1 });
      expect(markEligibility(viewer, oddlyAbove, 0, false)).toEqual({ canMark: true });
    });
  });
});
