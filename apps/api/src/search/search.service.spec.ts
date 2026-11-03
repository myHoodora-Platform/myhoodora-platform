import type { Viewer } from "../shared/auth/viewer";
import { SearchService } from "./search.service";

const viewer = (hoodId: string | null) => ({ uid: "u1", hoodId }) as Viewer;

function make() {
  const posts = { feed: jest.fn(async () => [{ id: "p1" }]) };
  const listings = { list: jest.fn(async () => [{ id: "l1" }]) };
  const users = { search: jest.fn(async () => Array.from({ length: 8 }, (_, i) => ({ uid: `n${i}` }))) };
  return { posts, listings, users, service: new SearchService(posts as never, listings as never, users as never) };
}

describe("SearchService", () => {
  it("searches all three in the caller's own Hood, a few of each", async () => {
    const { service, posts, listings } = make();
    const r = await service.search(viewer("hood-1"), "plumber");
    expect(posts.feed).toHaveBeenCalledWith(expect.anything(), "hood-1", { q: "plumber", limit: 5 });
    expect(listings.list).toHaveBeenCalledWith(expect.anything(), { q: "plumber", limit: 5 });
    expect(r).toMatchObject({ q: "plumber", posts: [{ id: "p1" }], listings: [{ id: "l1" }] });
    expect(r.people).toHaveLength(5);
  });

  it("one type only when asked, with a bigger default page", async () => {
    const { service, posts, listings, users } = make();
    const r = await service.search(viewer("hood-1"), "chair", "listings");
    expect(listings.list).toHaveBeenCalledWith(expect.anything(), { q: "chair", limit: 20 });
    expect(posts.feed).not.toHaveBeenCalled();
    expect(users.search).not.toHaveBeenCalled();
    expect(Object.keys(r)).toEqual(["q", "listings"]);
  });

  it("returns empty results before joining a Hood, without querying", async () => {
    const { service, posts } = make();
    expect(await service.search(viewer(null), "x y")).toEqual({ q: "x y", posts: [], listings: [], people: [] });
    expect(posts.feed).not.toHaveBeenCalled();
  });
});
