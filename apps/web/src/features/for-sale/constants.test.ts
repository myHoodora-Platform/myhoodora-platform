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
