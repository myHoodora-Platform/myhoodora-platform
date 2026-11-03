import { listListings, statusLabel } from "../listings-api";

const mockApiFetch = jest.fn();
jest.mock("@/core/api/client", () => ({ apiFetch: (...a: unknown[]) => mockApiFetch(...a) }));

const user = { uid: "u1" } as never;

describe("listings", () => {
  beforeEach(() => mockApiFetch.mockResolvedValue([]));

  it("asks for your Hood's listings, by category or free", async () => {
    await listListings(user, "h1", "all");
    expect(mockApiFetch).toHaveBeenLastCalledWith(user, "/listings?neighborhoodId=h1&limit=60");
    await listListings(user, "h1", "free");
    expect(mockApiFetch).toHaveBeenLastCalledWith(user, "/listings?neighborhoodId=h1&limit=60&free=true");
    await listListings(user, "h1", "electronics");
    expect(mockApiFetch).toHaveBeenLastCalledWith(user, "/listings?neighborhoodId=h1&limit=60&category=electronics");
  });

  it("names a finished free listing 'Given away'", () => {
    expect(statusLabel("sold", true)).toBe("Given away");
    expect(statusLabel("sold", false)).toBe("Sold");
    expect(statusLabel("pending", false)).toBe("Pending");
  });
});
