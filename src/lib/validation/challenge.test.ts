import { describe, expect, it } from "vitest";
import {
  challengeCreate,
  editableFields,
  fromPrizeStructureJson,
  lastCoveredPosition,
  prizeTiers,
  toPrizeStructureJson,
  type PrizeTierInput,
} from "@/lib/validation/challenge";
import { firstError, parseForm } from "@/lib/validation/form";

// The real Exam Flame structure: 1, 2, 3 then 4-15.
const EXAM_FLAME: PrizeTierInput[] = [
  { from: 1, to: 1, amount: 20000, label: "I" },
  { from: 2, to: 2, amount: 15000, label: "II" },
  { from: 3, to: 3, amount: 10000, label: "III" },
  { from: 4, to: 15, amount: 5000, label: "IV–XV" },
];

function challengeInput(over: Record<string, unknown> = {}) {
  return {
    slug: "exam-flame-2",
    name: "The Exam Flame II",
    start_date: "2027-01-10",
    end_date: "2027-01-29",
    prize_line_position: 15,
    prize_structure: EXAM_FLAME,
    ...over,
  };
}

describe("prizeTiers invariants", () => {
  it("accepts a contiguous run starting at 1", () => {
    expect(prizeTiers.safeParse(EXAM_FLAME).success).toBe(true);
  });

  it("accepts an empty list (a challenge may award nothing)", () => {
    expect(prizeTiers.safeParse([]).success).toBe(true);
  });

  it("rejects a run that does not start at position 1", () => {
    const r = prizeTiers.safeParse([{ from: 2, to: 3, amount: 100, label: "II" }]);
    expect(r.success).toBe(false);
    expect(JSON.stringify(r.error?.issues)).toMatch(/must start at position 1/);
  });

  it("rejects a gap, naming the unawarded position", () => {
    const r = prizeTiers.safeParse([
      { from: 1, to: 2, amount: 100, label: "A" },
      { from: 4, to: 5, amount: 50, label: "B" }, // position 3 wins nothing
    ]);
    expect(r.success).toBe(false);
    expect(JSON.stringify(r.error?.issues)).toMatch(/leaves position 3 unawarded/);
  });

  it("rejects an overlap", () => {
    const r = prizeTiers.safeParse([
      { from: 1, to: 5, amount: 100, label: "A" },
      { from: 3, to: 8, amount: 50, label: "B" },
    ]);
    expect(r.success).toBe(false);
    expect(JSON.stringify(r.error?.issues)).toMatch(/overlaps/);
  });

  it("rejects a reversed range", () => {
    const r = prizeTiers.safeParse([{ from: 5, to: 2, amount: 100, label: "A" }]);
    expect(r.success).toBe(false);
  });

  it("validates regardless of the order rows arrive in", () => {
    const shuffled = [EXAM_FLAME[3]!, EXAM_FLAME[0]!, EXAM_FLAME[2]!, EXAM_FLAME[1]!];
    expect(prizeTiers.safeParse(shuffled).success).toBe(true);
  });

  it("requires a label", () => {
    expect(prizeTiers.safeParse([{ from: 1, to: 1, amount: 100, label: "" }]).success).toBe(false);
  });

  it("allows a tier with no amount (a non-cash reward)", () => {
    const r = prizeTiers.safeParse([{ from: 1, to: 1, label: "I", note: "A trophy" }]);
    expect(r.success).toBe(true);
  });
});

describe("lastCoveredPosition", () => {
  it("is the highest position any tier covers", () => {
    expect(lastCoveredPosition(EXAM_FLAME)).toBe(15);
  });

  it("is 0 for no tiers", () => {
    expect(lastCoveredPosition([])).toBe(0);
  });
});

