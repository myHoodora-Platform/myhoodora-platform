import { Logger } from "@nestjs/common";
import type { PushMessage, PushOutcome, PushProvider } from "./providers";

/**
 * PUSH_PROVIDER=log (tests, and local runs without phones). Records what would have been pushed.
 * Titles only in the log: a body can quote a neighbour's message.
 */
export class LogPushAdapter implements PushProvider {
  readonly name = "log";
  private readonly logger = new Logger("Push(dev)");
  /** Tests can read what was "sent". */
  readonly outbox: PushMessage[] = [];
  /** Tests can mark tokens as dead, the way the real service reports an uninstalled app. */
  readonly unregistered = new Set<string>();

  accepts(token: string): boolean {
    return token.length > 0;
  }

  async send(messages: PushMessage[]): Promise<PushOutcome[]> {
    return messages.map((m) => {
      if (this.unregistered.has(m.token)) return { ok: false, unregistered: true, error: "DeviceNotRegistered" };
      this.outbox.push(m);
      this.logger.debug(`Not sent: "${m.title}"`);
      return { ok: true };
    });
  }
}
