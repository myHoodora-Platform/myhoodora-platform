import { z } from "zod";

/**
 * Typed, validated configuration. Every value is EXPO_PUBLIC_*, so it is compiled into the app and
 * readable by anyone with the app: public identifiers and URLs only, never a secret.
 *
 * Expo inlines `process.env.EXPO_PUBLIC_X` only when written out in full, so each is listed here.
 */
const schema = z.object({
  appEnv: z.enum(["development", "preview", "production"]),
  /** The API, including /api. */
  apiUrl: z.string().url().transform((u) => u.replace(/\/$/, "")),
  /** The web app's origin: its address lookups and its public pages (Terms, Privacy). */
  webUrl: z.string().url().transform((u) => u.replace(/\/$/, "")),
  /** Google sign-in: optional, the button explains when it isn't set up. Public OAuth client IDs. */
  google: z.object({ webClientId: z.string().optional(), iosClientId: z.string().optional() }),
  /** Crash reporting (Sentry). Its DSN is a public key by design. Unset: reporting is off. */
  sentryDsn: z.string().url().optional(),
  firebase: z.object({
    apiKey: z.string().min(1),
    authDomain: z.string().min(1),
    projectId: z.string().min(1),
    appId: z.string().min(1),
  }),
});

export type AppConfig = z.infer<typeof schema>;

export type ConfigResult = { ok: true; config: AppConfig } | { ok: false; problems: string[] };

export function parseConfig(raw: Record<string, string | undefined>): ConfigResult {
  const result = schema.safeParse({
    appEnv: raw.EXPO_PUBLIC_APP_ENV ?? "development",
    apiUrl: raw.EXPO_PUBLIC_API_URL,
    webUrl: raw.EXPO_PUBLIC_WEB_URL,
    google: { webClientId: raw.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || undefined, iosClientId: raw.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || undefined },
    sentryDsn: raw.EXPO_PUBLIC_SENTRY_DSN || undefined,
    firebase: {
      apiKey: raw.EXPO_PUBLIC_FIREBASE_API_KEY,
      authDomain: raw.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: raw.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
      appId: raw.EXPO_PUBLIC_FIREBASE_APP_ID,
    },
  });
  if (result.success) return { ok: true, config: result.data };
  return { ok: false, problems: result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) };
}

export const configResult = parseConfig({
  EXPO_PUBLIC_APP_ENV: process.env.EXPO_PUBLIC_APP_ENV,
  EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
  EXPO_PUBLIC_WEB_URL: process.env.EXPO_PUBLIC_WEB_URL,
  EXPO_PUBLIC_FIREBASE_API_KEY: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  EXPO_PUBLIC_FIREBASE_PROJECT_ID: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  EXPO_PUBLIC_FIREBASE_APP_ID: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  EXPO_PUBLIC_SENTRY_DSN: process.env.EXPO_PUBLIC_SENTRY_DSN,
});

/** The validated config. Only read after the root layout has checked `configResult.ok`. */
export function config(): AppConfig {
  if (!configResult.ok) throw new Error(`App configuration is invalid: ${configResult.problems.join("; ")}`);
  return configResult.config;
}
