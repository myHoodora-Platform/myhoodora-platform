import type { LocationPreview } from "@myhoodora/api-contract/types";
import { confirmAction, coordsFollowAddress, detailsErrors, formatDistance, nameProblem } from "../onboarding-rules";

const address = { street: "12 Admiralty Way", area: "Lekki Phase 1", city: "Lagos" };
const inHood: LocationPreview = { hood: { id: "h1", name: "Lekki Phase 1", city: "Lagos" }, nearbyHoods: [] };

describe("step 1 checks", () => {
  it("puts each problem beside its own field, with the API's name bounds", () => {
    expect(detailsErrors("Ada Okafor", address)).toBeNull();
    expect(detailsErrors("A", address)).toEqual({ name: "Your name needs at least 2 characters." });
    expect(nameProblem("x".repeat(61))).toBe("Please keep your name to 60 characters or fewer.");
    expect(detailsErrors("Ada", { ...address, area: "" })?.area).toMatch(/area or estate/);
    expect(detailsErrors("", { ...address, city: "" })).toEqual({ name: expect.any(String), city: "Add your city, e.g. “Lagos”." });
  });

  it("an address edit only moves a point that came from the address", () => {
    expect(coordsFollowAddress("gps")).toBe(false);
    expect(coordsFollowAddress("street")).toBe(true);
    expect(coordsFollowAddress("area")).toBe(true);
    expect(coordsFollowAddress("saved")).toBe(true);
  });
});

describe("confirmAction", () => {
  it("joins the Hood the person saw", () => {
    expect(confirmAction(inHood, "gps")).toEqual({ kind: "join", hoodId: "h1", hoodName: "Lekki Phase 1" });
  });

  it("never joins on an area's middle point: it could be the wrong Hood (contract §29)", () => {
    expect(confirmAction(inHood, "area").kind).toBe("blocked");
  });

  it("says why a verified neighbour can't move yet", () => {
    expect(confirmAction({ ...inHood, cannotJoin: "You can move again in 20 days." }, "street")).toEqual({ kind: "blocked", reason: "You can move again in 20 days." });
  });

  it("outside every Hood, continues to save and offer nearby Hoods", () => {
    expect(confirmAction({ hood: null, nearbyHoods: [] }, "street")).toEqual({ kind: "continue" });
  });
});

it("formats distances in the web's words", () => {
  expect(formatDistance(20)).toBe("about 50 m away");
  expect(formatDistance(340)).toBe("about 350 m away");
  expect(formatDistance(2000)).toBe("about 2 km away");
  expect(formatDistance(1240)).toBe("about 1.2 km away");
});
