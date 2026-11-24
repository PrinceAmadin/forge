import { describe, expect, it } from "vitest";
import {
  acceptsSubmissions,
  isBoardPublic,
  isJoinable,
  isReadOnly,
  parseRules,
  parseTerms,
  paysCash,
  prizeLine,
  prizePool,
  rewardKind,
  tierSeats,
} from "@/lib/challenge";
import type { Challenge, ChallengeStatus, PrizeTier } from "@/lib/types";

const EXAM_FLAME_PRIZES: PrizeTier[] = [
  { position: 1, amount: 20000, label: "I" },
  { position: 2, amount: 15000, label: "II" },
  { position: 3, amount: 10000, label: "III" },
  { positions: [4, 15], amount: 5000, label: "IV–XV" },
];

function challenge(over: Partial<Challenge> = {}): Challenge {
  return {
    id: "c1",
    slug: "exam-flame",
    name: "The Exam Flame",
    description: null,
    rules: null,
    start_date: "2026-06-17",
    end_date: "2026-07-06",
    duration_days: 20,
    prize_structure: EXAM_FLAME_PRIZES,
    prize_line_position: 15,
    status: "active",
    timezone: "Africa/Lagos",
    daily_hour_ceiling: 24,
    submission_window_hrs: 36,
    ...over,
  };
}

const ALL_STATUSES: ChallengeStatus[] = [
  "draft",
  "active",
  "verification",
  "completed",
  "archived",
];

describe("lifecycle predicates", () => {
  it("accepts submissions and joins only while active", () => {
    for (const status of ALL_STATUSES) {
      const c = challenge({ status });
      expect(acceptsSubmissions(c)).toBe(status === "active");
      expect(isJoinable(c)).toBe(status === "active");
    }
  });

  it("keeps the board public from active through completed", () => {
    const expected: Record<ChallengeStatus, boolean> = {
      draft: false,
      active: true,
      verification: true,
      completed: true,
      archived: false,
    };
    for (const status of ALL_STATUSES) {
      expect(isBoardPublic(challenge({ status }))).toBe(expected[status]);
    }
  });

  it("is read-only only once archived", () => {
    for (const status of ALL_STATUSES) {
      expect(isReadOnly(challenge({ status }))).toBe(status === "archived");
    }
  });
});

describe("tierSeats", () => {
  it("counts a single position as one seat", () => {
    expect(tierSeats({ position: 1, amount: 20000, label: "I" })).toBe(1);
  });

  it("counts an inclusive range", () => {
    expect(tierSeats({ positions: [4, 15], amount: 5000, label: "IV–XV" })).toBe(12);
    expect(tierSeats({ positions: [7, 7], amount: 100, label: "VII" })).toBe(1);
  });
});

describe("prizePool", () => {
  it("totals the real Exam Flame structure", () => {
    // 20000 + 15000 + 10000 + (5000 x 12) = 105000
    expect(prizePool(challenge())).toBe(105000);
  });

  it("is zero for an empty structure", () => {
    expect(prizePool(challenge({ prize_structure: [] }))).toBe(0);
  });

  it("is zero for a friendly challenge even if tiers somehow carry amounts", () => {
    // reward_kind is the authority, so a leftover structure cannot resurrect
    // money in the UI of a challenge that pays nothing.
    expect(prizePool(challenge({ reward_kind: "none" }))).toBe(0);
  });

  it("is zero for a custom-reward challenge", () => {
    expect(prizePool(challenge({ reward_kind: "custom" }))).toBe(0);
  });

  it("treats a tier with no amount as contributing nothing", () => {
    const c = challenge({
      prize_structure: [
        { position: 1, amount: 5000, label: "I" },
        { position: 2, label: "II", note: "A trophy" },
      ],
    });
    expect(prizePool(c)).toBe(5000);
  });
});

describe("rewardKind and paysCash", () => {
  it("defaults to cash when the column is absent", () => {
    // Every row that predates migration 0015 is a cash challenge.
    expect(rewardKind(challenge())).toBe("cash");
    expect(paysCash(challenge())).toBe(true);
  });

  it("honours an explicit kind", () => {
    expect(rewardKind(challenge({ reward_kind: "none" }))).toBe("none");
    expect(paysCash(challenge({ reward_kind: "none" }))).toBe(false);
    expect(paysCash(challenge({ reward_kind: "custom" }))).toBe(false);
  });
});

describe("prizeLine", () => {
  it("returns the configured cut", () => {
    expect(prizeLine(challenge())).toBe(15);
  });

  it("is null when there is no cut, so the board draws no divider", () => {
    const noCut = { ...challenge(), prize_line_position: null } as unknown as Challenge;
    expect(prizeLine(noCut)).toBeNull();
  });

  it("treats a nonsensical cut as no cut", () => {
    expect(prizeLine(challenge({ prize_line_position: 0 }))).toBeNull();
  });

  // A friendly challenge can still draw an honours line: the cut and the money
  // are independent from here on.
  it("keeps a cut on a challenge that pays nothing", () => {
    const honours = challenge({ reward_kind: "none", prize_line_position: 20 });
    expect(prizeLine(honours)).toBe(20);
    expect(prizePool(honours)).toBe(0);
  });
});

describe("parseRules", () => {
  it("splits lines and strips stored numbering", () => {
    expect(parseRules("1. Submit daily\n2. Evidence required")).toEqual([
      "Submit daily",
      "Evidence required",
    ]);
  });

  it("drops blank lines and trims", () => {
    expect(parseRules("  One  \n\n\n  Two ")).toEqual(["One", "Two"]);
  });

  it("returns an empty list for null or empty input", () => {
    expect(parseRules(null)).toEqual([]);
    expect(parseRules(undefined)).toEqual([]);
    expect(parseRules("")).toEqual([]);
  });
});

describe("parseTerms", () => {
  it("preserves the text verbatim, unlike rules", () => {
    // Terms are the acceptance contract; a leading number is part of the text.
    expect(parseTerms("1. I understand evidence is required")).toEqual([
      "1. I understand evidence is required",
    ]);
  });

  it("drops blanks and returns empty for null", () => {
    expect(parseTerms(" A \n\n B ")).toEqual(["A", "B"]);
    expect(parseTerms(null)).toEqual([]);
  });
});
