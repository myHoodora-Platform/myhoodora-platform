/** Great-circle distance between two points, in metres (haversine). */
export function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6_371_000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Web-Mercator metres per CSS pixel on a MapLibre map at a latitude and zoom: the Earth's circumference
 * over the world's width in pixels, which in MapLibre is 512 at zoom 0 (not the 256 of raster tile maps).
 * The radius is MapLibre's, so circles drawn with this line up with its projection.
 */
export function metersPerPixel(lat: number, zoom: number): number {
  return (2 * Math.PI * 6_371_008.8 * Math.cos((lat * Math.PI) / 180)) / (512 * 2 ** zoom);
}
