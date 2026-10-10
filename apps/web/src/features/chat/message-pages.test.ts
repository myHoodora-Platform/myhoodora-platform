import { describe, expect, it } from "vitest";
import type { Message } from "@/lib/api/types";
import { mergeMessages } from "./message-pages";

const at = (minute: number) => new Date(Date.UTC(2026, 9, 6, 9, minute)).toISOString();
const msg = (id: string, minute: number, body = id): Message => ({ _id: id, conversationId: "c1", senderUid: "ada", body, createdAt: at(minute) });

describe("mergeMessages", () => {
  it("adds a newer page after what is on screen", () => {
    const merged = mergeMessages([msg("a", 1), msg("b", 2)], [msg("b", 2), msg("c", 3)]);
    expect(merged.map((m) => m._id)).toEqual(["a", "b", "c"]);
  });

  it("puts an earlier page before it (\"Load earlier messages\")", () => {
    const merged = mergeMessages([msg("c", 3), msg("d", 4)], [msg("a", 1), msg("b", 2)]);
    expect(merged.map((m) => m._id)).toEqual(["a", "b", "c", "d"]);
  });

  it("refetching the newest page keeps earlier pages the reader already loaded", () => {
    const onScreen = [msg("a", 1), msg("b", 2), msg("c", 3), msg("d", 4)];
    const newestPage = [msg("c", 3), msg("d", 4), msg("e", 5)];
    expect(mergeMessages(onScreen, newestPage).map((m) => m._id)).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("never shows a message twice, and takes the fetched copy", () => {
    const merged = mergeMessages([msg("a", 1, "old copy")], [msg("a", 1, "fetched copy")]);
    expect(merged).toHaveLength(1);
    expect(merged[0]!.body).toBe("fetched copy");
  });

  it("keeps a steady order for messages sent in the same instant", () => {
    const merged = mergeMessages([msg("b", 1)], [msg("a", 1), msg("c", 1)]);
    expect(merged.map((m) => m._id)).toEqual(["a", "b", "c"]);
  });

  it("handles an empty thread and an empty page", () => {
    expect(mergeMessages([], [])).toEqual([]);
    expect(mergeMessages([msg("a", 1)], []).map((m) => m._id)).toEqual(["a"]);
  });
});
