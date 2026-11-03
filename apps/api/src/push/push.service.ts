import { BadRequestException, Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { PUSH_PROVIDER, type PushProvider } from "../communications/providers/providers";
import { AccountLifecycle } from "../users/account-lifecycle";
import { PushDevice, PushDeviceDocument, type PushPlatform } from "./push-device.schema";

/** Phones one person can have registered; registering another drops the one unused longest. */
export const MAX_DEVICES_PER_PERSON = 10;
/** Recipients whose devices are looked up per database round trip. */
const LOOKUP_BATCH = 1_000;

/** What a push says, and where tapping it goes (`href` is the in-app route, the same one the web uses). */
export interface PushPayload {
  title: string;
  body?: string;
  href: string;
  type: string;
  kind?: string;
  subjectId?: string;
}

/**
 * Phones registered for push, and delivery to them. NotificationsService decides who should hear
 * about something and whether they want it pushed; this only delivers, after the notification is
 * stored. A push that fails is logged and dropped: the notification itself is already in the app.
 */
@Injectable()
export class PushService implements OnModuleInit {
  private readonly logger = new Logger("Push");
  /** Deliveries still in flight, so tests (and a graceful shutdown) can wait for them. */
  private readonly inFlight = new Set<Promise<void>>();

  constructor(
    @InjectModel(PushDevice.name) private readonly devices: Model<PushDeviceDocument>,
    @Inject(PUSH_PROVIDER) private readonly provider: PushProvider,
    private readonly accounts: AccountLifecycle,
  ) {}

  onModuleInit() {
    this.accounts.register({
      name: "push devices",
      purge: async (uid, dryRun) => ({ pushDevices: dryRun ? await this.devices.countDocuments({ uid }).exec() : await this.removeAll(uid) }),
    });
  }

  /** Called by the app on each launch while signed in. Moves the token to this person if someone else had it. */
  async register(uid: string, token: string, platform: PushPlatform): Promise<void> {
    if (!this.provider.accepts(token)) throw new BadRequestException("That isn't a push token this server can use.");
    await this.devices.updateOne({ token }, { $set: { uid, platform, lastSeenAt: new Date() } }, { upsert: true }).exec();
    const extra = await this.devices.find({ uid }).sort({ lastSeenAt: -1 }).skip(MAX_DEVICES_PER_PERSON).select({ _id: 1 }).lean().exec();
    if (extra.length) await this.devices.deleteMany({ _id: { $in: extra.map((d) => d._id) } }).exec();
  }

  /** Log out on this phone. Only the person it belongs to can remove it; anything else is a quiet no-op. */
  async unregister(uid: string, token: string): Promise<void> {
    await this.devices.deleteOne({ uid, token }).exec();
  }

  /** Sign out everywhere, and account deletion. */
  async removeAll(uid: string): Promise<number> {
    return (await this.devices.deleteMany({ uid }).exec()).deletedCount;
  }

  /** Push to everyone listed, in the background. Never throws and never holds up the caller. */
  deliver(uids: string[], payload: PushPayload): void {
    if (!uids.length) return;
    const job = this.deliverNow(uids, payload)
      .catch((err: Error) => this.logger.warn(`Push delivery failed: ${err.message}`))
      .finally(() => this.inFlight.delete(job));
    this.inFlight.add(job);
  }

  /** Resolves once every delivery started so far has finished. */
  async settled(): Promise<void> {
    while (this.inFlight.size) await Promise.all([...this.inFlight]);
  }

  private async deliverNow(uids: string[], payload: PushPayload): Promise<void> {
    const data: Record<string, string> = { href: payload.href, type: payload.type };
    if (payload.kind) data.kind = payload.kind;
    if (payload.subjectId) data.subjectId = payload.subjectId;

    for (let i = 0; i < uids.length; i += LOOKUP_BATCH) {
      const devices = await this.devices.find({ uid: { $in: uids.slice(i, i + LOOKUP_BATCH) } }).select({ token: 1 }).lean<{ token: string }[]>().exec();
      if (!devices.length) continue;
      const outcomes = await this.provider.send(devices.map((d) => ({ token: d.token, title: payload.title, body: payload.body, data })));
      const dead = devices.filter((_, n) => { const o = outcomes[n]; return o && !o.ok && o.unregistered; }).map((d) => d.token);
      if (dead.length) await this.devices.deleteMany({ token: { $in: dead } }).exec();
      const failed = outcomes.filter((o) => !o.ok).length - dead.length;
      if (failed > 0) this.logger.warn(`${failed} of ${devices.length} push(es) were not accepted by ${this.provider.name}.`);
    }
  }
}
