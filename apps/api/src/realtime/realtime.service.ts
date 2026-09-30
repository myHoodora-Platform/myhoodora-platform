import { Inject, Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import type { Observable } from "rxjs";
import type { Viewer } from "../shared/auth/viewer";
import { REALTIME_BUS, type RealtimeBus } from "./realtime.bus";
import { channel, type RealtimeEvent, type RealtimeEventType } from "./realtime.types";

type EventFields = Omit<RealtimeEvent, "type" | "at">;

/** How long bursty updates to one thing are merged into a single event. */
const COALESCE_MS = 1_000;

/**
 * The one place services publish live updates. Call it after the write has
 * committed. Publishing never throws: a live update is best-effort and must
 * not fail the request that caused it (clients resync on reconnect).
 */
@Injectable()
export class RealtimeService implements OnModuleDestroy {
  private readonly logger = new Logger(RealtimeService.name);
  private readonly pending = new Map<string, NodeJS.Timeout>();

  constructor(@Inject(REALTIME_BUS) private readonly bus: RealtimeBus) {}

  toUser(uid: string, type: RealtimeEventType, fields: EventFields = {}): void {
    this.publish(channel.user(uid), type, fields);
  }

  toUsers(uids: Iterable<string>, type: RealtimeEventType, fields: EventFields = {}): void {
    for (const uid of new Set(uids)) this.toUser(uid, type, fields);
  }

  toHood(hoodId: string | null | undefined, type: RealtimeEventType, fields: EventFields = {}): void {
    if (hoodId) this.publish(channel.hood(hoodId), type, fields);
  }

  toStaff(type: RealtimeEventType, fields: EventFields = {}): void {
    this.publish(channel.staff, type, fields);
  }

  /**
   * Like toHood, but a burst (a run of reactions or votes on one post) becomes
   * one event at the end of the window, so clients refetch once, not fifty times.
   */
  toHoodCoalesced(hoodId: string | null | undefined, type: RealtimeEventType, fields: EventFields & { id: string }): void {
    if (!hoodId) return;
    const key = `${hoodId}:${type}:${fields.id}`;
    if (this.pending.has(key)) return;
    this.pending.set(
      key,
      setTimeout(() => {
        this.pending.delete(key);
        this.toHood(hoodId, type, fields);
      }, COALESCE_MS),
    );
  }

  /** Everything this person may hear about: their own channel, their Hood, and staff news. */
  streamFor(viewer: Viewer): Observable<RealtimeEvent> {
    const channels = [channel.user(viewer.uid)];
    if (viewer.hoodId) channels.push(channel.hood(viewer.hoodId));
    if (viewer.role !== "member") channels.push(channel.staff);
    return this.bus.stream(channels);
  }

  onModuleDestroy(): void {
    for (const t of this.pending.values()) clearTimeout(t);
    this.pending.clear();
  }

  private publish(ch: string, type: RealtimeEventType, fields: EventFields): void {
    try {
      this.bus.publish(ch, { type, ...fields, at: new Date().toISOString() });
    } catch (err) {
      this.logger.warn(`Realtime publish failed (${type} → ${ch}): ${(err as Error).message}`);
    }
  }
}
