import type { Breadcrumb, ErrorEvent } from "@sentry/react-native";
import { FILTERED, redact, scrubBreadcrumb, scrubData, scrubEvent, stripUrl } from "../scrub";

const JWT = "eyJhbGciOiJSUzI1NiJ9.eyJ1aWQiOiJhYmMxMjMifQ.c2lnbmF0dXJlLXZhbHVl";

describe("redact", () => {
  it.each([
    ["an email", "Sent to ada.obi+test@example.com.ng today", "Sent to [Filtered] today"],
    ["a bearer token", "Authorization: Bearer abc.DEF-123_xyz", "Authorization: Bearer [Filtered]"],
    ["a bare JWT", `token ${JWT} expired`, "token [Filtered] expired"],
    ["an Expo push token", "/push/devices/ExponentPushToken[xxxx-yyyy]", "/push/devices/[Filtered]"],
    ["an international phone number", "Call +234 803 123 4567 now", "Call [Filtered] now"],
    ["a local Nigerian number", "Call 08031234567 now", "Call [Filtered] now"],
  ])("removes %s", (_name, input, expected) => {
    expect(redact(input)).toBe(expected);
  });

  it("leaves ordinary diagnostics alone (dates, ids, counts)", () => {
    const text = "Post 6650f1c2a9 failed at 2026-10-26 07:34 after 3 retries (status 503)";
    expect(redact(text)).toBe(text);
  });
});

describe("stripUrl", () => {
  it("drops the query (search terms, tokens) and the fragment", () => {
    expect(stripUrl("https://api.test/api/search?q=my+street+address&type=posts#top")).toBe("https://api.test/api/search");
  });
});

describe("scrubData", () => {
  it("filters values under sensitive keys and redacts strings deep inside", () => {
    expect(scrubData({ postId: "p1", content: "my words", nested: { email: "a@b.co", note: "reach me on a@b.co" }, list: ["08031234567"] })).toEqual({
      postId: "p1",
      content: FILTERED,
      nested: { email: FILTERED, note: `reach me on ${FILTERED}` },
      list: [FILTERED],
    });
  });
});

describe("scrubBreadcrumb", () => {
  it("keeps only method, address without query, and status for HTTP calls", () => {
    const crumb: Breadcrumb = {
      category: "fetch",
      data: { method: "POST", url: "https://api.test/api/posts?draft=1", status_code: 201, request_body: '{"message":"hello"}', response: "..." },
    };
    expect(scrubBreadcrumb(crumb)?.data).toEqual({ method: "POST", url: "https://api.test/api/posts", status_code: 201 });
  });

  it("drops console arguments and redacts the line", () => {
    const crumb: Breadcrumb = { category: "console", message: "signed in as ada@example.com", data: { arguments: ["ada@example.com", { token: JWT }], logger: "console" } };
    expect(scrubBreadcrumb(crumb)).toEqual({ category: "console", message: `signed in as ${FILTERED}`, data: { logger: "console" } });
  });

  it("keeps which component was tapped, but not its label", () => {
    const crumb: Breadcrumb = { category: "touch", data: { path: [{ name: "Pressable", label: "Message Ada Obi" }, { name: "PostCard" }] } };
    expect(scrubBreadcrumb(crumb)?.data).toEqual({ path: [{ name: "Pressable" }, { name: "PostCard" }] });
  });
});

describe("scrubEvent", () => {
  it("keeps only the uid, strips the request, and redacts messages, exceptions, extra and breadcrumbs", () => {
    const event = {
      type: undefined,
      message: "Failed for ada@example.com",
      user: { id: "uid-1", email: "ada@example.com", username: "Ada", ip_address: "1.2.3.4" },
      request: {
        method: "POST",
        url: "https://api.test/api/search?q=12+Allen+Avenue",
        headers: { Authorization: `Bearer ${JWT}`, Cookie: "session=abc" },
        data: '{"message":"private words"}',
        query_string: "q=12+Allen+Avenue",
        cookies: { session: "abc" },
      },
      exception: { values: [{ type: "Error", value: `Token ${JWT} rejected for 08031234567` }] },
      extra: { address: "12 Allen Avenue", attempt: 2 },
      contexts: { device: { name: "Ada's iPhone", model: "iPhone17,1" }, os: { name: "iOS" } },
      breadcrumbs: [{ category: "xhr", data: { method: "GET", url: "https://api.test/api/users/me?x=1", status_code: 200 } }],
    } as ErrorEvent;

    const out = scrubEvent(event);
    expect(out.message).toBe(`Failed for ${FILTERED}`);
    expect(out.user).toEqual({ id: "uid-1" });
    expect(out.request).toEqual({ method: "POST", url: "https://api.test/api/search" });
    expect(out.exception?.values?.[0]?.value).toBe(`Token ${FILTERED} rejected for ${FILTERED}`);
    expect(out.extra).toEqual({ address: FILTERED, attempt: 2 });
    expect(out.contexts).toEqual({ device: { model: "iPhone17,1" }, os: { name: "iOS" } });
    expect(out.breadcrumbs?.[0]?.data).toEqual({ method: "GET", url: "https://api.test/api/users/me", status_code: 200 });
    // Nothing sensitive survives anywhere in the event.
    const text = JSON.stringify(out);
    for (const secret of ["ada@example.com", JWT, "Allen", "private words", "session=abc", "08031234567", "Ada's iPhone", "1.2.3.4"]) {
      expect(text).not.toContain(secret);
    }
  });

  it("drops a user with no id rather than keep other fields", () => {
    expect(scrubEvent({ type: undefined, user: { email: "a@b.co" } } as ErrorEvent).user).toBeUndefined();
  });
});
