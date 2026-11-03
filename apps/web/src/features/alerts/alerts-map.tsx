"use client";

import { useEffect, useRef } from "react";
import { Map, Marker, NavigationControl, Popup } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { ALERT_CATEGORIES } from "@/features/feed/categories";
import { ROUTES } from "@/lib/routes";
import type { Post } from "@/lib/api/types";
import { alertStatus } from "./lifecycle";

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
  /** Alerts to pin: the ones whose poster said where (2026-10-28). */
  alerts?: Post[];
}

const KIND_LABEL: Record<string, string> = Object.fromEntries(ALERT_CATEGORIES.map((c) => [c.id, c.label]));

/** A pin: red while urgent, amber while active, grey once over. Built from DOM nodes, never HTML strings. */
function pinElement(post: Post): HTMLElement {
  const status = alertStatus(post);
  const el = document.createElement("button");
  el.type = "button";
  el.className = "flex size-8 items-center justify-center rounded-full border-2 border-white text-[11px] font-bold text-white shadow-md";
  el.style.background = status === "urgent" ? "#dc2626" : status === "active" ? "#d97706" : "#6b7280";
  el.textContent = (KIND_LABEL[post.meta.alertCategory ?? "other"] ?? "Alert").slice(0, 1);
  el.setAttribute("aria-label", `${KIND_LABEL[post.meta.alertCategory ?? "other"] ?? "Alert"} alert${post.location?.label ? ` at ${post.location.label}` : ""}`);
  return el;
}

function popupContent(post: Post): HTMLElement {
  const box = document.createElement("div");
  box.className = "max-w-56 space-y-1 text-sm";
  const head = document.createElement("p");
  head.className = "font-bold";
  head.textContent = `${KIND_LABEL[post.meta.alertCategory ?? "other"] ?? "Alert"}${post.location?.label ? ` · ${post.location.label}` : ""}`;
  const text = document.createElement("p");
  text.className = "line-clamp-3 text-muted-foreground";
  text.textContent = post.message;
  const link = document.createElement("a");
  link.href = ROUTES.post(post._id);
  link.className = "font-semibold text-primary";
  link.textContent = "Open alert";
  box.append(head, text, link);
  return box;
}

/**
 * Neighbourhood map for the Alerts page (Nextdoor's map-first alerts): the
 * boundary, its centre, and a pin for each alert that said where (contract §1
 * `location`). Click a pin for the alert.
 */
export default function AlertsMap({ lat, lng, radiusMeters, alerts = [] }: AlertsMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);

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
    mapRef.current = map;

    return () => {
      mapRef.current = null;
      map.remove();
    };
  }, [lat, lng, radiusMeters]);

  // Pins follow the list (a filter, a new alert) without rebuilding the map.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const markers = alerts
      .filter((post) => post.location)
      .map((post) =>
        new Marker({ element: pinElement(post) })
          .setLngLat([post.location!.lng, post.location!.lat])
          .setPopup(new Popup({ offset: 18, closeButton: false }).setDOMContent(popupContent(post)))
          .addTo(map),
      );
    return () => markers.forEach((m) => m.remove());
  }, [alerts, lat, lng, radiusMeters]);

  return <div ref={containerRef} className="size-full" role="img" aria-label="Map of your neighbourhood" />;
}
