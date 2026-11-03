/**
 * Channel ports. Business code depends on these interfaces only; vendors
 * (Resend today, an SMS gateway or FCM later) are adapters behind them.
 */

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Provider-side de-duplication (Resend: Idempotency-Key, 24 h). */
  idempotencyKey: string;
  tags?: { name: string; value: string }[];
}

export interface EmailProvider {
  readonly name: string;
  send(message: EmailMessage): Promise<{ providerMessageId: string }>;
}

export const EMAIL_PROVIDER = Symbol("EMAIL_PROVIDER");

/** Reserved: e.g. a Nigerian SMS gateway. Not wired yet. */
export interface SmsProvider {
  readonly name: string;
  send(message: { to: string; body: string; idempotencyKey: string }): Promise<{ providerMessageId: string }>;
}

/** One push to one device. `data` travels with it, so the app can open the right screen when tapped. */
export interface PushMessage {
  token: string;
  title: string;
  body?: string;
  data?: Record<string, string>;
}

/** Per message, in the order sent. `unregistered`: the device token is dead (app removed, push turned off); stop using it. */
export type PushOutcome = { ok: true } | { ok: false; unregistered: boolean; error: string };

/** Push to phones (the mobile app). Expo's push service today; FCM/APNs directly would be another adapter. */
export interface PushProvider {
  readonly name: string;
  /** True if the provider can deliver to this token at all (a token from another provider is refused at registration). */
  accepts(token: string): boolean;
  send(messages: PushMessage[]): Promise<PushOutcome[]>;
}

export const PUSH_PROVIDER = Symbol("PUSH_PROVIDER");
