import { describe, expect, it } from "vitest";
import { isComingSoonFeature } from "./coming-soon";

describe("isComingSoonFeature", () => {
  it("knows the features that have a page, and nothing else", () => {
    expect(isComingSoonFeature("marketplace")).toBe(true);
    expect(isComingSoonFeature("anything-at-all")).toBe(false);
    expect(isComingSoonFeature("constructor")).toBe(false);
  });
});