describe("prize structure conversion", () => {
  it("collapses a single position and keeps a range", () => {
    expect(toPrizeStructureJson(EXAM_FLAME)).toEqual([
      { label: "I", amount: 20000, position: 1 },
      { label: "II", amount: 15000, position: 2 },
      { label: "III", amount: 10000, position: 3 },
      { label: "IV–XV", amount: 5000, positions: [4, 15] },
    ]);
  });

  it("round-trips through the stored shape", () => {
    expect(fromPrizeStructureJson(toPrizeStructureJson(EXAM_FLAME))).toEqual(EXAM_FLAME);
  });

  it("omits amount entirely for a non-cash tier, rather than writing null", () => {
    const json = toPrizeStructureJson([{ from: 1, to: 1, label: "I", note: "A trophy" }]);
    expect(json[0]).toEqual({ label: "I", note: "A trophy", position: 1 });
    expect("amount" in json[0]!).toBe(false);
  });

  it("sorts output even when input is unsorted", () => {
    const json = toPrizeStructureJson([EXAM_FLAME[3]!, EXAM_FLAME[0]!]);
    expect(json[0]).toMatchObject({ position: 1 });
  });
});

describe("challengeCreate — cash challenges", () => {
  it("accepts a well-formed cash challenge", () => {
    const r = challengeCreate.safeParse(challengeInput());
    expect(r.success).toBe(true);
    expect(r.data?.reward_kind).toBe("cash");
    expect(r.data?.timezone).toBe("Africa/Lagos");
    expect(r.data?.daily_hour_ceiling).toBe(24);
  });

  it("requires the cut to equal the last paid position", () => {
    const r = challengeCreate.safeParse(challengeInput({ prize_line_position: 10 }));
    expect(r.success).toBe(false);
    expect(JSON.stringify(r.error?.issues)).toMatch(/must be 15/);
  });

  it("requires at least one tier", () => {
    const r = challengeCreate.safeParse(
      challengeInput({ prize_structure: [], prize_line_position: 1 })
    );
    expect(r.success).toBe(false);
    expect(JSON.stringify(r.error?.issues)).toMatch(/needs at least one prize tier/);
  });

  it("requires every tier to carry an amount", () => {
    const r = challengeCreate.safeParse(
      challengeInput({
        prize_structure: [
          { from: 1, to: 1, amount: 100, label: "I" },
          { from: 2, to: 2, label: "II" },
        ],
        prize_line_position: 2,
      })
    );
    expect(r.success).toBe(false);
    expect(JSON.stringify(r.error?.issues)).toMatch(/needs an amount/);
  });
});

describe("challengeCreate — friendly and custom challenges", () => {
  it("accepts a friendly challenge with no tiers and an honours line", () => {
    const r = challengeCreate.safeParse(
      challengeInput({
        reward_kind: "none",
        prize_structure: [],
        prize_line_position: 20,
      })
    );
    expect(r.success).toBe(true);
    // The cut survives without money behind it.
    expect(r.data?.prize_line_position).toBe(20);
  });

  it("accepts a custom-reward challenge with notes instead of amounts", () => {
    const r = challengeCreate.safeParse(
      challengeInput({
        reward_kind: "custom",
        prize_structure: [{ from: 1, to: 1, label: "I", note: "A trophy" }],
        prize_line_position: 1,
        prize_note: "Winner takes the trophy",
      })
    );
    expect(r.success).toBe(true);
  });

  it("refuses amounts on a challenge that pays nothing", () => {
    const r = challengeCreate.safeParse(
      challengeInput({ reward_kind: "none", prize_line_position: 15 })
    );
    expect(r.success).toBe(false);
    expect(JSON.stringify(r.error?.issues)).toMatch(/Remove the amounts/);
  });

  it("does not force the cut to match tiers when there are none", () => {
    // The cash-only assertion must not leak into the friendly path.
    const r = challengeCreate.safeParse(
      challengeInput({ reward_kind: "none", prize_structure: [], prize_line_position: 3 })
    );
    expect(r.success).toBe(true);
  });
});

