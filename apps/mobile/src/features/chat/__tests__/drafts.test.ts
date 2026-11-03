import AsyncStorage from "@react-native-async-storage/async-storage";
import { runLogoutCleanups } from "@/core/auth/logout-cleanup";
import { clearDrafts, getDraft, loadDrafts, setDraft } from "../drafts";

beforeEach(async () => {
  jest.useRealTimers();
  await AsyncStorage.clear();
  await clearDrafts("ada");
});

it("keeps what you were writing per chat, and forgets it once blank", async () => {
  await loadDrafts("ada");
  setDraft("ada", "c1", "See you at 5");
  setDraft("ada", "c2", "Is the generator");
  expect(getDraft("ada", "c1")).toBe("See you at 5");
  setDraft("ada", "c1", "   ");
  expect(getDraft("ada", "c1")).toBe("");
  expect(getDraft("ada", "c2")).toBe("Is the generator");
  // Not someone else's.
  expect(getDraft("bola", "c2")).toBe("");
});

it("is saved on the phone and read back next time", async () => {
  await loadDrafts("ada");
  setDraft("ada", "c1", "half a sentence");
  await new Promise((r) => setTimeout(r, 450));
  expect(JSON.parse((await AsyncStorage.getItem("chat.drafts.ada"))!)).toEqual({ c1: "half a sentence" });
});

it("is wiped at logout", async () => {
  await loadDrafts("ada");
  setDraft("ada", "c1", "private words");
  await runLogoutCleanups("ada");
  expect(getDraft("ada", "c1")).toBe("");
  expect(await AsyncStorage.getItem("chat.drafts.ada")).toBeNull();
});
