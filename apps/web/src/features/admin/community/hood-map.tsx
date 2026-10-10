"use client";

import { useEffect, useRef, useState } from "react";
import { Map as MapLibre, Marker, NavigationControl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { HoodCircle } from "@/lib/hood-placement";

const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

function zoomFor(radiusMeters: number) {
  return Math.max(10, Math.min(16, 15.2 - Math.log2(radiusMeters / 400)));
}

/** Web-Mercator metres per CSS pixel at a latitude/zoom. */
function metersPerPixel(lat: number, zoom: number) {
  return (156_543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom;
}

type Ring = { x: number; y: number; r: number };

/**
 * Where two circles cross, as a line: the boundary between overlapping Hoods (the API gives each
 * address to the Hood with the lower d² − r², which splits the shared ground exactly here).
 */
function dividingLine(a: Ring, b: Ring) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = Math.hypot(dx, dy);
  if (d === 0 || d >= a.r + b.r || d <= Math.abs(a.r - b.r)) return null;
  const along = (a.r * a.r - b.r * b.r + d * d) / (2 * d);
  const half = Math.sqrt(a.r * a.r - along * along);
  const mx = a.x + (along * dx) / d;
  const my = a.y + (along * dy) / d;
  return { x1: mx - (half * dy) / d, y1: my + (half * dx) / d, x2: mx + (half * dy) / d, y2: my - (half * dx) / d };
}

/**
 * A Hood's centre and boundary radius on a map, with the Hoods around it (`others`) and the line
 * that divides any ground they share. The overlay is SVG projected from the map camera, so it shows
 * immediately and never depends on tile/style loading. Updates live as inputs change.
 */
export function HoodMap({ lat, lng, radiusMeters, others = [], className }: { lat: number; lng: number; radiusMeters: number; others?: HoodCircle[]; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibre | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const projectRef = useRef<() => void>(() => undefined);
  const latest = useRef({ lat, lng, radiusMeters, others });
  latest.current = { lat, lng, radiusMeters, others };
  const [overlay, setOverlay] = useState<{ ring: Ring; others: (Ring & { name: string })[] } | null>(null);
  const othersKey = others.map((o) => `${o.name}:${o.center.lat},${o.center.lng},${o.radiusMeters}`).join("|");

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
    const toRing = (la: number, ln: number, r: number): Ring => {
      const p = map.project([ln, la]);
      return { x: p.x, y: p.y, r: r / metersPerPixel(la, map.getZoom()) };
    };
    const project = () => {
      const { lat: la, lng: ln, radiusMeters: r, others: os } = latest.current;
      if (!Number.isFinite(la) || !Number.isFinite(ln)) return;
      setOverlay({ ring: toRing(la, ln, r), others: os.map((o) => ({ name: o.name, ...toRing(o.center.lat, o.center.lng, o.radiusMeters) })) });
    };
    projectRef.current = project;
    map.on("move", project);
    map.on("resize", project);
    project();
    mapRef.current = map;
    return () => map.remove();
    // Map is created once; the effects below keep it in sync.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
    markerRef.current?.setLngLat([lng, lat]);
    map.easeTo({ center: [lng, lat], zoom: zoomFor(radiusMeters), duration: 400 });
    projectRef.current();
  }, [lat, lng, radiusMeters]);

  useEffect(() => projectRef.current(), [othersKey]);

  const label = others.length ? "Map of the Hood boundary, the Hoods around it, and the lines dividing shared ground" : "Map of the Hood boundary";

  return (
    <div className={`relative overflow-hidden ${className ?? "h-64 w-full"}`}>
      <div ref={containerRef} className="h-full w-full" role="img" aria-label={label} />
      {overlay && (
        <svg className="pointer-events-none absolute inset-0 size-full" aria-hidden>
          {overlay.others.map((o) => (
            <g key={o.name}>
              <circle cx={o.x} cy={o.y} r={o.r} fill="rgba(100,116,139,0.08)" stroke="#64748B" strokeWidth={1.5} strokeDasharray="4 4" />
              <text x={o.x} y={o.y} textAnchor="middle" dominantBaseline="middle" fontSize={11} fontWeight={600} fill="#475569" stroke="#fff" strokeWidth={3} paintOrder="stroke">
                {o.name}
              </text>
            </g>
          ))}
          <circle cx={overlay.ring.x} cy={overlay.ring.y} r={overlay.ring.r} fill="rgba(20,124,115,0.14)" stroke="#147C73" strokeWidth={2} />
          {overlay.others.map((o) => {
            const line = dividingLine(overlay.ring, o);
            return line && <line key={`${o.name}-line`} {...line} stroke="#147C73" strokeWidth={2} strokeDasharray="6 4" />;
          })}
        </svg>
      )}
    </div>
  );
}
