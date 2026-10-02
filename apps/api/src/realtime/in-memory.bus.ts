import { DistributedBus } from "./distributed.bus";
import type { RealtimeEvent } from "./realtime.types";

/** Single-process fan-out. Correct only while the API runs as one instance. */
export class InMemoryRealtimeBus extends DistributedBus {
  readonly name = "in-memory";

  publish(channel: string, event: RealtimeEvent): void {
    this.deliverLocally(channel, event);
  }
}
