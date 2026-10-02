/**
 * Typed configuration. Secrets live only in apps/api/.env (never in Next.js).
 * `validateEnv` fails fast in production when something essential is missing.
 */
const DAY_MS = 24 * 60 * 60_000;

/** Firebase accepts session cookies of 5 minutes to 2 weeks; anything else falls back to / is clamped into that range. */
function sessionTtlMs(days: string | undefined): number {
  const requested = Number(days) > 0 ? Number(days) * DAY_MS : 7 * DAY_MS;
  return Math.min(Math.max(requested, 5 * 60_000), 14 * DAY_MS);
}

export default () => ({
  port: parseInt(process.env.PORT ?? "3000", 10),
  nodeEnv: process.env.NODE_ENV ?? "development",

  mongodb: {
    uri: process.env.MONGODB_URI ?? "mongodb://localhost:27017/myhoodora",
  },

  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    // Replace escaped newlines that come from .env files
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  },

  /**
   * The web app's session cookie (docs/api-contract.md §24). It only gates page routing; every API call still
   * needs a Firebase ID token. 7 days keeps weekly visitors signed in at the page gate without holding the
   * maximum (14); the web renews it past half-life while the Firebase session is alive. SESSION_COOKIE_TTL_DAYS.
   */
  auth: {
    sessionTtlMs: sessionTtlMs(process.env.SESSION_COOKIE_TTL_DAYS),
  },

  cors: {
    origin: (process.env.CORS_ORIGIN ?? "http://localhost:3000").split(",").map((s) => s.trim()),
  },

  /** Public web origin used to build links in emails (e.g. /verify-email). */
  appUrl: (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, ""),

  mail: {
    /** Empty → emails are logged (masked), not sent. Server-side only. */
    resendApiKey: process.env.RESEND_API_KEY?.trim() || undefined,
    resendWebhookSecret: process.env.RESEND_WEBHOOK_SECRET?.trim() || undefined,
    from: process.env.MAIL_FROM ?? "myHoodora <hello@myhoodora.com>",
    replyTo: process.env.MAIL_REPLY_TO || undefined,
  },

  /** Address verification (docs/api-contract.md §16). */
  verification: {
    /** How far outside a Hood's edge an address can be and still be offered "ask to join". */
    nearbyBufferMeters: Number(process.env.NEARBY_BUFFER_M) || 3000,
  },

  /** Event reminders and follow-ups (docs/api-contract.md §23). On unless EVENT_REMINDERS_ENABLED=false. */
  eventReminders: {
    enabled: process.env.EVENT_REMINDERS_ENABLED !== "false",
  },

  /** Uploaded photos and videos (docs/api-contract.md §20). */
  storage: {
    /** cloudinary (default). Other providers need an adapter in src/storage/providers/. */
    provider: (process.env.STORAGE_PROVIDER?.trim() || "cloudinary").toLowerCase(),
    /** cloudinary://<api_key>:<api_secret>@<cloud_name>. Server-side only; never logged. */
    cloudinaryUrl: process.env.CLOUDINARY_URL?.trim() || undefined,
    /** Folder root per environment, so local test uploads never mix with production. */
    folder: `myhoodora/${process.env.NODE_ENV || "development"}`,
    /**
     * Browser → provider uploads (POST /media/direct). Off by default: each one costs a Cloudinary Admin API
     * call, which the free plan rate-limits hourly. Turn on with a paid plan: STORAGE_DIRECT_UPLOADS=true.
     */
    directUploads: process.env.STORAGE_DIRECT_UPLOADS === "true",
    /** Files one instance sends to storage at once; more wait briefly, then get 503 "try again". */
    maxConcurrentUploads: Number(process.env.STORAGE_MAX_CONCURRENT_UPLOADS) || 4,
  },

  /** Live updates across API instances (docs/api-contract.md §19). */
  realtime: {
    /** Upstash/Redis URL with publish rights (rediss://…). Empty → Mongo change streams, then in-memory. */
    redisUrl: process.env.REDIS_URL?.trim() || undefined,
    /** auto (default) | redis | mongo | memory */
    bus: (process.env.REALTIME_BUS?.trim() || "auto") as "auto" | "redis" | "mongo" | "memory",
    /** Keeps environments that share Redis/Mongo apart (their own channel). */
    env: process.env.REALTIME_ENV?.trim() || process.env.NODE_ENV || "development",
  },
});

const CLOUDINARY_URL_SHAPE = /^cloudinary:\/\/[^:@\s]+:[^@\s]+@[\w-]+$/;

export function validateEnv(env: Record<string, unknown>): Record<string, unknown> {
  // Shape only: the message never echoes the value (it contains the API secret).
  if (typeof env.CLOUDINARY_URL === "string" && env.CLOUDINARY_URL.trim() && !CLOUDINARY_URL_SHAPE.test(env.CLOUDINARY_URL.trim())) {
    throw new Error("CLOUDINARY_URL must look like cloudinary://<api_key>:<api_secret>@<cloud_name>");
  }
  if (env.NODE_ENV === "production") {
    const required = ["MONGODB_URI", "APP_URL", "CORS_ORIGIN", "RESEND_API_KEY", "RESEND_WEBHOOK_SECRET", "MAIL_FROM"];
    const missing = required.filter((k) => !env[k]);
    if (missing.length) throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
    if (!env.REDIS_URL) {
      console.warn("REDIS_URL is not set: live updates will use MongoDB change streams, or in-memory delivery (single instance only).");
    }
    if ((env.STORAGE_PROVIDER ?? "cloudinary") === "cloudinary" && !env.CLOUDINARY_URL) {
      console.warn("CLOUDINARY_URL is not set: photo and video uploads are off (POST /media answers 503).");
    }
  }
  return env;
}
