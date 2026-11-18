import { appleAppSiteAssociation } from "@/lib/app-links";

/** iOS Universal Links (lib/app-links.ts). JSON, no extension, never redirected. */
export function GET() {
  return Response.json(appleAppSiteAssociation(), { headers: { "Cache-Control": "public, max-age=3600" } });
}
