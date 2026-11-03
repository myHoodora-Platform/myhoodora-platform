import { cardPlacement, holePath, isOnScreen, spotlight } from "../placement";

const SCREEN = { width: 360, height: 800 };

describe("tour placement", () => {
  it("pads the spotlight but keeps it on screen", () => {
    expect(spotlight({ x: 0, y: 100, width: 50, height: 40 }, SCREEN)).toEqual({ x: 4, y: 94, width: 52, height: 52 });
    expect(spotlight({ x: 300, y: 760, width: 60, height: 40 }, SCREEN)).toEqual({ x: 294, y: 754, width: 62, height: 42 });
  });

  it("passes over an element that's hidden or off screen", () => {
    expect(isOnScreen({ x: 0, y: 0, width: 0, height: 0 }, SCREEN)).toBe(false);
    expect(isOnScreen({ x: 10, y: 900, width: 50, height: 50 }, SCREEN)).toBe(false);
    expect(isOnScreen({ x: 10, y: 100, width: 50, height: 50 }, SCREEN)).toBe(true);
  });

  it("puts the card on the roomier side", () => {
    expect(cardPlacement({ x: 0, y: 100, width: 50, height: 50 }, SCREEN)).toEqual({ top: 164 });
    expect(cardPlacement({ x: 0, y: 700, width: 50, height: 60 }, SCREEN)).toEqual({ bottom: 114 });
  });

  it("cuts a hole the size of the spotlight", () => {
    const path = holePath({ x: 10, y: 20, width: 100, height: 40 }, SCREEN, 16);
    expect(path.startsWith("M0 0H360V800H0Z")).toBe(true);
    expect(path).toContain("M26 20H94");
  });
});
