import { assetLinks } from "@/lib/app-links";

/** Android App Links verification (lib/app-links.ts). Empty until ANDROID_SHA256_CERT_FINGERPRINTS is set. */
export function GET() {
  return Response.json(assetLinks(), { headers: { "Cache-Control": "public, max-age=3600" } });
}
