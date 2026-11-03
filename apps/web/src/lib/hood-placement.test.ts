import { describe, expect, it } from "vitest";
import { createProblem, hoodPlacement, resizeProblem } from "./hood-placement";

const BODIJA = { name: "Bodija", center: { lat: 7.4306, lng: 3.9017 }, radiusMeters: 3000 };
/** `m` metres due east of Bodija's centre. */
const east = (m: number) => ({ lat: BODIJA.center.lat, lng: BODIJA.center.lng + m / (111_195 * Math.cos((BODIJA.center.lat * Math.PI) / 180)) });

describe("hoodPlacement", () => {
  it("allows a circle that overlaps another, and says which", () => {
    const p = hoodPlacement({ name: "Agodi", center: east(3500), radiusMeters: 1000 }, [BODIJA]);
    expect(createProblem(p)).toBeNull();
    expect(p.sharesWith.map((h) => h.name)).toEqual(["Bodija"]);
  });

  it("refuses a centre inside another Hood", () => {
    expect(createProblem(hoodPlacement({ name: "Bodija North", center: east(2000), radiusMeters: 500 }, [BODIJA]))).toMatch(/centre is inside Bodija/);
  });

  it("refuses a radius that covers another Hood's centre, on creation and on growing", () => {
    const p = hoodPlacement({ name: "Eleyele", center: east(-4000), radiusMeters: 4500 }, [BODIJA]);
    expect(createProblem(p)).toMatch(/cover the centre of Bodija/);
    expect(resizeProblem(p)).toMatch(/cover the centre of Bodija/);
    expect(resizeProblem(hoodPlacement({ name: "Eleyele", center: east(-4000), radiusMeters: 3500 }, [BODIJA]))).toBeNull();
  });

  it("finds nothing to share or refuse with a Hood well clear of it", () => {
    expect(hoodPlacement({ name: "Iwo Road", center: east(6000), radiusMeters: 1000 }, [BODIJA])).toEqual({ inside: [], covers: [], sharesWith: [] });
  });
});
