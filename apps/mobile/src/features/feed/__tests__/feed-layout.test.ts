import type { ApiPost } from "@myhoodora/api-contract/types";
import { gridLayout } from "../media-layout";
import { topReactions, withReaction } from "../reactions";
import { collapsedText } from "../see-more";

describe("collapsedText", () => {
  const line = (s: string) => `${s}\n`;

  it("is null when the text fits, however many characters", () => {
    expect(collapsedText(["a short post"], 5)).toBeNull();
    expect(collapsedText(["x".repeat(40), "y".repeat(40), "z".repeat(40), "w".repeat(40), "v".repeat(40)], 5)).toBeNull();
  });

  it("clamps by rendered lines: six short lines are more than five", () => {
    const lines = ["one", "two", "three", "four", "five", "six"].map(line);
    expect(collapsedText(lines, 5)).toBe("one\ntwo\nthree\nfour\nfive");
  });

  it("leaves room for '… See more' on a full last line, at a word boundary", () => {
    const full = "The generator on Admiralty Way is back ";
    const lines = [full, full, full, full, "Everyone please come to the meeting on ", "Saturday"];
    const out = collapsedText(lines, 5)!;
    expect(out.slice(full.length * 4)).toBe("Everyone please come to");
  });
});

describe("gridLayout", () => {
  it("keeps one photo's shape inside 4:5 to 1.91:1", () => {
    expect(gridLayout([3], 1).aspect).toBe(1.91);
    expect(gridLayout([0.5], 1).aspect).toBe(0.8);
    expect(gridLayout([null], 1).tiles).toHaveLength(1);
  });

  it("puts two side by side, three as one large and two small", () => {
    expect(gridLayout([], 2).tiles.map((t) => [t.x, t.w])).toEqual([[0, 0.5], [0.5, 0.5]]);
    expect(gridLayout([0.8], 3).tiles[0]).toMatchObject({ w: 0.6, h: 1 });
    expect(gridLayout([1.5], 3).tiles[0]).toMatchObject({ w: 1, h: 0.6 });
  });

  it("shows four in a 2×2 grid and counts the rest", () => {
    expect(gridLayout([], 4)).toMatchObject({ hidden: 0 });
    const seven = gridLayout([], 7);
    expect(seven.tiles).toHaveLength(4);
    expect(seven.hidden).toBe(3);
  });
});

describe("reactions", () => {
  const post = { _id: "p", reactionTotal: 3, reactionCounts: { like: 2, haha: 1 }, myReaction: "like" } as unknown as ApiPost;

  it("switches your reaction without changing the total", () => {
    const next = withReaction(post, "wow");
    expect(next.reactionTotal).toBe(3);
    expect(next.reactionCounts).toMatchObject({ like: 1, haha: 1, wow: 1 });
    expect(next.myReaction).toBe("wow");
  });

  it("takes it back", () => {
    expect(withReaction(post, null)).toMatchObject({ reactionTotal: 2, myReaction: null, reactionCounts: { like: 1 } });
  });

  it("lists the most used first", () => {
    expect(topReactions({ like: 1, sad: 4, haha: 2, wow: 0 })).toEqual(["sad", "haha", "like"]);
  });
});
