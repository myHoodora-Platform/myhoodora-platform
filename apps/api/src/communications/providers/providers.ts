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

/** Reserved: FCM (we already use Firebase). Not wired yet. */
export interface PushProvider {
  readonly name: string;
  send(message: { token: string; title: string; body: string; data?: Record<string, string> }): Promise<{ providerMessageId: string }>;
}
