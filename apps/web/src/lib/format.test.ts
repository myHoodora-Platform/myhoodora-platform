import { describe, expect, it } from "vitest";
import { formatDistance } from "./format";

describe("formatDistance", () => {
  it("rounds short distances to the nearest 50 m", () => {
    expect(formatDistance(847)).toBe("about 850 m away");
    expect(formatDistance(12)).toBe("about 50 m away");
  });

  it("uses one decimal of km from 1 km, without a trailing .0", () => {
    expect(formatDistance(1420)).toBe("about 1.4 km away");
    expect(formatDistance(3000)).toBe("about 3 km away");
  });
});
