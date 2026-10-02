import { describe, expect, it } from "vitest";
import type { User } from "firebase/auth";
import { timeLeft } from "@/lib/format";
import { getPollResults, isPollClosed, unvotePoll, votePoll } from "./polls";
import type { Post } from "./types";

const user = { uid: "tester" } as User;

function pollPost(id: string, closesInHours: number): Post {
  const now = new Date().toISOString();
  return {
    _id: id, authorUid: "a", neighborhoodId: "n", type: "text", content: "", mediaUrls: [], likes: [],
    isActive: true, createdAt: now, updatedAt: now, message: "Q?", commentCount: 0, reactionTotal: 0, myReaction: null, resolvedAt: null,
    meta: {
      category: "poll",
      poll: {
        options: [{ id: "o1", text: "Yes" }, { id: "o2", text: "No" }],
        closesAt: new Date(Date.now() + closesInHours * 3_600_000).toISOString(),
      },
    },
  };
}

describe("polls", () => {
  it("records one vote per neighbour, which can be changed or removed", async () => {
    const post = pollPost("p_vote", 24);
    const first = await votePoll(user, post, "o1");
    expect(first).toMatchObject({ myVote: "o1", counts: { o1: 1, o2: 0 }, total: 1 });
    const switched = await votePoll(user, post, "o2");
    expect(switched).toMatchObject({ myVote: "o2", counts: { o1: 0, o2: 1 }, total: 1 });
    const removed = await unvotePoll(user, post);
    expect(removed).toMatchObject({ myVote: null, total: 0 });
  });

  it("starts with zero counts for every option", async () => {
    const results = await getPollResults(user, pollPost("p_fresh", 24));
    expect(results).toMatchObject({ counts: { o1: 0, o2: 0 }, total: 0, myVote: null, closed: false });
  });

  it("closes at its deadline and refuses votes", async () => {
    const closed = pollPost("p_closed", -1);
    expect(isPollClosed(closed)).toBe(true);
    await expect(votePoll(user, closed, "o1")).rejects.toThrow(/closed/);
    await expect(unvotePoll(user, closed)).rejects.toThrow(/closed/);
  });

  it("describes time left", () => {
    const inHours = (h: number) => new Date(Date.now() + h * 3_600_000 + 60_000).toISOString();
    expect(timeLeft(inHours(72))).toBe("3 days left");
    expect(timeLeft(inHours(30))).toBe("1 day left");
    expect(timeLeft(inHours(5))).toBe("5 hours left");
    expect(timeLeft(inHours(-1))).toBe("Closed");
  });
});
