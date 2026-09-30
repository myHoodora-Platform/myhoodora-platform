/**
 * Typed configuration. Secrets live only in apps/api/.env (never in Next.js).
 * `validateEnv` fails fast in production when something essential is missing.
 */
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

export function validateEnv(env: Record<string, unknown>): Record<string, unknown> {
  if (env.NODE_ENV === "production") {
    const required = ["MONGODB_URI", "APP_URL", "CORS_ORIGIN", "RESEND_API_KEY", "RESEND_WEBHOOK_SECRET", "MAIL_FROM"];
    const missing = required.filter((k) => !env[k]);
    if (missing.length) throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
    if (!env.REDIS_URL) {
      console.warn("REDIS_URL is not set: live updates will use MongoDB change streams, or in-memory delivery (single instance only).");
    }
  }
  return env;
}
