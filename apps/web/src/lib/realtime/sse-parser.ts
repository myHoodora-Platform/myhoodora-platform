export interface SseFrame {
  event: string;
  data: string;
}

/**
 * Incremental text/event-stream parser. Feed it chunks as they arrive (they
 * can split anywhere); it returns complete frames and keeps the remainder.
 * Comment lines (":…") and unknown fields are ignored, per the SSE spec.
 */
export class SseParser {
  private buffer = "";

  push(chunk: string): SseFrame[] {
    this.buffer += chunk.replace(/\r\n?/g, "\n");
    const frames: SseFrame[] = [];
    let end: number;
    while ((end = this.buffer.indexOf("\n\n")) !== -1) {
      const block = this.buffer.slice(0, end);
      this.buffer = this.buffer.slice(end + 2);
      let event = "message";
      const data: string[] = [];
      for (const line of block.split("\n")) {
        if (!line || line.startsWith(":")) continue;
        const colon = line.indexOf(":");
        const field = colon === -1 ? line : line.slice(0, colon);
        const value = colon === -1 ? "" : line.slice(colon + 1).replace(/^ /, "");
        if (field === "event") event = value;
        else if (field === "data") data.push(value);
      }
      if (data.length) frames.push({ event, data: data.join("\n") });
    }
    return frames;
  }
}
