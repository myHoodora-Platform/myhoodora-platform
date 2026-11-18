import { describe, expect, it } from "vitest";
import { fromLagosInput, lagosLabel, toLagosInput } from "./lagos-time";

describe("Lagos time for seasons", () => {
  it("round-trips the datetime inputs in WAT", () => {
    expect(fromLagosInput("2026-12-15T00:00")).toBe("2026-12-14T23:00:00.000Z");
    expect(toLagosInput("2026-12-14T23:00:00.000Z")).toBe("2026-12-15T00:00");
    expect(fromLagosInput("")).toBeNull();
    expect(toLagosInput(null)).toBe("");
    expect(lagosLabel("2026-12-31T23:00:00.000Z")).toMatch(/1 Jan.*00:00/);
  });
});
