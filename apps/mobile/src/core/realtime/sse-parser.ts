/** One Server-Sent Event: its name (`event:`) and its data (`data:` lines joined). */
export interface SseEvent {
  event: string;
  data: string;
}

/**
 * Splits a growing text/event-stream into events (the WHATWG rules we need: `event:`, `data:`, comments,
 * CRLF or LF, a blank line ends an event). Feed it the new text each time; it keeps any half-received
 * event for the next call.
 */
export function createSseParser(onEvent: (e: SseEvent) => void) {
  let buffer = "";
  return (chunk: string) => {
    buffer += chunk;
    const blocks = buffer.split(/\r?\n\r?\n/);
    buffer = blocks.pop() ?? "";
    for (const block of blocks) {
      let event = "message";
      const data: string[] = [];
      for (const line of block.split(/\r?\n/)) {
        if (!line || line.startsWith(":")) continue;
        const colon = line.indexOf(":");
        const field = colon === -1 ? line : line.slice(0, colon);
        const value = colon === -1 ? "" : line.slice(colon + 1).replace(/^ /, "");
        if (field === "event") event = value;
        else if (field === "data") data.push(value);
      }
      if (data.length || event !== "message") onEvent({ event, data: data.join("\n") });
    }
  };
}
