import { describe, expect, it } from "vitest";
import { appUrlProblem, isIndexable, siteEnv } from "./site-env";

describe("siteEnv", () => {
  it("is production only when SITE_ENV or Vercel says so", () => {
    expect(isIndexable({ SITE_ENV: "production" })).toBe(true);
    expect(isIndexable({ VERCEL_ENV: "production" })).toBe(true);
    expect(isIndexable({ VERCEL_ENV: "preview" })).toBe(false);
    expect(isIndexable({})).toBe(false);
  });

  it("lets SITE_ENV overrule Vercel, e.g. to keep a production-branch staging site out", () => {
    expect(siteEnv({ SITE_ENV: "staging", VERCEL_ENV: "production" })).toBe("staging");
    expect(isIndexable({ SITE_ENV: "staging", VERCEL_ENV: "production" })).toBe(false);
  });
});

describe("appUrlProblem", () => {
  it("accepts a public https origin", () => {
    expect(appUrlProblem("https://www.myhoodora.com")).toBeNull();
  });

  it.each([undefined, "", "www.myhoodora.com", "http://www.myhoodora.com", "https://localhost:3000"])("rejects %j", (value) => {
    expect(appUrlProblem(value)).toMatch(/NEXT_PUBLIC_APP_URL/);
  });
});
