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

  // --- The Marks bug, pinned as current behaviour. ---
  // Phase 2.2 makes eligibility rank-based, after which BOTH of these invert:
  // a tied reader ranked above you becomes markable, and a field at 0 hours
  // stops being completely frozen. These tests are the tripwire that proves
  // the change was deliberate.
  describe("hours-based gate (to be replaced in Phase 2.2)", () => {
    it("currently refuses a tied reader even when they rank above you", () => {
      const tied = reader({ participant_id: "t", rank: 4, total_hours: 40 });
      expect(markEligibility(viewer, tied, 0, false).canMark).toBe(false);
    });

    it("currently freezes the whole field before anyone has confirmed hours", () => {
      const a = reader({ participant_id: "a", rank: 1, total_hours: 0 });
      const b = reader({ participant_id: "b", rank: 2, total_hours: 0 });
      expect(markEligibility(b, a, 0, false).canMark).toBe(false);
    });
  });
});
