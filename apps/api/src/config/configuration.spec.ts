import configuration, { validateEnv } from "./configuration";

const production = {
  NODE_ENV: "production",
  MONGODB_URI: "mongodb+srv://example",
  APP_URL: "https://www.example.com",
  CORS_ORIGIN: "https://www.example.com",
  RESEND_API_KEY: "re_x",
  RESEND_WEBHOOK_SECRET: "whsec_x",
  MAIL_FROM: "a <a@example.com>",
  REDIS_URL: "rediss://x",
  CLOUDINARY_URL: "cloudinary://key:secret@cloud",
};
const firebase = { FIREBASE_PROJECT_ID: "p", FIREBASE_CLIENT_EMAIL: "a@p.iam.gserviceaccount.com", FIREBASE_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----" };

describe("validateEnv", () => {
  it("lets development start with almost nothing set", () => {
    expect(() => validateEnv({ NODE_ENV: "development" })).not.toThrow();
  });

  it("production needs Firebase Admin credentials: all three values, or a service-account file", () => {
    expect(() => validateEnv({ ...production })).toThrow(/FIREBASE_PROJECT_ID \+ FIREBASE_CLIENT_EMAIL \+ FIREBASE_PRIVATE_KEY \(or GOOGLE_APPLICATION_CREDENTIALS\)/);
    expect(() => validateEnv({ ...production, FIREBASE_PROJECT_ID: "p" })).toThrow(/FIREBASE_CLIENT_EMAIL \+ FIREBASE_PRIVATE_KEY/);
    expect(() => validateEnv({ ...production, ...firebase })).not.toThrow();
    expect(() => validateEnv({ ...production, GOOGLE_APPLICATION_CREDENTIALS: "/etc/secrets/sa.json" })).not.toThrow();
  });

  it("production names every missing variable, and never echoes a value", () => {
    expect(() => validateEnv({ ...production, ...firebase, RESEND_API_KEY: "", APP_URL: "" })).toThrow("Missing required environment variables: APP_URL, RESEND_API_KEY");
    expect(() => validateEnv({ ...production, ...firebase, CLOUDINARY_URL: "cloudinary://not-a-valid-shape" })).toThrow(/CLOUDINARY_URL must look like/);
    try {
      validateEnv({ ...production, ...firebase, CLOUDINARY_URL: "cloudinary://topsecret" });
    } catch (err) {
      expect((err as Error).message).not.toContain("topsecret");
    }
  });
});

describe("session cookie lifetime", () => {
  const ttlDays = (value?: string) => {
    const before = process.env.SESSION_COOKIE_TTL_DAYS;
    if (value === undefined) delete process.env.SESSION_COOKIE_TTL_DAYS;
    else process.env.SESSION_COOKIE_TTL_DAYS = value;
    const ms = configuration().auth.sessionTtlMs;
    if (before === undefined) delete process.env.SESSION_COOKIE_TTL_DAYS;
    else process.env.SESSION_COOKIE_TTL_DAYS = before;
    return ms / 86_400_000;
  };

  it("defaults to 7 days and stays inside what Firebase allows (5 minutes to 14 days)", () => {
    expect(ttlDays()).toBe(7);
    expect(ttlDays("3")).toBe(3);
    expect(ttlDays("60")).toBe(14);
    expect(ttlDays("nonsense")).toBe(7);
    expect(ttlDays("0.0001")).toBeCloseTo(5 / (24 * 60), 6);
  });
});

describe("revocation memory", () => {
  const seconds = (value?: string) => {
    const before = process.env.AUTH_REVOCATION_CACHE_SECONDS;
    if (value === undefined) delete process.env.AUTH_REVOCATION_CACHE_SECONDS;
    else process.env.AUTH_REVOCATION_CACHE_SECONDS = value;
    const ms = configuration().auth.revocationCacheMs;
    if (before === undefined) delete process.env.AUTH_REVOCATION_CACHE_SECONDS;
    else process.env.AUTH_REVOCATION_CACHE_SECONDS = before;
    return ms / 1000;
  };

  it("is 30 seconds by default, can be turned off with 0, and is capped at 5 minutes", () => {
    expect(seconds()).toBe(30);
    expect(seconds("")).toBe(30);
    expect(seconds("0")).toBe(0);
    expect(seconds("10")).toBe(10);
    expect(seconds("86400")).toBe(300);
    expect(seconds("-5")).toBe(0);
    expect(seconds("soon")).toBe(30);
  });
});

