import { compareVersions, storeUpdateStatus } from "@myhoodora/api-contract/app-config";
import { offerAgain, SKIP_DAYS } from "../store-update";

const play = "https://play.google.com/store/apps/details?id=com.myhoodora.app";
const rule = (latest: string, minimum: string, storeUrl: string | null = play) => ({ latest, minimum, storeUrl });

describe("compareVersions", () => {
  it("compares number by number, not as text", () => {
    expect(compareVersions("1.10.0", "1.9.0")).toBeGreaterThan(0);
    expect(compareVersions("1.0.0", "1.0.0")).toBe(0);
    expect(compareVersions("1.0.9", "1.1.0")).toBeLessThan(0);
    expect(compareVersions("2.0", "2.0.0")).toBe(0);
  });
});

describe("storeUpdateStatus", () => {
  it("blocks below the minimum, offers below the latest, otherwise says nothing", () => {
    expect(storeUpdateStatus("1.0.0", rule("1.2.0", "1.1.0"))).toBe("required");
    expect(storeUpdateStatus("1.1.0", rule("1.2.0", "1.1.0"))).toBe("available");
    expect(storeUpdateStatus("1.2.0", rule("1.2.0", "1.1.0"))).toBe("none");
    expect(storeUpdateStatus("1.3.0", rule("1.2.0", "1.1.0"))).toBe("none");
  });

  it("says nothing when it can't be sure", () => {
    expect(storeUpdateStatus("1.0.0", rule("2.0.0", "2.0.0", null))).toBe("none"); // not in that store yet
    expect(storeUpdateStatus(null, rule("2.0.0", "2.0.0"))).toBe("none");
    expect(storeUpdateStatus("1.0.0", undefined)).toBe("none"); // an API from before this setting
    expect(storeUpdateStatus("1.0.0", rule("2.0", "two"))).toBe("none");
  });
});

describe("offerAgain", () => {
  const now = new Date("2027-01-10T12:00:00Z");
  const ago = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();

  it("offers a version never skipped", () => {
    expect(offerAgain(null, "1.1.0", now)).toBe(true);
  });

  it("waits a few days after a skip, then offers again", () => {
    expect(offerAgain({ version: "1.1.0", at: ago(SKIP_DAYS - 1) }, "1.1.0", now)).toBe(false);
    expect(offerAgain({ version: "1.1.0", at: ago(SKIP_DAYS) }, "1.1.0", now)).toBe(true);
  });

  it("offers a newer version straight away", () => {
    expect(offerAgain({ version: "1.1.0", at: ago(0) }, "1.2.0", now)).toBe(true);
  });
});
