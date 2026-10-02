import { describe, expect, it } from "vitest";
import { decodePostContent, encodePostContent, postTypeFor } from "./post-meta";

describe("post meta encoding", () => {
  it("leaves plain general posts untouched", () => {
    expect(encodePostContent("Hello neighbours", { category: "general" })).toBe("Hello neighbours");
    expect(decodePostContent("Hello neighbours", "text")).toEqual({
      message: "Hello neighbours",
      meta: { category: "general" },
    });
  });

  it("round-trips category-specific fields", () => {
    const meta = { category: "alert" as const, alertCategory: "power" as const, urgent: true };
    const content = encodePostContent("Light is out on Road 5", meta);
    expect(decodePostContent(content, "alert")).toEqual({ message: "Light is out on Road 5", meta });
  });

  it("drops empty values from the prefix", () => {
    const content = encodePostContent("Clean-up", { category: "event", eventDate: "2026-10-01T08:00", eventLocation: "" });
    expect(content).not.toContain("eventLocation");
  });

  it("still reads the legacy event format", () => {
    const legacy = '<!--event:{"date":"2026-11-20T09:00","location":"Main gate"}-->\nPark cleanup';
    expect(decodePostContent(legacy, "event")).toEqual({
      message: "Park cleanup",
      meta: { category: "event", eventDate: "2026-11-20T09:00", eventLocation: "Main gate" },
    });
  });

  it("falls back safely on malformed prefixes", () => {
    const broken = "<!--mh:{not json}-->\nhi";
    expect(decodePostContent(broken, "text").message).toBe(broken);
  });

  it("infers category from the backend type when there is no prefix", () => {
    expect(decodePostContent("Robbery on Road 3", "alert").meta.category).toBe("alert");
    expect(decodePostContent("Party!", "event").meta.category).toBe("event");
  });

  it("maps categories to the backend PostType", () => {
    expect(postTypeFor({ category: "alert" }, false)).toBe("alert");
    expect(postTypeFor({ category: "event" }, true)).toBe("event");
    expect(postTypeFor({ category: "recommendation" }, true)).toBe("image");
    expect(postTypeFor({ category: "thanks" }, false)).toBe("text");
  });
});
