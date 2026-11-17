import AsyncStorage from "@react-native-async-storage/async-storage";
import { clearSavedInvite, loadMyInviteCode, myInviteCode, readSavedInvite, rememberInviteRef, rememberMyInviteCode } from "../invite-ref";

const DAY = 24 * 60 * 60 * 1000;

beforeEach(() => AsyncStorage.clear());

describe("the invite code someone arrived with", () => {
  it("keeps the first code and how it came, for 30 days", async () => {
    await rememberInviteRef("ada-7k", "qr", { now: 0 });
    await rememberInviteRef("TUNDE9", "link", { now: DAY });
    expect(await readSavedInvite(2 * DAY)).toEqual({ code: "ADA7K", via: "qr", at: 0 });
    expect(await readSavedInvite(31 * DAY)).toBeNull();
  });

  it("a code typed at sign-up replaces a link's; junk is ignored", async () => {
    await rememberInviteRef("ADA7K", "link", { now: 0 });
    await rememberInviteRef("<b>", "code", { now: 0, replace: true });
    expect((await readSavedInvite(0))?.code).toBe("ADA7K");
    await rememberInviteRef("bisi22", "code", { now: 0, replace: true });
    expect(await readSavedInvite(0)).toMatchObject({ code: "BISI22", via: "code" });
    await clearSavedInvite();
    expect(await readSavedInvite(0)).toBeNull();
  });

  it("remembers their own code across launches, for the links they share", async () => {
    await rememberMyInviteCode("ADA7K");
    expect(myInviteCode()).toBe("ADA7K");
    await rememberMyInviteCode(null);
    expect(myInviteCode()).toBeNull();
    await AsyncStorage.setItem("invite.mine", "TUNDE9");
    await loadMyInviteCode();
    expect(myInviteCode()).toBe("TUNDE9");
  });
});
