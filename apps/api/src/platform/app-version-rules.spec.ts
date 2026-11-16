import { advanceRule, DEFAULT_APP_UPDATES_AUTO } from "./app-version-rules";
import { parseServiceAccount, versionFromReleaseName } from "./store-versions";

const now = new Date("2027-03-01T12:00:00Z");
const daysAgo = (d: number) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000);
const play = "https://play.google.com/store/apps/details?id=com.myhoodora.app";
const rule = (latest: string, minimum: string, latestSince: Date | null = null, storeUrl = play) => ({ latest, minimum, storeUrl, latestSince });
const auto = DEFAULT_APP_UPDATES_AUTO; // follows the stores, Minimum after 30 days

describe("advanceRule", () => {
  it("raises Latest to a newer store version and starts the clock", () => {
    const { rule: next, changes } = advanceRule(rule("1.0.0", "1.0.0"), { version: "1.1.0", url: play }, auto, now);
    expect(next.latest).toBe("1.1.0");
    expect(next.latestSince).toEqual(now);
    expect(next.minimum).toBe("1.0.0");
    expect(changes).toEqual([{ field: "latest", from: "1.0.0", to: "1.1.0" }]);
  });

  it("never lowers Latest, and leaves it alone when following the stores is off", () => {
    expect(advanceRule(rule("1.2.0", "1.0.0"), { version: "1.1.0", url: play }, auto, now).changes).toEqual([]);
    expect(advanceRule(rule("1.0.0", "1.0.0"), { version: "1.1.0", url: play }, { ...auto, fromStores: false }, now).changes).toEqual([]);
  });

  it("makes Minimum follow Latest once the days have passed, not before", () => {
    expect(advanceRule(rule("1.1.0", "1.0.0", daysAgo(29)), { version: "1.1.0", url: play }, auto, now).rule.minimum).toBe("1.0.0");
    const { rule: next, changes } = advanceRule(rule("1.1.0", "1.0.0", daysAgo(30)), { version: "1.1.0", url: play }, auto, now);
    expect(next.minimum).toBe("1.1.0");
    expect(changes).toEqual([{ field: "minimum", from: "1.0.0", to: "1.1.0" }]);
  });

  it("never requires more than the store has (a mistyped Latest can't lock people out)", () => {
    expect(advanceRule(rule("2.0.0", "1.0.0", daysAgo(60)), { version: "1.1.0", url: play }, auto, now).rule.minimum).toBe("1.1.0");
  });

  it("with no store reading, Minimum follows the admin's Latest", () => {
    expect(advanceRule(rule("1.1.0", "1.0.0", daysAgo(60)), null, auto, now).rule.minimum).toBe("1.1.0");
  });

  it("does nothing to Minimum when the timer is off or Latest has no start date", () => {
    expect(advanceRule(rule("1.1.0", "1.0.0", daysAgo(400)), null, { ...auto, requireAfterDays: 0 }, now).changes).toEqual([]);
    expect(advanceRule(rule("1.1.0", "1.0.0", null), null, auto, now).changes).toEqual([]);
  });

  it("fills in the store page once the store has one, and keeps an admin's page", () => {
    const apple = "https://apps.apple.com/ng/app/myhoodora/id123";
    expect(advanceRule(rule("1.0.0", "1.0.0", null, ""), { version: "1.0.0", url: apple }, auto, now).rule.storeUrl).toBe(apple);
    expect(advanceRule(rule("1.0.0", "1.0.0", null, play), { version: "1.0.0", url: apple }, auto, now).rule.storeUrl).toBe(play);
  });

  it("ignores a store version that isn't x.y.z", () => {
    expect(advanceRule(rule("1.0.0", "1.0.0"), { version: "1.1", url: play }, auto, now).changes).toEqual([]);
  });
});

describe("versionFromReleaseName", () => {
  it("reads Play's release names", () => {
    expect(versionFromReleaseName("3 (1.0.1)")).toBe("1.0.1");
    expect(versionFromReleaseName("1.2.0")).toBe("1.2.0");
    expect(versionFromReleaseName("Launch")).toBeNull();
    expect(versionFromReleaseName(undefined)).toBeNull();
  });
});

describe("parseServiceAccount", () => {
  const json = JSON.stringify({ client_email: "play@x.iam.gserviceaccount.com", private_key: "-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n" });
  it("takes raw JSON or base64 of it", () => {
    expect(parseServiceAccount(json)?.client_email).toBe("play@x.iam.gserviceaccount.com");
    expect(parseServiceAccount(Buffer.from(json).toString("base64"))?.client_email).toBe("play@x.iam.gserviceaccount.com");
  });
  it("returns null when unset or unreadable", () => {
    expect(parseServiceAccount("")).toBeNull();
    expect(parseServiceAccount(undefined)).toBeNull();
    expect(parseServiceAccount("{nope")).toBeNull();
    expect(parseServiceAccount(JSON.stringify({ client_email: "x" }))).toBeNull();
  });
});
