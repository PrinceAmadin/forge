import { describe, expect, it } from "vitest";
import { DEFAULT_NEXT, safeNext } from "@/lib/next-path";

describe("safeNext", () => {
  it("allows the challenge paths the join funnel uses", () => {
    expect(safeNext("/c/exam-flame")).toBe("/c/exam-flame");
    expect(safeNext("/c/exam-flame/leaderboard")).toBe("/c/exam-flame/leaderboard");
    expect(safeNext("/c/code-habit-2027/submit")).toBe("/c/code-habit-2027/submit");
    expect(safeNext("/challenges")).toBe("/challenges");
  });

  // Deliberately permissive about WHICH internal page: every route is already
  // access-controlled server-side, and a route allowlist would silently send
  // an admin following a deep link somewhere they didn't ask for.
  it("allows any internal path, including admin deep links", () => {
    expect(safeNext("/admin/challenges/new")).toBe("/admin/challenges/new");
    expect(safeNext("/settings/profile")).toBe("/settings/profile");
    expect(safeNext("/submissions/abc-123/appeal")).toBe("/submissions/abc-123/appeal");
  });

  it("keeps a query string and fragment", () => {
    expect(safeNext("/c/exam-flame/you?submitted=1")).toBe("/c/exam-flame/you?submitted=1");
    expect(safeNext("/challenges#open")).toBe("/challenges#open");
  });

  it("falls back when nothing was supplied", () => {
    expect(safeNext(undefined)).toBe(DEFAULT_NEXT);
    expect(safeNext(null)).toBe(DEFAULT_NEXT);
    expect(safeNext("")).toBe(DEFAULT_NEXT);
    expect(safeNext("   ")).toBe(DEFAULT_NEXT);
  });

  it("honours a caller-supplied fallback", () => {
    expect(safeNext("https://evil.example", "/challenges")).toBe("/challenges");
  });

  // The reason this function exists.
  it("refuses anything that leaves the origin", () => {
    for (const hostile of [
      "https://evil.example/steal",
      "http://evil.example",
      "//evil.example",
      "///evil.example",
      "https://forge.example.evil/c/exam-flame",
      "javascript:alert(1)",
      "data:text/html,<script>",
      "mailto:someone@example.com",
    ]) {
      expect(safeNext(hostile), hostile).toBe(DEFAULT_NEXT);
    }
  });

  it("refuses backslashes, which browsers normalise to slashes", () => {
    // "/\evil.example" is treated as "//evil.example" by several parsers.
    expect(safeNext("/\\evil.example")).toBe(DEFAULT_NEXT);
    expect(safeNext("/\\/evil.example")).toBe(DEFAULT_NEXT);
  });

  it("refuses traversal and whitespace tricks", () => {
    expect(safeNext("/c/exam-flame/../../admin")).toBe(DEFAULT_NEXT);
    expect(safeNext("/ /evil")).toBe(DEFAULT_NEXT);
    expect(safeNext("/\tfoo")).toBe(DEFAULT_NEXT);
    expect(safeNext("/\nfoo")).toBe(DEFAULT_NEXT);
  });

  it("refuses control characters smuggled into the path", () => {
    expect(safeNext("/foo\u0000bar")).toBe(DEFAULT_NEXT);
    expect(safeNext("/foo\u007f")).toBe(DEFAULT_NEXT);
  });

  it("refuses a path that is not a path", () => {
    expect(safeNext("c/exam-flame")).toBe(DEFAULT_NEXT);
    expect(safeNext("../admin")).toBe(DEFAULT_NEXT);
  });
});
