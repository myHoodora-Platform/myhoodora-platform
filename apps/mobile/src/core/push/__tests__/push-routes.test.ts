import { FALLBACK_ROUTE, isAppRoute, routeForHref } from "../push-routes";

describe("where a tapped push goes", () => {
  it("opens the screens the app has, at the web's own paths", () => {
    expect(routeForHref("/p/66f1c0ffee")).toBe("/p/66f1c0ffee");
    expect(routeForHref("/news-feed")).toBe("/news-feed");
    expect(routeForHref("/notifications")).toBe("/notifications");
    expect(routeForHref("/for-sale/66f1c0ffee")).toBe("/for-sale/66f1c0ffee");
    expect(routeForHref("/inbox/66f1c0ffee")).toBe("/inbox/66f1c0ffee");
    expect(routeForHref("/settings/notifications")).toBe("/settings/notifications");
    expect(routeForHref("/inbox/support/66f1c0ffee")).toBe("/inbox/support/66f1c0ffee");
    expect(routeForHref("/settings/neighbourhoods")).toBe("/settings/neighbourhoods");
  });

  it("drops a query or fragment", () => {
    expect(routeForHref("/p/abc?comment=1#c2")).toBe("/p/abc");
  });

  it("groups open in the app, keeping only a group invite's token", () => {
    expect(routeForHref("/groups")).toBe("/groups");
    expect(routeForHref("/g/66f1c0ffee/manage")).toBe("/g/66f1c0ffee/manage");
    expect(routeForHref("/g/66f1c0ffee?invite=Ab3_dEf-gh1234")).toBe("/g/66f1c0ffee?invite=Ab3_dEf-gh1234");
    // Not on other routes, and nothing odd in the token.
    expect(routeForHref("/g/66f1c0ffee/manage?invite=Ab3_dEf-gh1234")).toBe("/g/66f1c0ffee/manage");
    expect(routeForHref("/g/66f1c0ffee?invite=a%2Fb%3Fx")).toBe("/g/66f1c0ffee");
    expect(isAppRoute("/g/66f1c0ffee?invite=Ab3_dEf-gh1234")).toBe(true);
  });

  it("anything else opens the notifications list, never an arbitrary route or URL", () => {
    for (const href of ["/events/123", "/g/9/posts", "/settings/moderation", "/inbox/support/1/x", "https://evil.example/p/1", "//evil.example", "/p/../admin", "", undefined, 42]) {
      expect(routeForHref(href)).toBe(FALLBACK_ROUTE);
    }
  });

  it("isAppRoute tells the notifications list whether to open in the app or on the web", () => {
    expect(isAppRoute("/p/abc")).toBe(true);
    expect(isAppRoute("/for-sale/1")).toBe(true);
    expect(isAppRoute("/events/1")).toBe(false);
  });
});
