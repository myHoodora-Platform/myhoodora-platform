import { groupErrors, groupMeta } from "../groups-api";

describe("group form rules (the API's CreateGroupDto)", () => {
  it("needs a 3–60 character name and a 10–500 character description", () => {
    expect(groupErrors({ name: "ab", description: "short" })).toEqual({
      name: expect.stringContaining("at least 3"),
      description: expect.stringContaining("at least 10"),
    });
    expect(groupErrors({ name: "x".repeat(61), description: "y".repeat(501) })).toEqual({
      name: expect.stringContaining("60"),
      description: expect.stringContaining("500"),
    });
    expect(groupErrors({ name: "  Allen Avenue  ", description: "Power and security updates" })).toBeNull();
  });

  it("counts spaces out, as the API trims", () => {
    expect(groupErrors({ name: "  ab  ", description: "Power and security updates" })?.name).toBeDefined();
  });
});

describe("groupMeta", () => {
  it("reads privacy and members", () => {
    expect(groupMeta({ privacy: "open", memberCount: 1 })).toBe("Open · 1 member");
    expect(groupMeta({ privacy: "private", memberCount: 1200 })).toBe("Private · 1,200 members");
  });
});
