import { NextRequest, NextResponse } from "next/server";
import { guardLookup } from "@/lib/auth/lookup-guard";
import { geocodingProvider } from "@/lib/geocoding";

/** A missing parameter must not read as 0: Number(null) is 0, which is a real latitude. */
function coordinate(value: string | null, limit: number): number {
  const n = value === null || value.trim() === "" ? NaN : Number(value);
  return Number.isFinite(n) && Math.abs(n) <= limit ? n : NaN;
}

/** Signed-in visitors only (onboarding): it spends the geocoder's quota. */
export async function GET(request: NextRequest) {
  const refused = await guardLookup(request, "reverse-geocode");
  if (refused) return refused;

  const lat = coordinate(request.nextUrl.searchParams.get("lat"), 90);
  const lng = coordinate(request.nextUrl.searchParams.get("lng"), 180);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json(
      { error: "Missing or invalid lat/lng" },
      { status: 400 },
    );
  }

  try {
    const address = await geocodingProvider.reverseGeocode(lat, lng);
    if (!address) {
      return NextResponse.json({ error: "Address not found" }, { status: 404 });
    }
    return NextResponse.json({ address });
  } catch (err) {
    if (err instanceof DOMException && err.name === "TimeoutError") {
      return NextResponse.json({ error: "Address lookup timed out" }, { status: 504 });
    }
    console.error("Reverse geocoding request failed:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
