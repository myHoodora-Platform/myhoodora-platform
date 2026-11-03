import { createSseParser, type SseEvent } from "../sse-parser";

function parse(...chunks: string[]): SseEvent[] {
  const out: SseEvent[] = [];
  const feed = createSseParser((e) => out.push(e));
  chunks.forEach(feed);
  return out;
}

describe("SSE parser", () => {
  it("reads named events with JSON data", () => {
    expect(parse('event: chat.message\ndata: {"conversationId":"c1"}\n\n')).toEqual([{ event: "chat.message", data: '{"conversationId":"c1"}' }]);
  });

  it("keeps a half-received event until the rest arrives", () => {
    expect(parse("event: ready\nda", "ta: {}\n\nevent: ping\ndata: x\n", "\n")).toEqual([
      { event: "ready", data: "{}" },
      { event: "ping", data: "x" },
    ]);
  });

  it("handles CRLF, comments and multi-line data", () => {
    expect(parse(": keep-alive\r\n\r\ndata: a\r\ndata: b\r\n\r\n")).toEqual([{ event: "message", data: "a\nb" }]);
  });
});
