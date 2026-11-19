import { NextRequest, NextResponse } from "next/server";
import { guardLookup } from "@/lib/auth/lookup-guard";
import { geocodingProvider } from "@/lib/geocoding";

const NAME_MAX = 100;

/**
 * Signed-in visitors only, like the other lookup routes (each call spends the geocoder's quota):
 * admins find a new city on the map when creating its first Hood. `?q=Abuja` → `{ lat, lng }`.
 */
export async function GET(request: NextRequest) {
  const refused = await guardLookup(request, "geocode");
  if (refused) return refused;

  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2)
    return NextResponse.json(
      { error: "Enter a place to look for" },
      { status: 400 },
    );
  if (q.length > NAME_MAX)
    return NextResponse.json(
      { error: "Place name is too long" },
      { status: 400 },
    );

  try {
    const point = await geocodingProvider.locatePlace(q);
    if (!point)
      return NextResponse.json({ error: "Place not found" }, { status: 404 });
    return NextResponse.json(point);
  } catch (err) {
    if (err instanceof DOMException && err.name === "TimeoutError") {
      return NextResponse.json(
        { error: "Place lookup timed out" },
        { status: 504 },
      );
    }
    console.error("Place lookup failed:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
