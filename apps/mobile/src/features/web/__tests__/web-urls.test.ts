import { isOurSite, isSamePage, isSameSite, loadInApp, pageTitle, webPageUrl } from "../web-urls";

const SITE = "https://myhoodora.com";

describe("in-app web pages", () => {
  it("opens only paths on our own site", () => {
    expect(webPageUrl(SITE, "/guidelines")).toBe("https://myhoodora.com/guidelines");
    expect(webPageUrl(`${SITE}/`, "/business/get-started?x=1")).toBe("https://myhoodora.com/business/get-started?x=1");
    for (const bad of ["https://evil.example", "//evil.example", "javascript:alert(1)", "guidelines", "/a b", undefined]) {
      expect(webPageUrl(SITE, bad)).toBe("https://myhoodora.com/");
    }
  });

  it("keeps our pages in the app and sends other sites to the browser", () => {
    expect(isSameSite("https://myhoodora.com/terms", SITE)).toBe(true);
    expect(isSameSite("https://myhoodora.com.evil.example/terms", SITE)).toBe(false);
    expect(isSameSite("http://myhoodora.com/terms", SITE)).toBe(false);
    expect(isSameSite("mailto:hello@myhoodora.com", SITE)).toBe(false);
  });

  it("shows the page's own title, without the site name", () => {
    expect(pageTitle("Community guidelines | myHoodora")).toBe("Community guidelines");
    expect(pageTitle("https://myhoodora.com/terms")).toBe("");
    expect(pageTitle(undefined)).toBe("");
  });

  it("keeps the policy sheet on the document being read, through www redirects", () => {
    expect(isSamePage("https://myhoodora.com/terms", SITE, "/terms")).toBe(true);
    expect(isSamePage("https://www.myhoodora.com/terms/", SITE, "/terms")).toBe(true);
    expect(isSamePage("https://www.myhoodora.com/terms#section", SITE, "/terms")).toBe(true);
    expect(isSamePage("https://myhoodora.com/privacy", SITE, "/terms")).toBe(false);
    expect(isSamePage("http://myhoodora.com/terms", SITE, "/terms")).toBe(false);
    expect(isSamePage("https://myhoodora.com.evil.example/terms", SITE, "/terms")).toBe(false);
    expect(isSamePage("mailto:privacy@myhoodora.com", SITE, "/terms")).toBe(false);
  });

  it("counts www and the bare domain as our site, nothing else", () => {
    expect(isOurSite("https://www.myhoodora.com/privacy", SITE)).toBe(true);
    expect(isOurSite("https://myhoodora.com/privacy", "https://www.myhoodora.com")).toBe(true);
    expect(isOurSite("https://myhoodora.com.evil.example/", SITE)).toBe(false);
    expect(isOurSite("http://myhoodora.com/", SITE)).toBe(false);
  });

  it("keeps the page's own frames in the app on iOS; only tapped links to other places leave", () => {
    const opened: string[] = [];
    const keep = (u: string) => isSamePage(u, SITE, "/privacy");
    const load = (url: string, isTopFrame?: boolean) => loadInApp({ url, isTopFrame }, keep, (u) => opened.push(u));
    expect(load("https://www.myhoodora.com/privacy", true)).toBe(true);
    // iOS asks about analytics and embedded frames inside the page: they load there, Safari never opens.
    expect(load("https://www.googletagmanager.com/ns.html?id=X", false)).toBe(true);
    expect(load("about:blank", true)).toBe(true);
    expect(opened).toEqual([]);
    // A link to another policy or a mail address goes to the browser or mail app.
    expect(load("https://www.myhoodora.com/terms", true)).toBe(false);
    expect(load("mailto:privacy@myhoodora.com", undefined)).toBe(false);
    expect(opened).toEqual(["https://www.myhoodora.com/terms", "mailto:privacy@myhoodora.com"]);
  });
});
