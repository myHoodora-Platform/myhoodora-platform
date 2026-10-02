import { beforeEach, describe, expect, it } from "vitest";
import type { User } from "firebase/auth";
import { fetchSupportUnread, getSupportThread, listSupportThreads, replyToSupport, submitSupportRequest } from "./support";
import { load, save } from "./mock/store";

// Preview-mode reference behaviour (NEXT_PUBLIC_USE_MOCKS=true in vitest).
let n = 0;
const newUser = () => ({ uid: `support-test-${++n}` }) as unknown as User;

describe("support conversations (mock)", () => {
  let user: User;
  beforeEach(() => {
    user = newUser();
  });

  it("opens a conversation and lists it", async () => {
    const { id } = await submitSupportRequest(user, { topic: "verification", message: "My address won't verify, can you help please?" });
    const list = await listSupportThreads(user);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id, status: "open", startedBy: "user", subject: "Address verification help request" });
    expect(list[0]!.lastMessage?.from).toBe("user");
  });

  it("a reply reopens a resolved conversation", async () => {
    const { id } = await submitSupportRequest(user, { topic: "account", message: "Question about my account settings please" });
    const key = `support-threads:${user.uid}`;
    save(key, load<{ id: string; status: string }[]>(key, () => []).map((t) => ({ ...t, status: "resolved" })));
    const next = await replyToSupport(user, id, "One more thing");
    expect(next.status).toBe("open");
    expect(next.messages.at(-1)).toMatchObject({ from: "user", body: "One more thing" });
  });

  it("unread team replies count until opened", async () => {
    const { id } = await submitSupportRequest(user, { topic: "account", message: "Hello team, I have a question here" });
    const key = `support-threads:${user.uid}`;
    save(key, load<{ id: string }[]>(key, () => []).map((t) => ({ ...t, unread: true })));
    expect(await fetchSupportUnread(user)).toBe(1);
    await getSupportThread(user, id);
    expect(await fetchSupportUnread(user)).toBe(0);
  });

  it("keeps each account's conversations private", async () => {
    const { id } = await submitSupportRequest(user, { topic: "other", message: "Something private about my account" });
    const other = newUser();
    expect(await listSupportThreads(other)).toEqual([]);
    await expect(getSupportThread(other, id)).rejects.toMatchObject({ status: 404 });
  });
});
