import { existsSync } from "node:fs";
import type { ConfigContext, ExpoConfig } from "expo/config";

/**
 * App identity and native configuration. Values that differ per environment come from EAS
 * (eas.json `env`) or a local .env.local, never from this file. See docs/mobile/README.md.
 */
/** The EAS project, owned by the myhoodora-mvp organisation (set by `eas init`). */
const EAS_PROJECT_ID = "f817f499-081f-4a30-9f95-d90bbd66b819";

const BRAND_TEAL = "#147C73";
/** The web's light canvas (packages/design-tokens: light.background). */
const LIGHT_BG = "#FFFFFF";
/** The web's dark canvas (packages/design-tokens: dark.background). */
const DARK_BG = "#0F1514";

/**
 * Google sign-in on iOS needs the iOS OAuth client's reversed ID as a URL scheme, fixed at build time.
 * Without EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID the plugin is left out and the button says it isn't set up.
 */
const googleIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim();
const googleSignInPlugin: [string, { iosUrlScheme: string }][] = googleIosClientId
  ? [["@react-native-google-signin/google-signin", { iosUrlScheme: `com.googleusercontent.apps.${googleIosClientId.replace(/\.apps\.googleusercontent\.com$/, "")}` }]]
  : [];

/**
 * Firebase's native config files (Android: FCM for push; iOS: Google sign-in). Never committed
 * (.gitignore). EAS builds get them from the file variables GOOGLE_SERVICES_JSON and
 * GOOGLE_SERVICE_INFO_PLIST; locally they sit next to this file. Missing: left out, and the build
 * still works, without Android push.
 */
function nativeFirebaseFile(envVar: string, localPath: string): string | undefined {
  const fromEnv = process.env[envVar]?.trim();
  if (fromEnv) return fromEnv;
  return existsSync(localPath) ? localPath : undefined;
}
const androidGoogleServices = nativeFirebaseFile("GOOGLE_SERVICES_JSON", "./google-services.json");
const iosGoogleServices = nativeFirebaseFile("GOOGLE_SERVICE_INFO_PLIST", "./GoogleService-Info.plist");

/**
 * Crash reporting: links Sentry's native SDKs and uploads source maps and debug symbols from EAS
 * builds, so stack traces are readable. Org and project are build variables (SENTRY_ORG,
 * SENTRY_PROJECT); the auth token is the EAS secret SENTRY_AUTH_TOKEN, never written here.
 * Local builds skip the upload (package.json sets SENTRY_DISABLE_AUTO_UPLOAD).
 */
const sentryPlugin: [string, Record<string, string>] = [
  "@sentry/react-native/expo",
  {
    url: process.env.SENTRY_URL?.trim() || "https://sentry.io/",
    ...(process.env.SENTRY_ORG?.trim() && { organization: process.env.SENTRY_ORG.trim() }),
    ...(process.env.SENTRY_PROJECT?.trim() && { project: process.env.SENTRY_PROJECT.trim() }),
  },
];

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "myHoodora",
  slug: "myhoodora",
  scheme: "myhoodora",
  version: "1.0.0",
  orientation: "portrait",
  // No web build: the web app is apps/web.
  platforms: ["ios", "android"],
  icon: "./assets/images/icon.png",
  userInterfaceStyle: "automatic",
  // The company's Expo organisation: its unique name, not the display name (docs/mobile/architecture-decisions.md, ADR-011).
  owner: "myhoodora-mvp",
  ios: {
    bundleIdentifier: "com.myhoodora.app",
    ...(iosGoogleServices && { googleServicesFile: iosGoogleServices }),
    supportsTablet: false,
    infoPlist: {
      NSLocationWhenInUseUsageDescription: "myHoodora uses your location once, to find the neighbourhood you live in.",
      // Only standard HTTPS encryption, so App Store Connect asks no export-compliance questions.
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: "com.myhoodora.app",
    ...(androidGoogleServices && { googleServicesFile: androidGoogleServices }),
    adaptiveIcon: {
      backgroundColor: LIGHT_BG,
      foregroundImage: "./assets/images/android-icon-foreground.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    // Approximate is enough to find a Hood and is what most people are comfortable granting.
    permissions: ["ACCESS_COARSE_LOCATION", "ACCESS_FINE_LOCATION"],
    predictiveBackGestureEnabled: false,
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    // The mascot lockup (the web's sign-in art) on the app's canvas, following the phone's light or dark
    // setting. The art is a sticker with a white edge, so its teal lettering still reads on the dark canvas.
    [
      "expo-splash-screen",
      { backgroundColor: LIGHT_BG, image: "./assets/images/splash-icon.png", imageWidth: 220, dark: { backgroundColor: DARK_BG, image: "./assets/images/splash-icon.png" } },
    ],
    ["expo-notifications", { color: BRAND_TEAL }],
    ["expo-location", { locationWhenInUsePermission: "myHoodora uses your location once, to find the neighbourhood you live in." }],
    "expo-font",
    // Photos for posts and listings, chosen by the person. No video or microphone yet.
    [
      "expo-image-picker",
      {
        photosPermission: "myHoodora opens your photos when you choose some to add to a post or a listing.",
        cameraPermission: "myHoodora uses the camera when you take a photo for a post or a listing.",
        microphonePermission: false,
      },
    ],
    // Video ads in the feed play muted in place: no background audio, no picture-in-picture.
    ["expo-video", { supportsBackgroundPlayback: false, supportsPictureInPicture: false }],
    // The Alerts map: MapLibre with OpenFreeMap tiles, as on the web. No API key.
    "@maplibre/maplibre-react-native",
    ...googleSignInPlugin,
    sentryPlugin,
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    router: {},
    eas: { projectId: EAS_PROJECT_ID },
  },
  runtimeVersion: { policy: "appVersion" },
});
