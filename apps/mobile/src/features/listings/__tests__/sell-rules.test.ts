import { listingErrors, parseNaira, type ListingForm } from "../listings-api";

jest.mock("@/core/api/client", () => ({ apiFetch: jest.fn() }));

const form = (extra: Partial<ListingForm> = {}): ListingForm => ({ title: "Standing fan", description: "", price: "18,000", free: false, negotiable: false, category: "home_appliances", condition: "good", ...extra });

describe("selling", () => {
  it("reads a price however it's typed", () => {
    expect(parseNaira("18,000")).toBe(18000);
    expect(parseNaira("₦25000")).toBe(25000);
    expect(parseNaira("")).toBeNull();
  });

  it("accepts a complete listing, and a free one without a price", () => {
    expect(listingErrors(form())).toBeNull();
    expect(listingErrors(form({ free: true, price: "" }))).toBeNull();
  });

  it("names each missing piece", () => {
    expect(listingErrors(form({ title: "TV", price: "", category: null, condition: null }))).toEqual({
      title: "Give it a name of at least 3 characters.",
      price: "Add a price, or mark it as free.",
      category: "Choose a category.",
      condition: "Choose its condition.",
    });
  });
});
