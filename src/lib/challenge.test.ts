import { describe, expect, it } from "vitest";
import {
  currentChallengeDay,
  dateInTz,
  dayIsOpen,
  submittableDay,
} from "@/lib/challenge";
import type { Challenge } from "@/lib/types";

// The Exam Flame's real shape: 20 days, Africa/Lagos (UTC+1, no DST).
function challenge(over: Partial<Challenge> = {}): Challenge {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    slug: "exam-flame",
    name: "The Exam Flame",
    description: null,
    rules: null,
    start_date: "2026-06-17",
    end_date: "2026-07-06",
    duration_days: 20,
    prize_structure: [],
    prize_line_position: 15,
    status: "active",
    timezone: "Africa/Lagos",
    daily_hour_ceiling: 24,
    submission_window_hrs: 36,
    ...over,
  };
}

describe("dateInTz", () => {
  it("returns the Lagos calendar date, not the UTC one", () => {
    // 23:30 UTC is already 00:30 the next day in Lagos (UTC+1).
    expect(dateInTz("Africa/Lagos", new Date("2026-06-17T23:30:00Z"))).toBe("2026-06-18");
    expect(dateInTz("Africa/Lagos", new Date("2026-06-17T22:30:00Z"))).toBe("2026-06-17");
  });

  it("formats as YYYY-MM-DD so string comparison is date comparison", () => {
    expect(dateInTz("Africa/Lagos", new Date("2026-01-05T12:00:00Z"))).toBe("2026-01-05");
  });
});

describe("currentChallengeDay", () => {
  it("is 1 on the start date", () => {
    expect(currentChallengeDay(challenge(), new Date("2026-06-17T09:00:00Z"))).toBe(1);
  });

  it("rolls to day 1 at Lagos midnight, not UTC midnight", () => {
    // 23:30 UTC on the 16th is 00:30 Lagos on the 17th — the challenge has started.
    expect(currentChallengeDay(challenge(), new Date("2026-06-16T23:30:00Z"))).toBe(1);
    // 22:00 UTC on the 16th is still the 16th in Lagos — it has not.
    expect(currentChallengeDay(challenge(), new Date("2026-06-16T22:00:00Z"))).toBe(0);
  });

  it("is 0 before the challenge starts", () => {
    expect(currentChallengeDay(challenge(), new Date("2026-06-10T09:00:00Z"))).toBe(0);
  });

  it("is the duration on the final day", () => {
    expect(currentChallengeDay(challenge(), new Date("2026-07-06T09:00:00Z"))).toBe(20);
  });

  it("exceeds the duration after the challenge ends", () => {
    expect(currentChallengeDay(challenge(), new Date("2026-07-07T09:00:00Z"))).toBe(21);
  });
});

describe("submittableDay", () => {
  it("returns the current day inside the window", () => {
    expect(submittableDay(challenge(), new Date("2026-06-21T09:00:00Z"))).toBe(5);
  });

  it("is null before the start and after the end", () => {
    expect(submittableDay(challenge(), new Date("2026-06-10T09:00:00Z"))).toBeNull();
    expect(submittableDay(challenge(), new Date("2026-07-07T09:00:00Z"))).toBeNull();
  });

  it("is non-null late on the last day", () => {
    // 20:00 UTC is 21:00 Lagos on the 6th — still day 20.
    expect(submittableDay(challenge(), new Date("2026-07-06T20:00:00Z"))).toBe(20);
  });

  it("closes at Lagos midnight, so 23:00 UTC on the last day is already too late", () => {
    // 23:00 UTC on the 6th is 00:00 Lagos on the 7th → day 21, out of range.
    // Worth pinning: the window shuts an hour before UTC midnight, which is
    // not what someone reading the dates alone would assume.
    expect(submittableDay(challenge(), new Date("2026-07-06T23:00:00Z"))).toBeNull();
  });
});

describe("dayIsOpen", () => {
  const now = new Date("2026-06-21T09:00:00Z"); // day 5

  it("accepts today and yesterday", () => {
    expect(dayIsOpen(challenge(), 5, now)).toBe(true);
    expect(dayIsOpen(challenge(), 4, now)).toBe(true);
  });

  it("rejects older days and future days", () => {
    expect(dayIsOpen(challenge(), 3, now)).toBe(false);
    expect(dayIsOpen(challenge(), 6, now)).toBe(false);
  });

  // Documents a known divergence rather than asserting it is correct:
  // challenges.submission_window_hrs defaults to 36 and is read by nothing.
  // dayIsOpen implements "today or yesterday", which is 24-48h depending on
  // the hour. Spec §10 describes a 48h window. If submission_window_hrs is
  // ever honoured, this test is the one that must change.
  it("ignores submission_window_hrs entirely (known divergence)", () => {
    const tight = challenge({ submission_window_hrs: 1 });
    expect(dayIsOpen(tight, 4, now)).toBe(true);
  });
});
