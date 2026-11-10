import type { AppConfig } from "@myhoodora/api-contract/app-config";
import { API_BASE_URL } from "@/lib/api/config";

/** The API's default (apps/api platform-settings.schema.ts), for the admin mock store. */
export const DEFAULT_HOODORA_AI = { target: "studio", studioUrl: "https://studio.myhoodora.com/" } as const;

const TTL_MS = 60_000;
// The API can't be reached: show our own /ai page, and don't make every visit wait out the timeout.
const FAILED_TTL_MS = 10_000;
const TIMEOUT_MS = 3_000;

let cached: { studio: string | null; until: number } | null = null;
let asking: Promise<string | null> | null = null;

/**
 * Where /ai should send people (Admin → Settings → Platform → myHoodora AI link): the AI Studio's
 * address, or null for our own /ai page. Remembered for a minute per server instance, so a switch
 * reaches every visitor within about a minute, and /ai costs one API call a minute at most.
 */
export async function hoodoraAiStudioUrl(now = Date.now()): Promise<string | null> {
  if (cached && now < cached.until) return cached.studio;
  asking ??= fetch(`${API_BASE_URL}/app-config`, { signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" })
    .then(async (res) => {
      if (!res.ok) throw new Error(String(res.status));
      const studio = safeStudioUrl(((await res.json()) as Partial<AppConfig>).links?.hoodoraAiStudio);
      cached = { studio, until: Date.now() + TTL_MS };
      return studio;
    })
    .catch(() => {
      cached = { studio: null, until: Date.now() + FAILED_TTL_MS };
      return null;
    })
    .finally(() => {
      asking = null;
    });
  return asking;
}

/** Only an https address is followed: anything else keeps people on our own page. */
export function safeStudioUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    return new URL(value).protocol === "https:" ? value : null;
  } catch {
    return null;
  }
}

/** For tests. */
export function resetHoodoraAiCache() {
  cached = null;
  asking = null;
}
