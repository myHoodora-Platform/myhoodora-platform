import * as Sentry from "@sentry/react-native";
import { EDGE_PAGE_REPORT_EVERY_MS, crashNatively, initMonitoring, monitoringEnabled, reportEdgePage, reportError, sendTestError, setMonitoringUser, TEST_PII } from "../monitoring";
import { scrubBreadcrumb, scrubEvent } from "../scrub";

jest.mock("@sentry/react-native", () => ({ init: jest.fn(), setTags: jest.fn(), setUser: jest.fn(), captureException: jest.fn(), captureMessage: jest.fn(), addBreadcrumb: jest.fn(), nativeCrash: jest.fn() }));
jest.mock("expo-application", () => ({ nativeApplicationVersion: "1.0.0", nativeBuildVersion: "42" }));

const DSN = "https://public@o1.ingest.sentry.io/1";

beforeEach(() => {
  jest.clearAllMocks();
  // In development reportError also logs; that's expected here, not noise worth printing.
  jest.spyOn(console, "warn").mockImplementation(() => undefined);
});

describe("monitoringEnabled", () => {
  it.each([
    ["development", DSN, false],
    ["preview", DSN, true],
    ["production", DSN, true],
    ["production", undefined, false],
  ] as const)("%s with dsn %s → %s", (appEnv, sentryDsn, expected) => {
    expect(monitoringEnabled({ appEnv, sentryDsn })).toBe(expected);
  });
});

describe("initMonitoring", () => {
  it("does nothing in development", () => {
    initMonitoring({ appEnv: "development", sentryDsn: DSN });
    expect(Sentry.init).not.toHaveBeenCalled();
    reportError(new Error("x"), "test");
    setMonitoringUser("uid-1");
    expect(Sentry.captureException).not.toHaveBeenCalled();
    expect(Sentry.setUser).not.toHaveBeenCalled();
  });

  it("starts Sentry privately in production, tagged with environment, version and build", () => {
    initMonitoring({ appEnv: "production", sentryDsn: DSN });
    expect(Sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({ dsn: DSN, environment: "production", sendDefaultPii: false, attachScreenshot: false, attachViewHierarchy: false, beforeSend: expect.any(Function), beforeBreadcrumb: expect.any(Function) }),
    );
    expect(Sentry.setTags).toHaveBeenCalledWith({ app_version: "1.0.0", build_number: "42" });
  });

  it("then reports errors with where they happened, and the user as uid only", () => {
    initMonitoring({ appEnv: "preview", sentryDsn: DSN });
    const error = new Error("boom");
    reportError(error, "push-register");
    expect(Sentry.captureException).toHaveBeenCalledWith(error, { tags: { where: "push-register" } });
    setMonitoringUser("uid-1");
    expect(Sentry.setUser).toHaveBeenLastCalledWith({ id: "uid-1" });
    setMonitoringUser(null);
    expect(Sentry.setUser).toHaveBeenLastCalledWith(null);
  });

  it("scrubs every event through beforeSend", () => {
    initMonitoring({ appEnv: "production", sentryDsn: DSN });
    const { beforeSend } = (Sentry.init as jest.Mock).mock.calls[0][0];
    expect(beforeSend({ type: undefined, user: { id: "u", email: "a@b.co" } }).user).toEqual({ id: "u" });
  });
});

describe("reportEdgePage", () => {
  const page = { status: 403, host: "api.myhoodora.com", route: "/api/feed", server: "cloudflare", mitigated: "challenge", ray: "8f1a2b3c4d5e6f70-LOS" };

  it("reports a web page in place of the API as a warning, at most once every 10 minutes", () => {
    initMonitoring({ appEnv: "production", sentryDsn: DSN });
    reportEdgePage(page, 1_000_000);
    expect(Sentry.captureMessage).toHaveBeenCalledWith("A web page instead of the API (403)", {
      level: "warning",
      tags: { where: "api-edge-page", status: "403", host: "api.myhoodora.com", route: "/api/feed", server: "cloudflare", cf_mitigated: "challenge" },
      extra: { cf_ray: "8f1a2b3c4d5e6f70-LOS" },
    });
    reportEdgePage({ ...page, status: 503 }, 1_000_000 + EDGE_PAGE_REPORT_EVERY_MS - 1);
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(1);
    reportEdgePage({ ...page, mitigated: null, server: null }, 1_000_000 + EDGE_PAGE_REPORT_EVERY_MS);
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(2);
    expect((Sentry.captureMessage as jest.Mock).mock.calls[1][1].tags).toMatchObject({ server: "none", cf_mitigated: "none" });
  });

  it("sends nothing in development", () => {
    initMonitoring({ appEnv: "development", sentryDsn: DSN });
    reportEdgePage(page, 9_000_000_000);
    expect(Sentry.captureMessage).not.toHaveBeenCalled();
  });
});

describe("diagnostics", () => {
  it("sends a test error whose made-up personal details the scrubber removes", () => {
    sendTestError();
    const [error, hint] = (Sentry.captureException as jest.Mock).mock.calls[0];
    const crumb = (Sentry.addBreadcrumb as jest.Mock).mock.calls[0][0];
    const event = scrubEvent({ type: undefined, exception: { values: [{ type: "Error", value: (error as Error).message }] }, extra: hint.extra, breadcrumbs: [crumb] });
    const sent = JSON.stringify(event);
    for (const secret of [TEST_PII.email, TEST_PII.phone, TEST_PII.token.replace("Bearer ", "")]) expect(sent).not.toContain(secret);
    expect(sent).toContain("[Filtered]");
    expect(scrubBreadcrumb(crumb)?.message).not.toContain(TEST_PII.email);
  });

  it("crashes natively through Sentry", () => {
    crashNatively();
    expect(Sentry.nativeCrash).toHaveBeenCalled();
  });
});
