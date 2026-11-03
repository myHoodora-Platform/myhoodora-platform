import type { Observable } from "rxjs";
import type { RealtimeEvent } from "./realtime.types";

/**
 * Transport port. Business code only talks to RealtimeService; the bus is an
 * adapter behind it, like EMAIL_PROVIDER for email: in-memory today (one API
 * instance), Redis pub/sub or Mongo change streams when we run several.
 */
export interface RealtimeBus {
  readonly name: string;
  publish(channel: string, event: RealtimeEvent): void;
  /** Every event published to any of these channels, from now on. */
  stream(channels: string[]): Observable<RealtimeEvent>;
}

export const REALTIME_BUS = Symbol("REALTIME_BUS");
