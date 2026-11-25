import { describe, expect, it } from "vitest";
import {
  canTransition,
  launchBlocker,
  nextStatuses,
  transitionWarning,
} from "@/lib/challenge";
import type { Challenge, ChallengeStatus, PrizeTier } from "@/lib/types";

const ALL: ChallengeStatus[] = ["draft", "active", "verification", "completed", "archived"];

const CASH_TIERS: PrizeTier[] = [
  { position: 1, amount: 20000, label: "I" },
  { positions: [2, 10], amount: 5000, label: "II–X" },
];

function challenge(over: Partial<Challenge> = {}): Challenge {
  return {
    id: "c1",
    slug: "exam-flame",
    name: "The Exam Flame",
    description: null,
    rules: null,
    start_date: "2027-01-01",
    end_date: "2027-01-20",
    duration_days: 20,
    prize_structure: CASH_TIERS,
    prize_line_position: 10,
    status: "draft",
    timezone: "Africa/Lagos",
    daily_hour_ceiling: 24,
    submission_window_hrs: 36,
    ...over,
  };
}

describe("nextStatuses", () => {
  it("offers the documented moves and nothing else", () => {
    expect(nextStatuses("draft")).toEqual(["active"]);
    expect(nextStatuses("active")).toEqual(["verification"]);
    expect(nextStatuses("verification")).toEqual(["completed", "active"]);
    expect(nextStatuses("completed")).toEqual(["archived"]);
  });

  it("makes archived terminal — there is no un-archive", () => {
    expect(nextStatuses("archived")).toEqual([]);
  });

  it("never offers a status as its own next step", () => {
    for (const s of ALL) expect(nextStatuses(s)).not.toContain(s);
  });
});

describe("canTransition", () => {
  it("allows exactly one back-edge: verification to active", () => {
    // Reopening a challenge whose day was closed in error.
    expect(canTransition("verification", "active")).toBe(true);
    // Everything else only moves forward.
    expect(canTransition("active", "draft")).toBe(false);
    expect(canTransition("completed", "active")).toBe(false);
    expect(canTransition("archived", "completed")).toBe(false);
  });

  it("refuses skipping a stage", () => {
    expect(canTransition("draft", "completed")).toBe(false);
    expect(canTransition("draft", "archived")).toBe(false);
    expect(canTransition("active", "archived")).toBe(false);
  });

  it("agrees with nextStatuses for every pair", () => {
    for (const from of ALL) {
      for (const to of ALL) {
        expect(canTransition(from, to)).toBe(nextStatuses(from).includes(to));
      }
    }
  });
});

describe("launchBlocker", () => {
  it("clears a properly configured cash challenge", () => {
    expect(launchBlocker(challenge())).toBeNull();
  });

  it("blocks a cash challenge with no tiers", () => {
    expect(launchBlocker(challenge({ prize_structure: [] }))).toMatch(/at least one prize tier/);
  });

  it("blocks a cash challenge with a tier missing its amount", () => {
    const c = challenge({
      prize_structure: [{ position: 1, label: "I" }, { position: 2, amount: 100, label: "II" }],
      prize_line_position: 2,
    });
    expect(launchBlocker(c)).toMatch(/needs an amount/);
  });

  // The whole point of reward_kind: a friendly challenge must be launchable
  // with no prizes at all. If this ever fails, such a challenge can never
  // leave draft.
  it("clears a friendly challenge with no prizes", () => {
    const friendly = challenge({ reward_kind: "none", prize_structure: [], prize_line_position: 20 });
    expect(launchBlocker(friendly)).toBeNull();
  });

  it("clears a custom-reward challenge whose tiers carry notes, not amounts", () => {
    const custom = challenge({
      reward_kind: "custom",
      prize_structure: [{ position: 1, label: "I", note: "A trophy" }],
      prize_line_position: 1,
    });
    expect(launchBlocker(custom)).toBeNull();
  });

  it("blocks any challenge with no cut", () => {
    const noCut = { ...challenge(), prize_line_position: 0 } as Challenge;
    expect(launchBlocker(noCut)).toMatch(/Set the cut/);
  });
});

describe("transitionWarning", () => {
  it("warns that going live locks the challenge's identity", () => {
    expect(transitionWarning("active")).toMatch(/lock/i);
  });

  it("warns that archiving cannot be undone", () => {
    expect(transitionWarning("archived")).toMatch(/cannot be undone/i);
  });

  it("has something to say about every reachable status", () => {
    for (const s of ALL) {
      if (s === "draft") continue; // nothing transitions back into draft
      expect(transitionWarning(s)).toBeTruthy();
    }
  });
});
