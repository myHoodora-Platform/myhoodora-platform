import { decodePostContent, encodePostContent } from "./post-meta";

describe("post-meta codec (server port of the web codec)", () => {
  it("round-trips typed fields", () => {
    const content = encodePostContent("Sanitation day", { category: "event", eventDate: "2030-01-01T10:00:00.000Z", eventLocation: "Park" });
    expect(decodePostContent(content, "text")).toEqual({ message: "Sanitation day", meta: { category: "event", eventDate: "2030-01-01T10:00:00.000Z", eventLocation: "Park" } });
  });

  it("stores plain general posts without a prefix", () => {
    expect(encodePostContent("Hello", { category: "general" })).toBe("Hello");
  });

  it("reads the legacy <!--event:{}--> prefix", () => {
    const { message, meta } = decodePostContent('<!--event:{"date":"2030-01-01","location":"Hall"}-->\nAGM', "event");
    expect(message).toBe("AGM");
    expect(meta).toMatchObject({ category: "event", eventDate: "2030-01-01", eventLocation: "Hall" });
  });

  it("falls back safely on malformed or unknown metadata", () => {
    expect(decodePostContent("<!--mh:{broken-->\nHi", "alert")).toEqual({ message: "<!--mh:{broken-->\nHi", meta: { category: "alert" } });
    expect(decodePostContent('<!--mh:{"category":"hack"}-->\nHi', "text").meta.category).toBe("general");
  });
});
