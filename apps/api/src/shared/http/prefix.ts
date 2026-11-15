import { RequestMethod, type INestApplication } from "@nestjs/common";

/**
 * Everything is under /api, except the OpenID discovery document and signing keys, which clients look
 * for at the issuer's root (docs/integrations/myhoodora-ai.md §2). main.ts and the test app both call this.
 */
export function applyGlobalPrefix(app: INestApplication): void {
  app.setGlobalPrefix("api", {
    exclude: [
      { path: ".well-known/openid-configuration", method: RequestMethod.GET },
      { path: ".well-known/jwks.json", method: RequestMethod.GET },
    ],
  });
}
