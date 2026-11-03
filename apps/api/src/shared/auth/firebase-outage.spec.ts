import { Agent } from "node:https";
import { Socket } from "node:net";
import { deleteApp, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { isKeyFetchFailure } from "./firebase-outage";

const PROJECT = "demo-outage-test";
const part = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");

/** Shaped like a real token for PROJECT, so the SDK gets as far as the signature check, which needs Google's keys. */
function tokenFrom(issuer: string, claims: Record<string, unknown> = {}): string {
  const now = Math.floor(Date.now() / 1000);
  const payload = { iss: `${issuer}/${PROJECT}`, aud: PROJECT, sub: "ada", iat: now - 60, exp: now + 3600, auth_time: now - 60, ...claims };
  return [part({ alg: "RS256", kid: "some-key", typ: "JWT" }), part(payload), "c2lnbmF0dXJl"].join(".");
}
const idToken = (claims?: Record<string, unknown>) => tokenFrom("https://securetoken.google.com", claims);
const sessionCookie = () => tokenFrom("https://session.firebase.google.com");

/** Every connection the SDK opens fails at once, as on a host that can't reach Google. No real network is used. */
class UnreachableAgent extends Agent {
  createConnection(): Socket {
    const socket = new Socket();
    process.nextTick(() => socket.destroy(Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" })));
    return socket;
  }
}

describe("isKeyFetchFailure", () => {
  // The real Admin SDK, not a stub: this is what pins the message match to the installed version.
  describe("against the real Admin SDK with Google unreachable", () => {
    let app: App;
    beforeAll(() => {
      app = initializeApp({ projectId: PROJECT, httpAgent: new UnreachableAgent() }, "outage-contract");
    });
    afterAll(() => deleteApp(app));

    it("recognises an ID token that couldn't be checked because the signing keys couldn't be fetched", async () => {
      const err = await getAuth(app).verifyIdToken(idToken()).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(Error);
      expect(isKeyFetchFailure(err)).toBe(true);
    });

    it("…and a session cookie (its keys come from a different URL)", async () => {
      const err = await getAuth(app).verifySessionCookie(sessionCookie()).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(Error);
      expect(isKeyFetchFailure(err)).toBe(true);
    });

    it("a token that is wrong in itself is not an outage, even while Google is unreachable", async () => {
      const auth = getAuth(app);
      const wrongProject = await auth.verifyIdToken(idToken({ aud: "someone-elses-project" })).catch((e: unknown) => e);
      const garbage = await auth.verifyIdToken("nonsense").catch((e: unknown) => e);
      const cookieAsToken = await auth.verifyIdToken(sessionCookie()).catch((e: unknown) => e);
      for (const err of [wrongProject, garbage, cookieAsToken]) {
        expect(err).toBeInstanceOf(Error);
        expect(isKeyFetchFailure(err)).toBe(false);
      }
    });
  });

  it("recognises Google answering the key request with an HTTP error", () => {
    expect(isKeyFetchFailure({ code: "auth/argument-error", message: "Error fetching public keys for Google certs: server_error (backend unavailable)" })).toBe(true);
  });

  it("is false for every way a token itself can be bad, and for anything that isn't an SDK error", () => {
    const bad = [
      { code: "auth/id-token-expired", message: "Firebase ID token has expired. Get a fresh ID token from your client app and try again." },
      { code: "auth/argument-error", message: "Firebase ID token has invalid signature. See https://firebase.google.com/docs/auth/admin/verify-id-tokens for details." },
      { code: "auth/argument-error", message: 'Firebase ID token has "kid" claim which does not correspond to a known public key.' },
      { code: "auth/argument-error", message: "Decoding Firebase ID token failed." },
      // The right words under another code are something else (e.g. a failed user lookup), not key fetching.
      { code: "app/network-error", message: "Error while making request: read ECONNRESET. Error code: ECONNRESET" },
      new Error("Error while making request"),
      null,
      undefined,
      "Error while making request",
    ];
    for (const err of bad) expect(isKeyFetchFailure(err)).toBe(false);
  });
});
