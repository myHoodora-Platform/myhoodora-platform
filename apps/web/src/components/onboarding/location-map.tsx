"use client";

import { useEffect, useRef } from "react";
import { Map, Marker, NavigationControl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

interface LocationMapProps {
  lat: number;
  lng: number;
}

// OpenFreeMap is a donation-funded, free-forever vector tile service built
// for MapLibre — no API key. tile.openstreetmap.org's raw tile server 503s
// third-party embeds, and CARTO's anonymous basemap tier now watermarks/
// 503s too, so OpenFreeMap is the reliable no-key option here.
const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

export function LocationMap({ lat, lng }: LocationMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const map = new Map({
      container: containerRef.current,
      style: STYLE_URL,
      center: [lng, lat],
      zoom: 15,
    });

    map.addControl(new NavigationControl({ showCompass: false }));

    new Marker({ color: "#0D9488" }).setLngLat([lng, lat]).addTo(map);

    return () => {
      map.remove();
    };
  }, [lat, lng]);

  return <div ref={containerRef} className="absolute inset-0 size-full" />;
}
