import type { Message } from "@myhoodora/api-contract/types";
import { canDeleteForEveryone, canEdit, editEndsAt, myReaction, withReaction } from "../message-rules";

const sent = new Date("2026-10-28T09:00:00Z").getTime();
const msg = (over: Partial<Message> = {}): Message => ({ _id: "m1", conversationId: "c1", senderUid: "me", body: "Hi", createdAt: new Date(sent).toISOString(), ...over });
const min = 60_000;

describe("editing (WhatsApp's 15 minutes)", () => {
  it("lets you edit your own words until 15 minutes after sending, then not", () => {
    expect(canEdit(msg(), "me", sent + 14 * min)).toBe(true);
    expect(canEdit(msg(), "me", sent + 15 * min)).toBe(false);
    expect(canEdit(msg(), "me", sent + 3 * 60 * min)).toBe(false);
    expect(editEndsAt(msg())).toBe(sent + 15 * min);
  });

  it("never someone else's, a deleted or forwarded one, or photos with no words", () => {
    expect(canEdit(msg({ senderUid: "ada" }), "me", sent)).toBe(false);
    expect(canEdit(msg({ deleted: true, body: "" }), "me", sent)).toBe(false);
    expect(canEdit(msg({ body: "", photos: ["p"] }), "me", sent)).toBe(false);
    expect(canEdit(msg({ forwarded: true }), "me", sent)).toBe(false);
  });
});

it("deletes for everyone for 2 days and 12 hours (WhatsApp), your own only", () => {
  expect(canDeleteForEveryone(msg(), "me", sent + 24 * 60 * min)).toBe(true);
  expect(canDeleteForEveryone(msg(), "me", sent + 59 * 60 * min)).toBe(true);
  expect(canDeleteForEveryone(msg(), "me", sent + 61 * 60 * min)).toBe(false);
  expect(canDeleteForEveryone(msg({ senderUid: "ada" }), "me", sent)).toBe(false);
});

it("keeps one reaction per person, most first", () => {
  const m = withReaction(withReaction(msg({ reactions: [{ emoji: "👍", uids: ["ada", "bola"] }] }), "me", "❤️"), "me", "👍");
  expect(m.reactions).toEqual([{ emoji: "👍", uids: ["ada", "bola", "me"] }]);
  expect(myReaction(m, "me")).toBe("👍");
  expect(withReaction(m, "me", null).reactions).toEqual([{ emoji: "👍", uids: ["ada", "bola"] }]);
});
