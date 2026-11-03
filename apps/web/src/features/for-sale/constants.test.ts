import { describe, expect, it } from "vitest";
import { listingStatusLabel } from "./constants";

describe("listingStatusLabel", () => {
  it("formats statuses for paid items", () => {
    expect(listingStatusLabel("available", false)).toBe("Available");
    expect(listingStatusLabel("pending", false)).toBe("Pending");
    expect(listingStatusLabel("sold", false)).toBe("Sold");
  });

  it("formats statuses for free giveaway items", () => {
    expect(listingStatusLabel("available", true)).toBe("Available");
    expect(listingStatusLabel("pending", true)).toBe("Pending");
    expect(listingStatusLabel("sold", true)).toBe("Given away");
  });
});

describe("listingStatusTone", () => {
  it("gives each status a fitting colour", async () => {
    const { listingStatusTone } = await import("./constants");
    expect(listingStatusTone("available", false)).toContain("bg-success");
    expect(listingStatusTone("pending", false)).toContain("bg-warning");
    expect(listingStatusTone("sold", false)).toContain("bg-foreground/80");
    expect(listingStatusTone("sold", true)).toContain("bg-primary");
    expect(listingStatusTone("pending", true, "soft")).toContain("bg-warning-soft");
  });
});
