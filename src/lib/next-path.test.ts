import { describe, expect, it } from "vitest";
import { DEFAULT_NEXT, safeNext } from "@/lib/next-path";

describe("safeNext", () => {
  it("allows the challenge paths the join funnel uses", () => {
    expect(safeNext("/c/exam-flame")).toBe("/c/exam-flame");
    expect(safeNext("/c/exam-flame/leaderboard")).toBe("/c/exam-flame/leaderboard");
    expect(safeNext("/c/code-habit-2027/submit")).toBe("/c/code-habit-2027/submit");
    expect(safeNext("/c/exam-flame/you")).toBe("/c/exam-flame/you");
    expect(safeNext("/challenges")).toBe("/challenges");
    expect(safeNext("/leaderboard")).toBe("/leaderboard");
  });

  it("falls back when nothing was supplied", () => {
    expect(safeNext(undefined)).toBe(DEFAULT_NEXT);
    expect(safeNext(null)).toBe(DEFAULT_NEXT);
    expect(safeNext("")).toBe(DEFAULT_NEXT);
    expect(safeNext("   ")).toBe(DEFAULT_NEXT);
  });

  // The reason this function exists: an unchecked ?next= is an open redirect.
  // A crafted link would take someone through Forge's sign-in and deposit them
  // on another site with a session freshly established.
  it("refuses absolute URLs to other sites", () => {
    for (const hostile of [
      "https://evil.example/steal",
      "http://evil.example",
      "//evil.example",
      "///evil.example",
      "https://forge.example.evil/c/exam-flame",
    ]) {
      expect(safeNext(hostile)).toBe(DEFAULT_NEXT);
    }
  });

  it("refuses paths outside the funnel", () => {
    for (const path of [
      "/admin/users",
      "/admin",
      "/settings",
      "/c/exam-flame/readers/some-uuid",
      "/c/exam-flame/leaderboard/all",
    ]) {
      expect(safeNext(path)).toBe(DEFAULT_NEXT);
    }
  });

  it("refuses a malformed slug rather than trusting the shape", () => {
    for (const path of [
      "/c/Exam-Flame", // uppercase is not a real slug
      "/c/exam--flame", // double hyphen
      "/c/exam flame",
      "/c//leaderboard",
      "/c/exam-flame/../admin",
      "/c/exam-flame/submit/extra",
    ]) {
      expect(safeNext(path)).toBe(DEFAULT_NEXT);
    }
  });

  it("refuses a path with a query or fragment smuggled in", () => {
    expect(safeNext("/c/exam-flame?x=1")).toBe(DEFAULT_NEXT);
    expect(safeNext("/c/exam-flame#f")).toBe(DEFAULT_NEXT);
  });
});
