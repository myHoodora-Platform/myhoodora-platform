import { getAnalytics, logEvent, logScreenView, setAnalyticsCollectionEnabled } from "@react-native-firebase/analytics";
import { analyticsEnabled, initAnalytics, screenName, trackEvent, trackScreen } from "../analytics";
import { reportError } from "@/core/monitoring/monitoring";

jest.mock("@react-native-firebase/analytics", () => ({
  getAnalytics: jest.fn(() => ({})),
  logEvent: jest.fn(() => Promise.resolve()),
  logScreenView: jest.fn(() => Promise.resolve()),
  setAnalyticsCollectionEnabled: jest.fn(() => Promise.resolve()),
}));
jest.mock("@/core/monitoring/monitoring", () => ({ reportError: jest.fn() }));

beforeEach(() => jest.clearAllMocks());

describe("analyticsEnabled", () => {
  it.each([
    ["development", false],
    ["preview", false],
    ["production", true],
  ] as const)("%s → %s", (appEnv, expected) => {
    expect(analyticsEnabled({ appEnv })).toBe(expected);
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
  beforeEach(() => initAnalytics({ appEnv: "preview" }));

  it("turns collection off and sends nothing", () => {
    expect(setAnalyticsCollectionEnabled).toHaveBeenCalledWith({}, false);
    trackScreen(["(app)", "p", "[id]"]);
    trackEvent("post_created");
    expect(logScreenView).not.toHaveBeenCalled();
    expect(logEvent).not.toHaveBeenCalled();
  });
});

describe("in production", () => {
  beforeEach(() => initAnalytics({ appEnv: "production" }));

  it("turns collection on and records screens by route pattern", () => {
    expect(setAnalyticsCollectionEnabled).toHaveBeenCalledWith({}, true);
    trackScreen(["(app)", "p", "[id]"]);
    expect(logScreenView).toHaveBeenCalledWith({}, { screen_name: "p/[id]", screen_class: "p/[id]" });
  });

  it("records named events", () => {
    trackEvent("post_created", { category: "general" });
    expect(logEvent).toHaveBeenCalledWith({}, "post_created", { category: "general" });
  });

  it("never throws when Firebase isn't configured (no native files)", () => {
    jest.mocked(getAnalytics).mockImplementationOnce(() => {
      throw new Error("No Firebase App '[DEFAULT]' has been created");
    });
    expect(() => trackScreen(["news-feed"])).not.toThrow();
    expect(reportError).toHaveBeenCalledWith(expect.any(Error), "analytics");
  });
});
