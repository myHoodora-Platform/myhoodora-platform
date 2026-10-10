import { isIP } from "node:net";
import { NextRequest, NextResponse } from "next/server";
import { guardLookup } from "@/lib/auth/lookup-guard";

/** The lookup is a convenience: if it is slow, onboarding falls back to typing an address. */
const LOOKUP_TIMEOUT_MS = 4_000;

interface IpLocationResult {
  lat: number;
  lng: number;
  city?: string;
  region?: string;
  country?: string;
  source: "vercel" | "cloudflare" | "ip-api";
}

// Platform-injected geo headers cost nothing (no extra network hop) but only
// exist when deployed behind that specific platform's edge network — empty
// on localhost or generic Node hosting.
function fromPlatformHeaders(request: NextRequest): IpLocationResult | null {
  const vercelLat = request.headers.get("x-vercel-ip-latitude");
  const vercelLng = request.headers.get("x-vercel-ip-longitude");
  if (vercelLat && vercelLng) {
    return {
      lat: parseFloat(vercelLat),
      lng: parseFloat(vercelLng),
      city: request.headers.get("x-vercel-ip-city") || undefined,
      region: request.headers.get("x-vercel-ip-country-region") || undefined,
      country: request.headers.get("x-vercel-ip-country") || undefined,
      source: "vercel",
    };
  }

  const cfLat = request.headers.get("cf-iplatitude");
  const cfLng = request.headers.get("cf-iplongitude");
  if (cfLat && cfLng) {
    return {
      lat: parseFloat(cfLat),
      lng: parseFloat(cfLng),
      city: request.headers.get("cf-ipcity") || undefined,
      country: request.headers.get("cf-ipcountry") || undefined,
      source: "cloudflare",
    };
  }

  return null;
}

function getClientIp(request: NextRequest): string | null {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const ip = forwardedFor?.split(",")[0]?.trim() || request.headers.get("x-real-ip");
  // The header is whatever the client (or a proxy) sent. Only a real address goes into the lookup URL.
  if (!ip || !isIP(ip) || ip === "::1" || ip === "127.0.0.1") return null;
  return ip;
}

// ip-api.com's free tier is HTTP-only (HTTPS needs a paid plan) — fine here
// since this call happens server-side, never from the browser.
async function fromIpLookup(ip: string): Promise<IpLocationResult | null> {
  const url = `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,lat,lon,city,region,country`;
  const response = await fetch(url, { signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS) });
  if (!response.ok) return null;

  const data = await response.json();
  if (data.status !== "success") return null;

  return {
    lat: data.lat,
    lng: data.lon,
    city: data.city,
    region: data.region,
    country: data.country,
    source: "ip-api",
  };
}

/** Signed-in visitors only (onboarding's fallback when GPS fails): it spends a third-party lookup quota. */
export async function GET(request: NextRequest) {
  const refused = await guardLookup(request, "ip-location");
  if (refused) return refused;

  try {
    const fromHeaders = fromPlatformHeaders(request);
    if (fromHeaders) {
      return NextResponse.json(fromHeaders);
    }

    const ip = getClientIp(request);
    if (!ip) {
      return NextResponse.json(
        { error: "No public client IP available (running on localhost)" },
        { status: 404 },
      );
    }

    const fromIp = await fromIpLookup(ip);
    if (!fromIp) {
      return NextResponse.json({ error: "IP location not found" }, { status: 404 });
    }

    return NextResponse.json(fromIp);
  } catch (err) {
    if (err instanceof DOMException && err.name === "TimeoutError") {
      return NextResponse.json({ error: "IP location lookup timed out" }, { status: 504 });
    }
    console.error("IP location lookup failed:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
