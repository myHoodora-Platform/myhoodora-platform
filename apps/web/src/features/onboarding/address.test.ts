import { describe, expect, it } from "vitest";
import { addressProblem, joinAddress, pinFollowsAddress, splitAddress } from "./address";

describe("onboarding address", () => {
  it("needs a street with a name, an area and a city", () => {
    const ok = { street: "12 Admiralty Way", area: "Lekki Phase 1", city: "Lagos" };
    expect(addressProblem(ok)).toBeNull();
    expect(addressProblem({ ...ok, street: "12" })).toMatch(/street name/);
    expect(addressProblem({ ...ok, area: " " })).toMatch(/area or estate/);
    expect(addressProblem({ ...ok, area: "12 admiralty way" })).toMatch(/not the street again/);
    expect(addressProblem({ ...ok, city: "" })).toMatch(/city/);
  });

  it("joins the parts for the account, and splits an older one-line address back out", () => {
    expect(joinAddress({ street: " 12 Admiralty Way", area: "Lekki Phase 1 ", city: "Lagos" })).toBe("12 Admiralty Way, Lekki Phase 1, Lagos");
    expect(splitAddress("12 Admiralty Way, Lekki Phase 1, Eti-Osa, Lagos")).toEqual({ street: "12 Admiralty Way", area: "Lekki Phase 1, Eti-Osa", city: "Lagos" });
    expect(splitAddress("Allen Avenue, Ikeja")).toEqual({ street: "Allen Avenue", area: "Ikeja", city: "" });
  });

  it("moves the pin with the address only when the pin came from the address", () => {
    expect(["gps", "pin", "street", "area", "saved", null].filter((s) => pinFollowsAddress(s as never))).toEqual(["street", "area", "saved"]);
  });
});
