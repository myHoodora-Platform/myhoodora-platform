import { Subject, filter, map, type Observable } from "rxjs";
import type { RealtimeBus } from "./realtime.bus";
import type { RealtimeEvent } from "./realtime.types";

/** What travels between API instances: the bus channel and the event. */
export interface BusEnvelope {
  ch: string;
  e: RealtimeEvent;
}

function isEnvelope(v: unknown): v is BusEnvelope {
  const x = v as BusEnvelope | null;
  return Boolean(x && typeof x.ch === "string" && x.e && typeof x.e.type === "string");
}

/**
 * Local fan-out shared by every adapter. Each API instance holds one
 * transport subscription (Redis channel, change stream…) that feeds this
 * Subject; every open SSE connection filters it for its own channels. So
 * connected browsers cost nothing extra on the transport.
 */
export abstract class DistributedBus implements RealtimeBus {
  abstract readonly name: string;
  private readonly local = new Subject<BusEnvelope>();

  abstract publish(channel: string, event: RealtimeEvent): void;

  stream(channels: string[]): Observable<RealtimeEvent> {
    const wanted = new Set(channels);
    return this.local.pipe(
      filter((m) => wanted.has(m.ch)),
      map((m) => m.e),
    );
  }

  /** An envelope arrived from the transport (from any instance, this one included). */
  protected receive(raw: unknown): void {
    if (isEnvelope(raw)) this.local.next(raw);
  }

  /** Deliver to this instance only (in-memory mode, or while the transport is down). */
  protected deliverLocally(channel: string, event: RealtimeEvent): void {
    this.local.next({ ch: channel, e: event });
  }
}
