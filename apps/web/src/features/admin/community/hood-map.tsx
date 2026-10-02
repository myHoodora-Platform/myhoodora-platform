"use client";

import { useEffect, useRef, useState } from "react";
import { Map as MapLibre, Marker, NavigationControl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

function zoomFor(radiusMeters: number) {
  return Math.max(10, Math.min(16, 15.2 - Math.log2(radiusMeters / 400)));
}

/** Web-Mercator metres per CSS pixel at a latitude/zoom. */
function metersPerPixel(lat: number, zoom: number) {
  return (156_543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom;
}

/**
 * A Hood's centre and boundary radius on a map. The boundary is an SVG
 * overlay projected from the map camera, so it shows immediately and never
 * depends on tile/style loading. Updates live as inputs change.
 */
export function HoodMap({ lat, lng, radiusMeters, className }: { lat: number; lng: number; radiusMeters: number; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibre | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const latest = useRef({ lat, lng, radiusMeters });
  latest.current = { lat, lng, radiusMeters };
  const [ring, setRing] = useState<{ x: number; y: number; r: number } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const map = new MapLibre({
      container: containerRef.current,
      style: STYLE_URL,
      center: [lng, lat],
      zoom: zoomFor(radiusMeters),
      attributionControl: { compact: true },
    });
    map.addControl(new NavigationControl({ showCompass: false }));
    markerRef.current = new Marker({ color: "#147C73" }).setLngLat([lng, lat]).addTo(map);
    const project = () => {
      const { lat: la, lng: ln, radiusMeters: r } = latest.current;
      const p = map.project([ln, la]);
      setRing({ x: p.x, y: p.y, r: r / metersPerPixel(la, map.getZoom()) });
    };
    map.on("move", project);
    map.on("resize", project);
    project();
    mapRef.current = map;
    return () => map.remove();
    // Map is created once; the effect below keeps it in sync.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
    markerRef.current?.setLngLat([lng, lat]);
    map.easeTo({ center: [lng, lat], zoom: zoomFor(radiusMeters), duration: 400 });
    const p = map.project([lng, lat]);
    setRing({ x: p.x, y: p.y, r: radiusMeters / metersPerPixel(lat, map.getZoom()) });
  }, [lat, lng, radiusMeters]);

  return (
    <div className={`relative overflow-hidden ${className ?? "h-64 w-full"}`}>
      <div ref={containerRef} className="h-full w-full" role="img" aria-label="Map of the Hood boundary" />
      {ring && (
        <svg className="pointer-events-none absolute inset-0 size-full" aria-hidden>
          <circle cx={ring.x} cy={ring.y} r={ring.r} fill="rgba(20,124,115,0.14)" stroke="#147C73" strokeWidth={2} />
        </svg>
      )}
    </div>
  );
}
