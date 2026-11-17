import { initials, isNarrowing, postAccess, type AccessViewer } from "./visibility";

const LEKKI = "lekki";
const PHASE2 = "phase2"; // next to Lekki
const YABA = "yaba"; // far away
const nearLekki = [PHASE2];

const neighbour = (hoodId: string, follows: string[] = []): AccessViewer => ({ hoodId, readableHoodIds: [hoodId, ...follows], staff: false });
const unverified: AccessViewer = { hoodId: null, readableHoodIds: [], staff: false };
const staff: AccessViewer = { hoodId: YABA, readableHoodIds: [YABA], staff: true };
const post = (visibility: "neighbourhood" | "nearby" | "anyone", category = "general") => ({ neighborhoodId: LEKKI, visibility, category });

const FULL = { read: "full", takePart: true };
const READ_ONLY = { read: "full", takePart: false };
const TEASER = { read: "teaser", takePart: false };

/** The table in docs/product/hood-activation-plan.md §8 and the plan's WP-G. */
describe("postAccess", () => {
  it.each([
    ["signed out", null, "anyone", READ_ONLY],
    ["signed out", null, "nearby", TEASER],
    ["signed out", null, "neighbourhood", TEASER],
    ["not yet verified", unverified, "anyone", READ_ONLY],
    ["not yet verified", unverified, "neighbourhood", TEASER],
    ["nearby Hood", neighbour(PHASE2), "anyone", FULL],
    ["nearby Hood", neighbour(PHASE2), "nearby", FULL],
    ["nearby Hood", neighbour(PHASE2), "neighbourhood", TEASER],
    ["far Hood", neighbour(YABA), "anyone", FULL],
    ["far Hood", neighbour(YABA), "nearby", TEASER],
    ["far Hood", neighbour(YABA), "neighbourhood", TEASER],
    ["own Hood", neighbour(LEKKI), "neighbourhood", FULL],
    ["follows the Hood", neighbour(YABA, [LEKKI]), "neighbourhood", FULL],
    ["follows the Hood, Anyone post", neighbour(YABA, [LEKKI]), "anyone", FULL],
    ["staff", staff, "neighbourhood", FULL],
  ] as const)("%s, %s post", (_who, viewer, visibility, expected) => {
    expect(postAccess(viewer, post(visibility), nearLekki)).toEqual(expected);
  });

  it("keeps safety alerts in their Hood whatever the audience says", () => {
    expect(postAccess(null, post("anyone", "alert"), nearLekki)).toEqual(TEASER);
    expect(postAccess(neighbour(PHASE2), post("nearby", "alert"), nearLekki)).toEqual(TEASER);
    expect(postAccess(neighbour(LEKKI), post("anyone", "alert"), nearLekki)).toEqual(FULL);
  });

  it("treats a post without an audience as Your Hood", () => {
    expect(postAccess(neighbour(PHASE2), { neighborhoodId: LEKKI, category: "general" }, nearLekki)).toEqual(TEASER);
  });
});

describe("isNarrowing", () => {
  it("allows narrowing, never widening", () => {
    expect(isNarrowing("anyone", "neighbourhood")).toBe(true);
    expect(isNarrowing("nearby", "nearby")).toBe(true);
    expect(isNarrowing("neighbourhood", "anyone")).toBe(false);
    expect(isNarrowing("nearby", "anyone")).toBe(false);
  });
});

describe("initials", () => {
  it("shows initials only", () => {
    expect(initials("Adaeze Okafor")).toBe("A. O.");
    expect(initials("tunde")).toBe("T.");
    expect(initials("Ada Mary Okafor")).toBe("A. M.");
    expect(initials("  ")).toBe("N.");
    expect(initials("🙂 Ada")).toBe("A.");
  });
});
