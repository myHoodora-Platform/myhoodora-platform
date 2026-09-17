import { NextRequest, NextResponse } from "next/server";
import { geocodingProvider } from "@/lib/geocoding";

export async function GET(request: NextRequest) {
  const lat = Number(request.nextUrl.searchParams.get("lat"));
  const lng = Number(request.nextUrl.searchParams.get("lng"));
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
    console.error("Reverse geocoding request failed:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
