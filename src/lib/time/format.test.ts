import { describe, expect, it } from "vitest";
import {
  decimalHoursToHM,
  formatHM,
  hmToDecimalHours,
  normalizeHM,
} from "@/lib/time/format";

describe("decimalHoursToHM", () => {
  it("converts the quarter-hour case the precision migration was written for", () => {
    expect(decimalHoursToHM(7.75)).toEqual({ h: 7, m: 45 });
  });

  it("handles a third of an hour without float drift", () => {
    expect(decimalHoursToHM(1 / 3)).toEqual({ h: 0, m: 20 });
  });

  it("treats zero and non-finite input as zero", () => {
    expect(decimalHoursToHM(0)).toEqual({ h: 0, m: 0 });
    expect(decimalHoursToHM(Number.NaN)).toEqual({ h: 0, m: 0 });
  });
});

describe("hmToDecimalHours", () => {
  it("carries minutes beyond 59 into hours", () => {
    expect(hmToDecimalHours(1, 90)).toBe(2.5);
  });

  it("round-trips every minute of an hour", () => {
    for (let m = 0; m < 60; m++) {
      expect(decimalHoursToHM(hmToDecimalHours(3, m))).toEqual({ h: 3, m });
    }
  });
});

describe("normalizeHM", () => {
  it("normalises minutes into the 0-59 range", () => {
    expect(normalizeHM(1, 90)).toEqual({ h: 2, m: 30 });
    expect(normalizeHM(0, 59)).toEqual({ h: 0, m: 59 });
  });
});

describe("formatHM", () => {
  it("renders compact as clock-style, dropping zero minutes", () => {
    expect(formatHM(7.75, "compact")).toBe("7:45");
    expect(formatHM(8, "compact")).toBe("8");
    // The bare "0" in the /you hero is intentional, not a missing fallback.
    expect(formatHM(0, "compact")).toBe("0");
  });

  it("renders long form narratively", () => {
    expect(formatHM(7.75, "long")).toBe("7h 45m");
    expect(formatHM(8, "long")).toBe("8h");
    expect(formatHM(0.5, "long")).toBe("30m");
    expect(formatHM(0, "long")).toBe("0h");
  });

  it("defaults to compact", () => {
    expect(formatHM(7.75)).toBe("7:45");
  });
});