describe("challengeCreate — dates and slug", () => {
  it("rejects an end date before the start date", () => {
    const r = challengeCreate.safeParse(
      challengeInput({ start_date: "2027-02-01", end_date: "2027-01-01" })
    );
    expect(r.success).toBe(false);
    expect(JSON.stringify(r.error?.issues)).toMatch(/end date is before/);
  });

  it("allows a single-day challenge", () => {
    const r = challengeCreate.safeParse(
      challengeInput({ start_date: "2027-02-01", end_date: "2027-02-01" })
    );
    expect(r.success).toBe(true);
  });

  it("normalises the slug to lowercase", () => {
    const r = challengeCreate.safeParse(challengeInput({ slug: "Code-Habit" }));
    expect(r.data?.slug).toBe("code-habit");
  });

  it("rejects slugs that are not clean kebab-case", () => {
    for (const slug of ["has space", "Trailing-", "double--hyphen", "under_score", "ab"]) {
      expect(challengeCreate.safeParse(challengeInput({ slug })).success).toBe(false);
    }
  });

  it("rejects reserved slugs that would be confusing in a URL", () => {
    for (const slug of ["new", "admin", "settings", "challenges"]) {
      expect(challengeCreate.safeParse(challengeInput({ slug })).success).toBe(false);
    }
  });
});

describe("editableFields", () => {
  it("lets a draft change anything, including its identity", () => {
    const f = editableFields("draft");
    expect(f.has("slug")).toBe(true);
    expect(f.has("start_date")).toBe(true);
    expect(f.has("prize_structure")).toBe(true);
  });

  it("freezes identity and contract once a challenge is live", () => {
    const f = editableFields("active");
    // Renaming the slug would orphan every uploaded screenshot.
    expect(f.has("slug")).toBe(false);
    // Shifting the start date would remap every stored challenge_day.
    expect(f.has("start_date")).toBe(false);
    expect(f.has("timezone")).toBe(false);
    // Participants accepted the terms against these numbers.
    expect(f.has("prize_structure")).toBe(false);
    expect(f.has("prize_line_position")).toBe(false);
    // Copy and flags stay editable, and the end date may be extended.
    expect(f.has("name")).toBe(true);
    expect(f.has("rules")).toBe(true);
    expect(f.has("end_date")).toBe(true);
  });

  it("freezes everything once archived", () => {
    expect(editableFields("archived").size).toBe(0);
  });
});

describe("parseForm", () => {
  it("validates a real FormData, coercing strings and parsing the JSON field", () => {
    const fd = new FormData();
    fd.set("slug", "code-habit");
    fd.set("name", "Code Habit");
    fd.set("start_date", "2027-03-01");
    fd.set("end_date", "2027-03-20");
    fd.set("prize_line_position", "3"); // a string, as every form field is
    fd.set("prize_structure", JSON.stringify([{ from: 1, to: 3, amount: 1000, label: "I–III" }]));

    const result = parseForm(challengeCreate, fd);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.prize_line_position).toBe(3);
      expect(result.value.prize_structure[0]?.amount).toBe(1000);
    }
  });

  it("treats blank optional text as absent rather than as an empty value", () => {
    const fd = new FormData();
    fd.set("slug", "code-habit");
    fd.set("name", "Code Habit");
    fd.set("start_date", "2027-03-01");
    fd.set("end_date", "2027-03-20");
    fd.set("prize_line_position", "1");
    fd.set("prize_structure", JSON.stringify([{ from: 1, to: 1, amount: 500, label: "I" }]));
    fd.set("description", "   ");
    fd.set("timezone", ""); // blank must fall back to the default, not fail

    const result = parseForm(challengeCreate, fd);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.description).toBeUndefined();
      expect(result.value.timezone).toBe("Africa/Lagos");
    }
  });

  it("returns per-field errors a form can render", () => {
    const result = parseForm(challengeCreate, { slug: "x", name: "y" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(Object.keys(result.fieldErrors)).toContain("slug");
      expect(Object.keys(result.fieldErrors)).toContain("name");
      expect(firstError(result)).toBeTruthy();
    }
  });

  it("rejects malformed JSON in the prize field without throwing", () => {
    const result = parseForm(challengeCreate, {
      ...challengeInput(),
      prize_structure: "{not json",
    });
    expect(result.ok).toBe(false);
  });
});
