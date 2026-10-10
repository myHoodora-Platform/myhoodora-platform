import { describe, expect, it } from "vitest";
import { publicPageMetadata } from "./site";

describe("publicPageMetadata", () => {
  it("gives a page its own title, description, canonical URL and preview card", () => {
    const meta = publicPageMetadata("/about", { title: "About myHoodora", description: "Who we are." });
    expect(meta.title).toBe("About myHoodora");
    expect(meta.alternates?.canonical).toBe("/about");
    expect(meta.openGraph).toMatchObject({ url: "/about", title: "About myHoodora", description: "Who we are.", siteName: "myHoodora" });
    expect(meta.twitter).toMatchObject({ card: "summary_large_image", title: "About myHoodora" });
  });
});
