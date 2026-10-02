"use client";

import { useEffect, useRef } from "react";
import { Map, Marker, NavigationControl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

// Same no-key tile source as the onboarding map (see location-map.tsx).
const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

/** GeoJSON polygon approximating a circle of `radiusM` metres. */
function circle(lng: number, lat: number, radiusM: number, steps = 64) {
  const coords: [number, number][] = [];
  const dLat = radiusM / 111_320;
  const dLng = radiusM / (111_320 * Math.cos((lat * Math.PI) / 180));
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * 2 * Math.PI;
    coords.push([lng + dLng * Math.cos(t), lat + dLat * Math.sin(t)]);
  }
  return {
    type: "Feature" as const,
    properties: {},
    geometry: { type: "Polygon" as const, coordinates: [coords] },
  };
}

interface AlertsMapProps {
  lat: number;
  lng: number;
  radiusMeters: number;
}

/**
 * Neighbourhood map for the Alerts page (Nextdoor's map-first alerts).
 * Alert pins will be added once alert posts carry coordinates
 * (planned `location` field — docs/api-contract.md).
 */
export default function AlertsMap({ lat, lng, radiusMeters }: AlertsMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const map = new Map({
      container: containerRef.current,
      style: STYLE_URL,
      center: [lng, lat],
      zoom: 14,
      attributionControl: { compact: true },
      cooperativeGestures: true,
    });
    map.addControl(new NavigationControl({ showCompass: false }), "bottom-right");

    map.on("load", () => {
      map.addSource("hood", { type: "geojson", data: circle(lng, lat, radiusMeters) });
      map.addLayer({ id: "hood-fill", type: "fill", source: "hood", paint: { "fill-color": "#147c73", "fill-opacity": 0.08 } });
      map.addLayer({ id: "hood-line", type: "line", source: "hood", paint: { "line-color": "#147c73", "line-width": 2, "line-dasharray": [2, 2] } });
      map.fitBounds(
        [
          [lng - radiusMeters / 90_000, lat - radiusMeters / 111_000],
          [lng + radiusMeters / 90_000, lat + radiusMeters / 111_000],
        ],
        { padding: 24, duration: 0 },
      );
    });

    const home = document.createElement("div");
    home.className = "flex size-9 items-center justify-center rounded-full bg-foreground text-background shadow-lg ring-4 ring-card";
    home.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3 2 12h3v8h6v-6h2v6h6v-8h3z"/></svg>';
    home.setAttribute("aria-label", "Your home");
    new Marker({ element: home }).setLngLat([lng, lat]).addTo(map);

    return () => map.remove();
  }, [lat, lng, radiusMeters]);

  return <div ref={containerRef} className="size-full" role="img" aria-label="Map of your neighbourhood" />;
}
