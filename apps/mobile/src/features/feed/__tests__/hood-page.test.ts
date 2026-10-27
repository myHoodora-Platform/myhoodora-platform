import type { User } from "@firebase/auth";
import { ApiError } from "@myhoodora/api-contract/errors";
import type { ApiPost } from "@myhoodora/api-contract/types";
import { isAd, listHoodPage, pagePosts } from "../feed-api";

const mockFetch = jest.fn();
jest.mock("@/core/api/client", () => ({ apiFetch: (...a: unknown[]) => mockFetch(...a) }));

const user = { uid: "u1" } as User;
const post = (id: string) => ({ _id: id, createdAt: `2026-10-${id.padStart(2, "0")}T00:00:00.000Z` }) as ApiPost;
const ad = { _id: "ad1", format: "image", advertiser: { name: "Shop" }, primaryText: "Hi", cta: null, media: [], cards: [], why: "Because" };

beforeEach(() => mockFetch.mockReset());

describe("listHoodPage", () => {
  it("keeps the API's order, marks ads, and passes the session and cursor", async () => {
    mockFetch.mockResolvedValue({ items: [{ type: "post", data: post("1") }, { type: "ad", slotId: "s:0", data: ad }, { type: "post", data: post("2") }], nextCursor: "abc" });
    const page = await listHoodPage(user, "h1", { cursor: "prev", session: "session01" });
    expect(mockFetch.mock.calls[0][1]).toBe("/feed/hood/h1?limit=10&session=session01&cursor=prev");
    expect(page.entries.map((e) => (isAd(e) ? `ad:${e.slotId}` : e._id))).toEqual(["1", "ad:s:0", "2"]);
    expect(page.next).toBe("abc");
    expect(pagePosts(page).map((p) => p._id)).toEqual(["1", "2"]);
  });

  it("against an API without the route, reads the plain feed (no ads)", async () => {
    const posts = Array.from({ length: 10 }, (_, i) => post(String(i + 1)));
    mockFetch.mockRejectedValueOnce(new ApiError("Cannot GET /api/feed/hood/h1", 404, "not_found")).mockResolvedValueOnce(posts);
    const page = await listHoodPage(user, "h1", { session: "session01" });
    expect(mockFetch.mock.calls[1][1]).toBe("/posts/neighborhood/h1?limit=10");
    expect(page.entries).toHaveLength(10);
    expect(page.next).toBe(posts[9]!.createdAt);
  });

  it("a neighbourhood you can't see is still an error", async () => {
    mockFetch.mockRejectedValue(new ApiError("This neighbourhood isn't available.", 404, "not_found"));
    await expect(listHoodPage(user, "h1", { session: "session01" })).rejects.toThrow("isn't available");
  });
});
