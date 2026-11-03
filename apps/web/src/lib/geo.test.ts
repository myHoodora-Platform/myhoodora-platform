import { describe, expect, it } from "vitest";
import { MercatorCoordinate } from "maplibre-gl";
import { distanceMeters, metersPerPixel } from "./geo";

describe("metersPerPixel", () => {
  it("matches MapLibre's own scale, so Hood circles are drawn at their real size", () => {
    // MapLibre's world is 512 px across at zoom 0, in mercator units of 0 to 1.
    for (const [lat, zoom] of [[0, 0], [6.6, 13.3], [7.4, 12], [51.5, 15]] as const) {
      const unitsPerMeter = MercatorCoordinate.fromLngLat([3.3, lat]).meterInMercatorCoordinateUnits();
      expect(metersPerPixel(lat, zoom)).toBeCloseTo(1 / (unitsPerMeter * 512 * 2 ** zoom), 3);
    }
  });

  it("puts two circles that cover each other's centre close enough on screen to overlap", () => {
    // Akowonjo and Iyana Ipaja: 1,625 m apart, so a 1,700 m radius reaches the other's centre.
    const akowonjo = { lat: 6.6105, lng: 3.3103 };
    const iyanaIpaja = { lat: 6.6173, lng: 3.2973 };
    const zoom = 13;
    const px = (m: number) => m / metersPerPixel(akowonjo.lat, zoom);
    const a = MercatorCoordinate.fromLngLat([akowonjo.lng, akowonjo.lat]);
    const b = MercatorCoordinate.fromLngLat([iyanaIpaja.lng, iyanaIpaja.lat]);
    const apartPx = Math.hypot(a.x - b.x, a.y - b.y) * 512 * 2 ** zoom;
    expect(distanceMeters(akowonjo, iyanaIpaja)).toBeLessThan(1700);
    expect(px(1700)).toBeGreaterThan(apartPx);
  });
});
