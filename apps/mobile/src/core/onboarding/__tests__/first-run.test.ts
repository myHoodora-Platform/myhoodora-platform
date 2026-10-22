import AsyncStorage from "@react-native-async-storage/async-storage";
import { noteFirstRunEligibility, readFirstRun, writeFirstRun } from "../first-run";

beforeEach(() => AsyncStorage.clear());

describe("first-run welcome", () => {
  it("is owed to a newcomer, seen before they joined a Hood", async () => {
    await noteFirstRunEligibility("u1", { isOnboarded: false });
    expect(await readFirstRun("u1")).toBe("pending");
  });

  it("is never shown to an existing member or to staff", async () => {
    await noteFirstRunEligibility("u1", { isOnboarded: true, verificationStatus: "verified" });
    await noteFirstRunEligibility("u2", { isOnboarded: false, role: "moderator" });
    expect(await readFirstRun("u1")).toBeNull();
    expect(await readFirstRun("u2")).toBeNull();
  });

  it("once closed, stays closed (a later profile load doesn't bring it back)", async () => {
    await writeFirstRun("u1", "skipped");
    await noteFirstRunEligibility("u1", { isOnboarded: false });
    expect(await readFirstRun("u1")).toBe("skipped");
  });
});
