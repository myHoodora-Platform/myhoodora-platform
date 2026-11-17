/**
 * Proving to Android and iOS that the myHoodora app may open myhoodora.com links (plan WP-H): the files
 * served at /.well-known/. The app side is apps/mobile/app.config.ts (intentFilters, associatedDomains).
 */
export const ANDROID_PACKAGE = "com.myhoodora.app";
export const IOS_BUNDLE_ID = "com.myhoodora.app";
/** Public: it's in every signed iOS build (apps/mobile/eas.json). Override with APPLE_TEAM_ID. */
const DEFAULT_APPLE_TEAM_ID = "P8TFVK9UYF";

/** The pages the app opens: the same list as the app's APP_LINK_PATHS. */
export const APP_LINK_PATHS = ["/p/", "/i/", "/for-sale/", "/g/", "/profile/"] as const;

/**
 * The Play App Signing key's SHA-256 (Play Console → Test and release → App integrity → App signing), plus
 * the upload key's if internal builds should verify too. Comma-separated in ANDROID_SHA256_CERT_FINGERPRINTS.
 */
export function androidFingerprints(env: string | undefined = process.env.ANDROID_SHA256_CERT_FINGERPRINTS): string[] {
  return (env ?? "")
    .split(",")
    .map((f) => f.trim().toUpperCase())
    .filter((f) => /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(f));
}

export function assetLinks(fingerprints = androidFingerprints()) {
  if (!fingerprints.length) return [];
  return [{ relation: ["delegate_permission/common.handle_all_urls"], target: { namespace: "android_app", package_name: ANDROID_PACKAGE, sha256_cert_fingerprints: fingerprints } }];
}

export function appleAppSiteAssociation(teamId: string = process.env.APPLE_TEAM_ID?.trim() || DEFAULT_APPLE_TEAM_ID) {
  const appID = `${teamId}.${IOS_BUNDLE_ID}`;
  return {
    applinks: {
      apps: [],
      details: [
        // iOS 13+ first, then the older form.
        { appIDs: [appID], components: APP_LINK_PATHS.map((p) => ({ "/": `${p}*` })) },
        { appID, paths: APP_LINK_PATHS.map((p) => `${p}*`) },
      ],
    },
  };
}
