import { describe, expect, it } from "vitest";
import { normalizeNigerianPhone } from "@/lib/phone";

const E164 = "+2348012345678";

describe("normalizeNigerianPhone", () => {
  it("accepts every common way a Nigerian number is typed", () => {
    expect(normalizeNigerianPhone("08012345678").value).toBe(E164);
    expect(normalizeNigerianPhone("+2348012345678").value).toBe(E164);
    expect(normalizeNigerianPhone("2348012345678").value).toBe(E164);
    expect(normalizeNigerianPhone("8012345678").value).toBe(E164);
  });

  it("ignores spaces, dashes and parentheses", () => {
    expect(normalizeNigerianPhone("0801 234 5678").value).toBe(E164);
    expect(normalizeNigerianPhone("(0801)-234-5678").value).toBe(E164);
  });

  it("treats empty input as cleared, not invalid", () => {
    expect(normalizeNigerianPhone("")).toEqual({ value: null });
    expect(normalizeNigerianPhone("   ")).toEqual({ value: null });
  });

  it("rejects a wrong-length local part", () => {
    expect(normalizeNigerianPhone("080123456").error).toBeTruthy();
    expect(normalizeNigerianPhone("080123456789").error).toBeTruthy();
  });

  it("rejects prefixes outside 7/8/9", () => {
    expect(normalizeNigerianPhone("06012345678").error).toBeTruthy();
    expect(normalizeNigerianPhone("01012345678").error).toBeTruthy();
  });

  it("accepts the 7 and 9 prefixes", () => {
    expect(normalizeNigerianPhone("07012345678").value).toBe("+2347012345678");
    expect(normalizeNigerianPhone("09012345678").value).toBe("+2349012345678");
  });

  it("never returns a value alongside an error", () => {
    const bad = normalizeNigerianPhone("06012345678");
    expect(bad.value).toBeNull();
  });
});
