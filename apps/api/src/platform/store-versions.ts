import { importPKCS8, SignJWT } from "jose";
import { APP_VERSION_PATTERN, compareVersions, type AppPlatform } from "./platform-settings.schema";

/** What one store says is live. `problem` set: the check couldn't run or failed (version stays unknown). */
export interface StoreCheck {
  version: string | null;
  url: string | null;
  problem: string | null;
}

/** Port: where the live store version comes from. One adapter per store, swappable in tests. */
export interface StoreVersionSource {
  readonly platform: AppPlatform;
  check(): Promise<StoreCheck>;
}

const TIMEOUT_MS = 15_000;

/** The App Store, through Apple's public lookup (no key). Lags a few hours behind a release. */
export class AppleStoreLookup implements StoreVersionSource {
  readonly platform = "ios" as const;
  constructor(
    private readonly bundleId: string,
    private readonly country: string,
  ) {}

  async check(): Promise<StoreCheck> {
    const url = `https://itunes.apple.com/lookup?bundleId=${encodeURIComponent(this.bundleId)}&country=${encodeURIComponent(this.country)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) return { version: null, url: null, problem: `Apple's lookup answered ${res.status}` };
    const body = (await res.json()) as { results?: { version?: string; trackViewUrl?: string }[] };
    const app = body.results?.[0];
    if (!app) return { version: null, url: null, problem: null }; // not on the App Store yet: not a problem
    const version = app.version && APP_VERSION_PATTERN.test(app.version) ? app.version : null;
    const page = app.trackViewUrl?.startsWith("https://") ? app.trackViewUrl.replace(/\?.*$/, "") : null;
    return { version, url: page, problem: version ? null : `Apple lists version "${app.version ?? ""}"` };
  }
}

interface ServiceAccount {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

/** Raw JSON or base64 of it (env values can't always hold newlines). Null when unset or unreadable. */
export function parseServiceAccount(raw: string | undefined): ServiceAccount | null {
  const text = raw?.trim();
  if (!text) return null;
  for (const candidate of [text, Buffer.from(text, "base64").toString("utf8")]) {
    try {
      const v = JSON.parse(candidate) as Partial<ServiceAccount>;
      if (typeof v.client_email === "string" && typeof v.private_key === "string") return { client_email: v.client_email, private_key: v.private_key, token_uri: v.token_uri };
    } catch {
      // try the next form
    }
  }
  return null;
}

/** The version in a Play release name ("3 (1.0.1)" or "1.0.1"). */
export function versionFromReleaseName(name: string | undefined): string | null {
  const m = name?.match(/(\d{1,4}\.\d{1,4}\.\d{1,4})/);
  return m ? m[1]! : null;
}

/**
 * Google Play, through the Play Developer API with a service account invited to the app in Play Console
 * (View app information is enough). Only a fully rolled-out production release counts: during a staged
 * rollout most people can't get it yet.
 */
export class GooglePlayLookup implements StoreVersionSource {
  readonly platform = "android" as const;
  constructor(
    private readonly packageName: string,
    private readonly account: ServiceAccount | null,
  ) {}

  private get page() {
    return `https://play.google.com/store/apps/details?id=${this.packageName}`;
  }

  async check(): Promise<StoreCheck> {
    if (!this.account) return { version: null, url: null, problem: "Not set up: GOOGLE_PLAY_SERVICE_ACCOUNT_JSON isn't set on the API" };
    const token = await this.accessToken(this.account);
    const api = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${this.packageName}/edits`;
    const auth = { Authorization: `Bearer ${token}` };
    const edit = await fetch(api, { method: "POST", headers: auth, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!edit.ok) return { version: null, url: this.page, problem: `Play answered ${edit.status} (is the service account invited to the app?)` };
    const { id } = (await edit.json()) as { id: string };
    try {
      const res = await fetch(`${api}/${id}/tracks/production`, { headers: auth, signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!res.ok) return { version: null, url: this.page, problem: `Play answered ${res.status} for the production track` };
      const track = (await res.json()) as { releases?: { name?: string; status?: string }[] };
      const live = (track.releases ?? []).filter((r) => r.status === "completed");
      if (live.length === 0) return { version: null, url: this.page, problem: null };
      const versions = live.map((r) => versionFromReleaseName(r.name)).filter((v): v is string => v !== null);
      if (versions.length === 0) return { version: null, url: this.page, problem: `The live release's name ("${live[0]!.name ?? ""}") has no version like 1.0.1` };
      return { version: versions.sort((a, b) => compareVersions(b, a))[0]!, url: this.page, problem: null };
    } finally {
      // Read-only: the edit is thrown away, never committed.
      await fetch(`${api}/${id}`, { method: "DELETE", headers: auth, signal: AbortSignal.timeout(TIMEOUT_MS) }).catch(() => undefined);
    }
  }

  private async accessToken(account: ServiceAccount): Promise<string> {
    const tokenUri = account.token_uri ?? "https://oauth2.googleapis.com/token";
    const key = await importPKCS8(account.private_key, "RS256");
    const assertion = await new SignJWT({ scope: "https://www.googleapis.com/auth/androidpublisher" })
      .setProtectedHeader({ alg: "RS256", typ: "JWT" })
      .setIssuer(account.client_email)
      .setAudience(tokenUri)
      .setIssuedAt()
      .setExpirationTime("10m")
      .sign(key);
    const res = await fetch(tokenUri, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`Google sign-in for the Play API failed (${res.status})`);
    return ((await res.json()) as { access_token: string }).access_token;
  }
}
