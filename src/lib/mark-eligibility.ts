import type { Challenge, RankedRow } from "@/lib/types";

export const MAX_ACTIVE_MARKS = 3;

export interface MarkEligibility {
  canMark: boolean;
  reason?: string;
}

export function marksEnabled(c: Challenge): boolean {
  return c.marks_enabled === true;
}

// The mark rules, kept free of any database import so they can be unit-tested
// and so the UI check and the server action share one definition. The DB-side
// guard is the marks_enforce_above trigger; the two must agree.
//
// "Above you" means RANKED above you, not holding more hours.
//
// It was hours-based, and that is why the feature appeared dead when it was
// switched on: `target.total_hours > viewer.total_hours` is false for everyone
// at 0 confirmed hours (so the entire field is frozen at the start of a
// challenge) and false for every tie — and in an "8 hours a day" challenge
// totals cluster hard on round numbers, so ties are the norm. Worse, a reader
// genuinely ranked above you on the board could be unmarkable, because the
// board breaks ties on verified_days and earliest_submission while that check
// ignored both.
//
// Rank already encodes the full ordering, so comparing it is both correct and
// simpler.
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
  if (!(target.rank < viewer.rank)) {
    return { canMark: false, reason: "You can only mark a reader ranked above you." };
  }
  if (viewerActiveCount >= MAX_ACTIVE_MARKS) {
    return {
      canMark: false,
      reason: `You're at your limit of ${MAX_ACTIVE_MARKS} marks. Release one first.`,
    };
  }
  return { canMark: true };
}
