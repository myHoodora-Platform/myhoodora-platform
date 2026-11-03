"use client";

import { useEffect, useRef } from "react";
import { Map, Marker, NavigationControl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

type Point = { lat: number; lng: number };

interface LocationMapProps {
  lat: number;
  lng: number;
  /** Lets the neighbour put their home right: clicking the map moves the pin there, and the pin can be dragged. */
  onPick?: (point: Point) => void;
}

// OpenFreeMap is a donation-funded, free-forever vector tile service built
// for MapLibre — no API key. tile.openstreetmap.org's raw tile server 503s
// third-party embeds, and CARTO's anonymous basemap tier now watermarks/
// 503s too, so OpenFreeMap is the reliable no-key option here.
const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

/** ~0.1 m: as precise as any phone's GPS. */
const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

export function LocationMap({ lat, lng, onPick }: LocationMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;
  /** The last point sent through onPick: it's already in view, so the map doesn't recentre on it. */
  const picked = useRef<Point | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const map = new Map({
      container: containerRef.current,
      style: STYLE_URL,
      center: [lng, lat],
      zoom: 16,
      // Compact attribution (a small "i" toggle) instead of the full open text
      // bar — required credit stays, but on this short 192px-tall container it
      // no longer spans the full width and collides with the "GPS Connected"
      // badge, which was worst on narrow phone screens.
      attributionControl: { compact: true },
    });

    map.addControl(new NavigationControl({ showCompass: false }));

    const pickable = Boolean(onPickRef.current);
    const marker = new Marker({ color: "#0D9488", draggable: pickable }).setLngLat([lng, lat]).addTo(map);
    if (pickable) {
      const pick = (p: Point) => {
        picked.current = { lat: round6(p.lat), lng: round6(p.lng) };
        onPickRef.current?.(picked.current);
      };
      map.getCanvas().style.cursor = "crosshair";
      map.on("click", (e) => {
        marker.setLngLat(e.lngLat);
        pick(e.lngLat);
      });
      marker.on("dragend", () => pick(marker.getLngLat()));
    }
    mapRef.current = map;
    markerRef.current = marker;

    return () => {
      map.remove();
    };
    // Created once; the effect below follows new points.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    markerRef.current?.setLngLat([lng, lat]);
    const p = picked.current;
    if (!p || p.lat !== lat || p.lng !== lng) mapRef.current?.easeTo({ center: [lng, lat], duration: 400 });
  }, [lat, lng]);

  return <div ref={containerRef} className="absolute inset-0 size-full" />;
}
