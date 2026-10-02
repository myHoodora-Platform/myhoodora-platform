import { describe, expect, it } from "vitest";
import { isValidCacNumber, normaliseNigerianPhone } from "./business";

describe("business sign-up validation", () => {
  it("normalises Nigerian mobile numbers", () => {
    expect(normaliseNigerianPhone("0803 123 4567")).toBe("+2348031234567");
    expect(normaliseNigerianPhone("+234 903 123 4567")).toBe("+2349031234567");
    expect(normaliseNigerianPhone("2347011234567")).toBe("+2347011234567");
    expect(normaliseNigerianPhone("08112345678")).toBe("+2348112345678");
  });

  it("rejects numbers that aren't Nigerian mobiles", () => {
    for (const bad of ["12345", "0603 123 4567", "+44 7911 123456", "080312345"]) {
      expect(normaliseNigerianPhone(bad)).toBeNull();
    }
  });

  it("accepts RC and BN CAC numbers", () => {
    expect(isValidCacNumber("RC123456")).toBe(true);
    expect(isValidCacNumber("bn 1234567")).toBe(true);
    expect(isValidCacNumber("123456")).toBe(false);
  });
});
