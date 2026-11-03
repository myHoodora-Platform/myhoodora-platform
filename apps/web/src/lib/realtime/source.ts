import type { RealtimeEvent } from "./types";

export interface RealtimeHandlers {
  /** The stream is open and the server said "ready". */
  onOpen(): void;
  onEvent(event: RealtimeEvent): void;
  /** The connection dropped; the source is already retrying. */
  onDrop(attempt: number): void;
}

/**
 * Transport port (the web half of the API's REALTIME_BUS): screens never
 * talk to the network directly, so the transport can change (SSE today,
 * WebSocket or FCM later) without touching them.
 */
export interface RealtimeSource {
  /** Starts connecting; returns a function that closes it for good. */
  connect(handlers: RealtimeHandlers): () => void;
}
