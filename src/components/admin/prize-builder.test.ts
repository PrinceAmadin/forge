import { describe, expect, it } from "vitest";
import {
  emptyTier,
  normaliseTiers,
  tierRowTotal,
  type TierRow,
} from "@/components/admin/prize-builder";
import { prizeTiers } from "@/lib/validation/challenge";

function row(to: number, amount = "1000"): TierRow {
  return { from: 0, to, amount, label: "X", note: "" };
}

describe("normaliseTiers", () => {
  it("numbers a single tier from 1", () => {
    expect(normaliseTiers([row(1)])[0]).toMatchObject({ from: 1, to: 1 });
  });

  it("chains each tier to start where the previous one ended", () => {
    const out = normaliseTiers([row(1), row(2), row(3), row(15)]);
    expect(out.map((t) => [t.from, t.to])).toEqual([
      [1, 1],
      [2, 2],
      [3, 3],
      [4, 15],
    ]);
  });

  it("repairs a `to` that is below its own `from`", () => {
    // Author typed 2 into the last tier of a run that already reached 5.
    const out = normaliseTiers([row(5), row(2)]);
    expect(out[1]).toMatchObject({ from: 6, to: 6 });
  });

  it("survives a non-finite `to` while the field is mid-edit", () => {
    const out = normaliseTiers([{ ...row(1), to: Number.NaN }]);
    expect(out[0]).toMatchObject({ from: 1, to: 1 });
  });

  it("absorbs the vacated position when a middle tier is dropped", () => {
    // Tiers I/II/III each paying one position; drop II.
    const full = normaliseTiers([row(1), row(2), row(3)]);
    const without = normaliseTiers([full[0]!, full[2]!]);
    // The surviving tier widens to 2–3 rather than leaving position 2 winning
    // nothing. Keeping the run contiguous is this function's whole job, so
    // absorbing beats shrinking — shrinking would silently drop position 3 off
    // the prize list instead.
    expect(without.map((t) => [t.from, t.to])).toEqual([
      [1, 1],
      [2, 3],
    ]);
    // Either way the invariant holds: no gap, no overlap, starts at 1.
    expect(prizeTiers.safeParse(
      without.map((t) => ({ from: t.from, to: t.to, amount: 1, label: t.label }))
    ).success).toBe(true);
  });

  // The guarantee that matters: whatever the editor does, the result is a
  // contiguous run starting at 1 — which is exactly what the server-side schema
  // demands. If these two ever disagree, the form becomes unsubmittable.
  it("always produces a structure the server schema accepts", () => {
    const shapes: TierRow[][] = [
      [row(1)],
      [row(1), row(2), row(3), row(15)],
      [row(5), row(2)],
      [row(3), row(3), row(3)],
      [{ ...row(1), to: Number.NaN }, row(9)],
    ];
    for (const shape of shapes) {
      const normalised = normaliseTiers(shape).map((t) => ({
        from: t.from,
        to: t.to,
        amount: Number(t.amount),
        label: t.label,
      }));
      const result = prizeTiers.safeParse(normalised);
      expect(result.success, JSON.stringify(normalised)).toBe(true);
    }
  });
});

describe("tierRowTotal", () => {
  it("multiplies the amount by the number of seats", () => {
    expect(tierRowTotal({ from: 4, to: 15, amount: "5000", label: "", note: "" })).toBe(60000);
    expect(tierRowTotal({ from: 1, to: 1, amount: "20000", label: "", note: "" })).toBe(20000);
  });

  it("counts a blank amount as nothing rather than NaN", () => {
    expect(tierRowTotal({ from: 1, to: 1, amount: "", label: "", note: "" })).toBe(0);
  });

  it("reproduces the real Exam Flame pool", () => {
    const tiers = normaliseTiers([row(1, "20000"), row(2, "15000"), row(3, "10000"), row(15, "5000")]);
    expect(tiers.reduce((sum, t) => sum + tierRowTotal(t), 0)).toBe(105000);
  });
});

describe("emptyTier", () => {
  it("labels a new tier with its roman numeral", () => {
    expect(emptyTier(4)).toMatchObject({ from: 4, to: 4, label: "IV", amount: "" });
  });
});
