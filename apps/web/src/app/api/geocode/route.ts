import { NextRequest, NextResponse } from "next/server";
import { guardLookup } from "@/lib/auth/lookup-guard";
import { geocodingProvider } from "@/lib/geocoding";

/** Signed-in visitors only (onboarding): each call can cost several requests of the geocoder's quota. */
export async function GET(request: NextRequest) {
  const refused = await guardLookup(request, "geocode");
  if (refused) return refused;

  const address = request.nextUrl.searchParams.get("address")?.trim();
  if (!address) {
    return NextResponse.json({ error: "Missing address" }, { status: 400 });
  }
  // The API accepts addresses up to 200 characters; nothing longer is a real one.
  if (address.length > 200) {
    return NextResponse.json({ error: "Address is too long" }, { status: 400 });
  }

  try {
    const result = await geocodingProvider.geocode(address);
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
