import { NextRequest, NextResponse } from "next/server";
import { geocodingProvider } from "@/lib/geocoding";

export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get("address")?.trim();
  if (!address) {
    return NextResponse.json({ error: "Missing address" }, { status: 400 });
  }

  try {
    const result = await geocodingProvider.geocode(address);
    if (!result) {
      return NextResponse.json({ error: "Address not found" }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error("Geocoding request failed:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
