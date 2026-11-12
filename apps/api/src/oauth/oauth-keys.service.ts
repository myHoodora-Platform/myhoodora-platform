import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { importJWK, SignJWT, type JWK, type KeyLike } from "jose";
import { OAUTH_CONFIG } from "./oauth.tokens";
import type { OAuthConfig } from "./oauth.config";

/** The parts of a private JWK that may be published. Everything else (above all `d`) stays here. */
const PUBLIC_MEMBERS = ["kty", "crv", "x", "y", "kid"] as const;

/** myHoodora's signing keys (contract §5.1): ES256 only. The first configured key signs; all are published. */
@Injectable()
export class OAuthKeysService {
  private signer: Promise<{ kid: string; key: KeyLike | Uint8Array }> | null = null;

  constructor(@Inject(OAUTH_CONFIG) private readonly config: OAuthConfig) {}

  /** GET /.well-known/jwks.json: public halves only, every configured key (so a rotation never breaks verification). */
  publicJwks(): { keys: JWK[] } {
    this.ensureEnabled();
    return {
      keys: this.config.signingKeys.map((key) => {
        const pub: JWK = { kty: key.kty, use: "sig", alg: "ES256" };
        for (const member of PUBLIC_MEMBERS) if (key[member] !== undefined) pub[member] = key[member];
        return pub;
      }),
    };
  }

  /** Signs a JWT with the current key: header { alg: ES256, kid, typ: JWT }. */
  async sign(payload: Record<string, unknown>): Promise<string> {
    this.ensureEnabled();
    const { kid, key } = await this.currentSigner();
    return new SignJWT(payload).setProtectedHeader({ alg: "ES256", kid, typ: "JWT" }).sign(key);
  }

  private currentSigner() {
    this.signer ??= (async () => {
      const jwk = this.config.signingKeys[0];
      return { kid: jwk.kid, key: await importJWK(jwk, "ES256") };
    })();
    return this.signer;
  }

  private ensureEnabled(): void {
    if (!this.config.enabled) throw new NotFoundException();
  }
}
