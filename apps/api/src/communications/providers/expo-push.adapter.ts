import type { PushMessage, PushOutcome, PushProvider } from "./providers";

/** Expo accepts at most 100 messages per request. */
const BATCH = 100;
const REQUEST_TIMEOUT_MS = 10_000;
const SEND_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_TOKEN = /^Expo(nent)?PushToken\[[A-Za-z0-9_-]+\]$/;

interface ExpoTicket {
  status: "ok" | "error";
  message?: string;
  details?: { error?: string };
}

/**
 * Expo's push service (https://docs.expo.dev/push-notifications/sending-notifications/). One API for
 * Android (FCM) and iOS (APNs); the platform credentials live with the app's EAS project, not here.
 * With "enhanced push security" on in the Expo project, EXPO_ACCESS_TOKEN must be set.
 *
 * Tickets only: a ticket of DeviceNotRegistered is reported so the token is dropped. Receipts (the
 * later, per-device delivery result) are not fetched; a token that keeps failing there is dropped the
 * next time a ticket says so.
 */
export class ExpoPushAdapter implements PushProvider {
  readonly name = "expo";

  constructor(
    private readonly accessToken?: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  accepts(token: string): boolean {
    return EXPO_TOKEN.test(token);
  }

  async send(messages: PushMessage[]): Promise<PushOutcome[]> {
    const outcomes: PushOutcome[] = [];
    for (let i = 0; i < messages.length; i += BATCH) outcomes.push(...(await this.sendBatch(messages.slice(i, i + BATCH))));
    return outcomes;
  }

  private async sendBatch(batch: PushMessage[]): Promise<PushOutcome[]> {
    const failAll = (error: string): PushOutcome[] => batch.map(() => ({ ok: false, unregistered: false, error }));
    let response: Response;
    try {
      response = await this.fetchImpl(SEND_URL, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...(this.accessToken && { Authorization: `Bearer ${this.accessToken}` }),
        },
        body: JSON.stringify(batch.map((m) => ({ to: m.token, title: m.title, body: m.body, data: m.data, sound: "default", priority: "high" }))),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (err) {
      return failAll(`request failed: ${(err as Error).message}`);
    }
    if (!response.ok) return failAll(`HTTP ${response.status}`);
    const body = (await response.json().catch(() => null)) as { data?: ExpoTicket[] } | null;
    const tickets = body?.data;
    if (!Array.isArray(tickets) || tickets.length !== batch.length) return failAll("unexpected response");
    return tickets.map((t) =>
      t.status === "ok" ? { ok: true } : { ok: false, unregistered: t.details?.error === "DeviceNotRegistered", error: t.details?.error ?? t.message ?? "error" },
    );
  }
}
