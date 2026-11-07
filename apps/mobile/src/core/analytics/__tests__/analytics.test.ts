import AsyncStorage from "@react-native-async-storage/async-storage";
import { currentLegalVersion } from "@myhoodora/api-contract/legal";
import { getAnalytics, logEvent, logScreenView, resetAnalyticsData, setAnalyticsCollectionEnabled } from "@react-native-firebase/analytics";
import { analyticsEnabled, initAnalytics, screenName, setAnalyticsConsent, trackEvent, trackScreen, type AnalyticsConsent } from "../analytics";
import { reportError } from "@/core/monitoring/monitoring";

jest.mock("@react-native-firebase/analytics", () => ({
  getAnalytics: jest.fn(() => ({})),
  logEvent: jest.fn(() => Promise.resolve()),
  logScreenView: jest.fn(() => Promise.resolve()),
  resetAnalyticsData: jest.fn(() => Promise.resolve()),
  setAnalyticsCollectionEnabled: jest.fn(() => Promise.resolve()),
}));
jest.mock("@/core/monitoring/monitoring", () => ({ reportError: jest.fn() }));

const KEY = "analytics.consent.v1";
const granted: AnalyticsConsent = { choice: "granted", at: "2026-11-07T10:00:00.000Z", policy: "2026-11-07" };

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
});

describe("analyticsEnabled", () => {
  it.each([
    ["development", granted, false],
    ["preview", granted, false],
    ["production", null, false],
    ["production", { ...granted, choice: "denied" }, false],
    ["production", granted, true],
  ] as const)("%s with %j → %s", (appEnv, consent, expected) => {
    expect(analyticsEnabled({ appEnv }, consent)).toBe(expected);
  });
});

describe("screenName", () => {
  it("drops route groups and keeps dynamic segments as patterns", () => {
    expect(screenName(["(app)", "p", "[id]"])).toBe("p/[id]");
    expect(screenName(["(app)", "(tabs)", "news-feed"])).toBe("news-feed");
    expect(screenName([])).toBe("index");
  });
});

describe("in development and preview", () => {
  beforeEach(async () => {
    await AsyncStorage.setItem(KEY, JSON.stringify(granted));
    await initAnalytics({ appEnv: "preview" });
  });

  it("keeps collection off and sends nothing, even after a yes", () => {
    expect(setAnalyticsCollectionEnabled).toHaveBeenLastCalledWith({}, false);
    trackScreen(["(app)", "p", "[id]"]);
    trackEvent("post_created");
    expect(logScreenView).not.toHaveBeenCalled();
    expect(logEvent).not.toHaveBeenCalled();
  });
});

describe("in production, before the person has answered", () => {
  beforeEach(() => initAnalytics({ appEnv: "production" }));

  it("keeps collection off and sends nothing", () => {
    expect(setAnalyticsCollectionEnabled).toHaveBeenLastCalledWith({}, false);
    trackScreen(["news-feed"]);
    expect(logScreenView).not.toHaveBeenCalled();
  });

  it("starts on yes, and keeps a record of what was agreed and when", async () => {
    await setAnalyticsConsent("granted");
    expect(setAnalyticsCollectionEnabled).toHaveBeenLastCalledWith({}, true);
    const saved = JSON.parse((await AsyncStorage.getItem(KEY))!) as AnalyticsConsent;
    expect(saved).toEqual({ choice: "granted", at: expect.any(String), policy: currentLegalVersion("privacy").version });
  });

  it("stays off on no", async () => {
    await setAnalyticsConsent("denied");
    expect(setAnalyticsCollectionEnabled).toHaveBeenLastCalledWith({}, false);
    expect(resetAnalyticsData).not.toHaveBeenCalled();
  });

  it("ignores a broken record", async () => {
    await AsyncStorage.setItem(KEY, "{not json");
    await initAnalytics({ appEnv: "production" });
    expect(setAnalyticsCollectionEnabled).toHaveBeenLastCalledWith({}, false);
  });
});

describe("in production, after a yes", () => {
  beforeEach(async () => {
    await AsyncStorage.setItem(KEY, JSON.stringify(granted));
    await initAnalytics({ appEnv: "production" });
  });

  it("turns collection on and records screens by route pattern", () => {
    expect(setAnalyticsCollectionEnabled).toHaveBeenLastCalledWith({}, true);
    trackScreen(["(app)", "p", "[id]"]);
    expect(logScreenView).toHaveBeenCalledWith({}, { screen_name: "p/[id]", screen_class: "p/[id]" });
  });

  it("records named events", () => {
    trackEvent("post_created", { category: "general" });
    expect(logEvent).toHaveBeenCalledWith({}, "post_created", { category: "general" });
  });

  it("stops and clears this phone's analytics data when they change their mind", async () => {
    await setAnalyticsConsent("denied");
    expect(setAnalyticsCollectionEnabled).toHaveBeenLastCalledWith({}, false);
    expect(resetAnalyticsData).toHaveBeenCalled();
    trackScreen(["news-feed"]);
    expect(logScreenView).not.toHaveBeenCalled();
  });

  it("never throws when Firebase isn't configured (no native files)", () => {
    jest.mocked(getAnalytics).mockImplementationOnce(() => {
      throw new Error("No Firebase App '[DEFAULT]' has been created");
    });
    expect(() => trackScreen(["news-feed"])).not.toThrow();
    expect(reportError).toHaveBeenCalledWith(expect.any(Error), "analytics");
  });
});
