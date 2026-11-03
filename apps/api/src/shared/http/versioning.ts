import { applyDecorators, Header, VERSION_NEUTRAL, VersioningType, type INestApplication } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";

/**
 * API versions (docs/api-versioning.md). Every route answers at /api/v1/…, and the unversioned
 * /api/… stays an alias for v1, so app builds already installed and existing environment settings
 * keep working. A breaking change is a new handler marked @Version("2") beside the v1 one, never an
 * edit to v1; v1 then carries @DeprecatedRoute until it's switched off.
 */
export const API_VERSION = "1";
export const SUPPORTED_API_VERSIONS = [API_VERSION] as const;

/** Before the global prefix is used: the test app and main.ts both call this. */
export function applyApiVersioning(app: INestApplication): void {
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: [VERSION_NEUTRAL, API_VERSION] });
  // Which version answered, so a client (or a bug report) can tell.
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader("API-Version", /^\/api\/v(\d+)\//.exec(req.path)?.[1] ?? API_VERSION);
    next();
  });
}

/**
 * On a route that has a replacement: says so on every response (RFC 9745 `Deprecation`, RFC 8594
 * `Sunset`, and a `Link` to the successor), so clients and their logs see it long before it goes.
 * `sunset`: the day it stops working, "YYYY-MM-DD".
 */
export function DeprecatedRoute({ since, sunset, successor }: { since: string; sunset: string; successor?: string }) {
  const httpDate = (day: string) => new Date(`${day}T00:00:00Z`).toUTCString();
  return applyDecorators(
    Header("Deprecation", `@${Math.floor(new Date(`${since}T00:00:00Z`).getTime() / 1000)}`),
    Header("Sunset", httpDate(sunset)),
    ...(successor ? [Header("Link", `<${successor}>; rel="successor-version"`)] : []),
  );
}
