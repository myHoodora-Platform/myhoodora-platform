import { describe, expect, it } from "vitest";
import { needsScroll, preferredSide } from "./placement";

const box = (top: number, left: number, width: number, height: number) => ({
  top,
  left,
  right: left + width,
  bottom: top + height,
});

describe("preferredSide", () => {
  it("puts the card above targets low on screen (mobile tab bar)", () => {
    expect(preferredSide(box(780, 150, 70, 64), { width: 390, height: 844 })).toBe("top");
  });

  it("puts the card beside the desktop sidebar", () => {
    expect(preferredSide(box(200, 24, 232, 48), { width: 1440, height: 900 })).toBe("right");
  });

  it("puts the card below in-page targets", () => {
    expect(preferredSide(box(120, 300, 600, 110), { width: 1440, height: 900 })).toBe("bottom");
  });

  it("doesn't treat left-edge content on tablets as the sidebar", () => {
    expect(preferredSide(box(150, 16, 200, 40), { width: 820, height: 1180 })).toBe("bottom");
  });
});

describe("needsScroll", () => {
  const viewport = { width: 390, height: 844 };

  it("leaves targets that are clearly on screen", () => {
    expect(needsScroll(box(200, 0, 300, 100), viewport)).toBe(false);
  });

  it("scrolls targets below the fold or hidden under the tab bar", () => {
    expect(needsScroll(box(1200, 0, 300, 100), viewport)).toBe(true);
    expect(needsScroll(box(740, 0, 300, 60), viewport)).toBe(true);
  });

  it("scrolls targets hidden under the sticky header", () => {
    expect(needsScroll(box(40, 0, 300, 100), viewport)).toBe(true);
  });
});
