import type { ApiPost } from "@myhoodora/api-contract/types";
import { withLike } from "../reactions";

const post = (extra: Partial<ApiPost> = {}) => ({ _id: "p1", reactionTotal: 3, reactionCounts: { like: 2, helpful: 1 }, myReaction: null, ...extra }) as ApiPost;

describe("withLike", () => {
  it("adds a like at once", () => {
    expect(withLike(post(), true)).toMatchObject({ myReaction: "like", reactionTotal: 4, reactionCounts: { like: 3, helpful: 1 } });
  });

  it("taking back any reaction removes that one", () => {
    expect(withLike(post({ myReaction: "helpful" }), false)).toMatchObject({ myReaction: null, reactionTotal: 2, reactionCounts: { like: 2, helpful: 0 } });
  });

  it("changes nothing when it's already in that state", () => {
    const p = post({ myReaction: "like" });
    expect(withLike(p, true)).toBe(p);
  });
});
