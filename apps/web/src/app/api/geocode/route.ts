import { NextRequest, NextResponse } from "next/server";
import { guardLookup } from "@/lib/auth/lookup-guard";
import { geocodingProvider, type AddressParts } from "@/lib/geocoding";

/** Per part. The API keeps the whole address to 200 characters. */
const PART_MAX = 100;

/**
 * Signed-in visitors only (onboarding): each call can cost several requests of the geocoder's quota.
 * `?street&area&city`, all required: without the area, a street is too easily matched to one of the
 * same name elsewhere. `{ lat, lng, precision }`; precision "area" means the street wasn't found there.
 */
export async function GET(request: NextRequest) {
  const refused = await guardLookup(request, "geocode");
  if (refused) return refused;

  const params = request.nextUrl.searchParams;
  const parts: AddressParts = { street: params.get("street")?.trim() ?? "", area: params.get("area")?.trim() ?? "", city: params.get("city")?.trim() ?? "" };
  if (!parts.street || !parts.area || !parts.city) {
    return NextResponse.json({ error: "Street, area and city are all needed" }, { status: 400 });
  }
  if (Object.values(parts).some((p) => p.length > PART_MAX)) {
    return NextResponse.json({ error: "Address is too long" }, { status: 400 });
  }

  try {
    const result = await geocodingProvider.geocode(parts);
    if (!result) {
      return NextResponse.json({ error: "Address not found" }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof DOMException && err.name === "TimeoutError") {
      return NextResponse.json({ error: "Address lookup timed out" }, { status: 504 });
    }
    console.error("Geocoding request failed:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
