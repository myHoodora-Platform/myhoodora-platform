import { Agent } from "node:https";
import { Socket } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { deleteApp, initializeApp, type App } from "firebase-admin/app";
import { VerifierUnavailableError, isKeyFetchFailure, verifyIdToken, verifySessionCookie } from "./session-cookie";

// The real Admin SDK, not a stub: this is what pins isKeyFetchFailure's message match to the
// installed firebase-admin. session-cookie.ts reuses an app with this name if one exists, so the
// one made here (same SDK, but every connection fails) is the one it verifies with.
const PROJECT = "demo-outage-test";
const part = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");

/** Shaped like a real token for PROJECT, so the SDK gets as far as the signature check, which needs Google's keys. */
function tokenFrom(issuer: string, claims: Record<string, unknown> = {}): string {
  const now = Math.floor(Date.now() / 1000);
  const payload = { iss: `${issuer}/${PROJECT}`, aud: PROJECT, sub: "ada", iat: now - 60, exp: now + 3600, auth_time: now - 60, ...claims };
  return [part({ alg: "RS256", kid: "some-key", typ: "JWT" }), part(payload), "c2lnbmF0dXJl"].join(".");
}
const idToken = (claims?: Record<string, unknown>) => tokenFrom("https://securetoken.google.com", claims);
const sessionCookie = (claims?: Record<string, unknown>) => tokenFrom("https://session.firebase.google.com", claims);

/** Every connection the SDK opens fails at once, as on a server that can't reach Google. No real network is used. */
class UnreachableAgent extends Agent {
  createConnection(): Socket {
    const socket = new Socket();
    process.nextTick(() => socket.destroy(Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" })));
    return socket;
  }
}

describe("the session verifier when Google's signing keys can't be fetched", () => {
  let app: App;
  beforeAll(() => {
    app = initializeApp({ projectId: PROJECT, httpAgent: new UnreachableAgent() }, "session-verifier");
  });
  afterAll(() => deleteApp(app));

  it("says it couldn't check (throws), instead of calling a good token invalid (null)", async () => {
    await expect(verifyIdToken(idToken())).rejects.toBeInstanceOf(VerifierUnavailableError);
    await expect(verifySessionCookie(sessionCookie())).rejects.toBeInstanceOf(VerifierUnavailableError);
  });

  it("still says invalid (null) for what is wrong in itself: no keys are needed to know that", async () => {
    expect(await verifyIdToken("garbage")).toBeNull();
    expect(await verifyIdToken(idToken({ aud: "someone-elses-project" }))).toBeNull();
    // One kind is never accepted as the other.
    expect(await verifyIdToken(sessionCookie())).toBeNull();
    expect(await verifySessionCookie(idToken())).toBeNull();
    expect(await verifySessionCookie(undefined)).toBeNull();
    expect(await verifySessionCookie("")).toBeNull();
  });
});

describe("isKeyFetchFailure", () => {
  it("recognises both ways the Admin SDK reports unfetchable keys", () => {
    expect(isKeyFetchFailure({ code: "auth/argument-error", message: "Error while making request: connect ETIMEDOUT. Error code: ETIMEDOUT" })).toBe(true);
    expect(isKeyFetchFailure({ code: "auth/argument-error", message: "Error fetching public keys for Google certs: server_error (backend unavailable)" })).toBe(true);
  });

  it("is false for every way a token itself can be bad, and for anything that isn't an SDK error", () => {
    const bad = [
      { code: "auth/id-token-expired", message: "Firebase ID token has expired." },
      { code: "auth/session-cookie-expired", message: "Firebase session cookie has expired." },
      { code: "auth/argument-error", message: "Firebase ID token has invalid signature." },
      { code: "auth/argument-error", message: 'Firebase ID token has "kid" claim which does not correspond to a known public key.' },
      { code: "app/network-error", message: "Error while making request: read ECONNRESET. Error code: ECONNRESET" },
      new Error("Error while making request"),
      null,
      undefined,
      "Error while making request",
    ];
    for (const err of bad) expect(isKeyFetchFailure(err)).toBe(false);
  });
});
