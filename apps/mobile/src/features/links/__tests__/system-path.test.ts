import AsyncStorage from "@react-native-async-storage/async-storage";
import { readSavedInvite } from "@/core/invites/invite-ref";
import { systemPathToRoute as redirectSystemPath } from "../system-path";

beforeEach(() => AsyncStorage.clear());
const settle = () => new Promise((r) => setTimeout(r, 0));

describe("links from outside the app", () => {
  it("maps the web's paths to the app's and keeps the sharer's code", async () => {
    expect(redirectSystemPath({ path: "https://myhoodora.com/p/6afc34d22644cd9c608d34dc?ref=ada7k", initial: true })).toBe("/p/6afc34d22644cd9c608d34dc");
    await settle();
    expect(await readSavedInvite()).toMatchObject({ code: "ADA7K", via: "post" });
    expect(redirectSystemPath({ path: "https://www.myhoodora.com/profile/abc123", initial: false })).toBe("/u/abc123");
    expect(redirectSystemPath({ path: "myhoodora://i/TUNDE9?src=qr", initial: true })).toBe("/i/TUNDE9?src=qr");
    // A shared badge and a poster open the same invite in the app.
    expect(redirectSystemPath({ path: "https://myhoodora.com/i/ADA7K/badge", initial: true })).toBe("/i/ADA7K");
    expect(redirectSystemPath({ path: "https://myhoodora.com/i/ADA7K/poster/", initial: true })).toBe("/i/ADA7K");
    expect(redirectSystemPath({ path: "/for-sale/1", initial: false })).toBe("/for-sale/1");
    expect(redirectSystemPath({ path: "::::", initial: true })).toBe("/::::");
  });
});
