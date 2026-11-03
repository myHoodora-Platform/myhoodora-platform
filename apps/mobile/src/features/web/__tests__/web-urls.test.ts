import { isSameSite, pageTitle, webPageUrl } from "../web-urls";

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
});
