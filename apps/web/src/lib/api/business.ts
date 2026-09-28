import { ApiError, FRIENDLY_MESSAGES } from "./client";
import { API_BASE_URL, isLive } from "./config";
import { latency, load, mockId, save } from "./mock/store";

export const BUSINESS_CATEGORIES = [
  { id: "home_services", label: "Artisan / home services" },
  { id: "food", label: "Food & catering" },
  { id: "retail", label: "Shop / supermarket" },
  { id: "beauty", label: "Beauty & wellness" },
  { id: "education", label: "School / tutoring" },
  { id: "property", label: "Property & facilities" },
  { id: "health", label: "Health & pharmacy" },
  { id: "other", label: "Something else" },
] as const;

export type BusinessCategory = (typeof BUSINESS_CATEGORIES)[number]["id"];

export interface BusinessApplication {
  businessName: string;
  category: BusinessCategory;
  description: string;
  areasServed: string[]; // neighbourhood names
  address?: string;
  contactName: string;
  phone: string; // E.164, e.g. +2348031234567
  email: string;
  cacNumber?: string; // RC/BN number, optional
  wantsAdsUpdates: boolean;
}

export interface BusinessApplicationResult {
  id: string;
  status: "pending_review";
}

/**
 * planned: POST /business-pages/applications (public; no account needed yet).
 * Creates a pending Business Page; the team verifies the phone (OTP) and CAC
 * number if given, then emails a link to claim the page.
 */
export async function submitBusinessApplication(input: BusinessApplication): Promise<BusinessApplicationResult> {
  if (isLive("business")) {
    let res: Response;
    try {
      res = await fetch(`${API_BASE_URL}/business-pages/applications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new ApiError(FRIENDLY_MESSAGES.network, 0, "network");
    }
    if (!res.ok) throw new ApiError(FRIENDLY_MESSAGES.server, res.status, res.status >= 500 ? "server" : "client");
    return res.json();
  }
  await latency(600);
  const all = load<(BusinessApplication & { id: string; at: string })[]>("business-applications", () => []);
  const id = mockId("biz");
  save("business-applications", [...all, { ...input, id, at: new Date().toISOString() }]);
  return { id, status: "pending_review" };
}

/** Normalise Nigerian numbers: 0803…, 234803…, +234 803… → +234803…; null if invalid. */
export function normaliseNigerianPhone(raw: string): string | null {
  const digits = raw.replace(/[^\d+]/g, "");
  const m = digits.match(/^(?:\+?234|0)([789][01]\d{8})$/);
  return m ? `+234${m[1]}` : null;
}

/** CAC numbers look like RC123456 (companies) or BN1234567 (business names). */
export function isValidCacNumber(raw: string): boolean {
  return /^(RC|BN|IT)\s?\d{4,8}$/i.test(raw.trim());
}
