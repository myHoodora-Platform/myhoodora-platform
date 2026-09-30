import { describe, expect, it } from "vitest";
import { SseParser } from "./sse-parser";

describe("SseParser", () => {
  it("parses named events with JSON data", () => {
    const p = new SseParser();
    expect(p.push('event: post.created\ndata: {"type":"post.created","id":"p1"}\n\n')).toEqual([{ event: "post.created", data: '{"type":"post.created","id":"p1"}' }]);
  });

  it("reassembles frames split across chunks", () => {
    const p = new SseParser();
    expect(p.push("event: chat.mes")).toEqual([]);
    expect(p.push('sage\ndata: {"a":')).toEqual([]);
    expect(p.push("1}\n")).toEqual([]);
    expect(p.push("\nevent: ping\ndata: {}\n\n")).toEqual([
      { event: "chat.message", data: '{"a":1}' },
      { event: "ping", data: "{}" },
    ]);
  });

  it("ignores comments and joins multi-line data", () => {
    const p = new SseParser();
    expect(p.push(": keep-alive\n\ndata: line one\ndata: line two\n\n")).toEqual([{ event: "message", data: "line one\nline two" }]);
  });

  it("handles CRLF line endings", () => {
    const p = new SseParser();
    expect(p.push("event: ready\r\ndata: {}\r\n\r\n")).toEqual([{ event: "ready", data: "{}" }]);
  });
});
