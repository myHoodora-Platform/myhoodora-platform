import { parseConfig } from "../env";

const good = {
  EXPO_PUBLIC_APP_ENV: "preview",
  EXPO_PUBLIC_API_URL: "https://api.myhoodora.test/api/",
  EXPO_PUBLIC_WEB_URL: "https://myhoodora.test",
  EXPO_PUBLIC_FIREBASE_API_KEY: "k",
  EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: "d",
  EXPO_PUBLIC_FIREBASE_PROJECT_ID: "p",
  EXPO_PUBLIC_FIREBASE_APP_ID: "a",
};

describe("parseConfig", () => {
  it("accepts a complete configuration and trims trailing slashes", () => {
    const result = parseConfig(good);
    expect(result.ok && result.config.apiUrl).toBe("https://api.myhoodora.test/api");
    expect(result.ok && result.config.appEnv).toBe("preview");
  });

  it("names every missing or malformed value instead of failing later", () => {
    const result = parseConfig({ ...good, EXPO_PUBLIC_API_URL: "not a url", EXPO_PUBLIC_FIREBASE_APP_ID: undefined });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.problems.join(" ")).toMatch(/apiUrl.*firebase\.appId|firebase\.appId.*apiUrl/);
  });

  it("defaults to development, and refuses an unknown environment", () => {
    expect(parseConfig({ ...good, EXPO_PUBLIC_APP_ENV: undefined }).ok).toBe(true);
    expect(parseConfig({ ...good, EXPO_PUBLIC_APP_ENV: "staging" }).ok).toBe(false);
  });
});
