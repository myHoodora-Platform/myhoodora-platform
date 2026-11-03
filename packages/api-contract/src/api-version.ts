/**
 * The API version these clients are built for (docs/api-versioning.md). The environment gives the
 * API's base ("https://…/api", as it always has); requests go to "<base>/v1/…". Moving a client to
 * v2 is a change here, shipped with the code that reads v2's shapes.
 */
export const API_VERSION = "v1";

/** "https://api.example.com/api" → "https://api.example.com/api/v1" (unchanged if a version is already there). */
export function versionedApiUrl(base: string): string {
  const trimmed = base.replace(/\/+$/, "");
  return /\/v\d+$/.test(trimmed) ? trimmed : `${trimmed}/${API_VERSION}`;
}
