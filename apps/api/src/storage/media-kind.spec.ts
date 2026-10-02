import { isVideoUrl, mediaMixProblem, sniffMediaType } from "./media-kind";

const PHOTO = "https://res.cloudinary.com/d/image/upload/f_auto,q_auto/v1/p/a?_a=X";
const VIDEO = "https://res.cloudinary.com/d/video/upload/q_auto,w_1280,c_limit/v1/p/b.mp4?_a=X";

describe("media kind", () => {
  it("recognises videos by extension or provider path", () => {
    expect(isVideoUrl(VIDEO)).toBe(true);
    expect(isVideoUrl("https://cdn.example.com/clip.MOV")).toBe(true);
    expect(isVideoUrl(PHOTO)).toBe(false);
  });
  it("allows up to 10 photos or exactly one video", () => {
    expect(mediaMixProblem([PHOTO, PHOTO])).toBeNull();
    expect(mediaMixProblem([VIDEO])).toBeNull();
    expect(mediaMixProblem([VIDEO, VIDEO])).toMatch(/one video/);
    expect(mediaMixProblem([VIDEO, PHOTO])).toMatch(/not both/);
  });
});

describe("sniffMediaType", () => {
  const b = (...parts: (number[] | string)[]) => Buffer.concat(parts.map((p) => (typeof p === "string" ? Buffer.from(p, "latin1") : Buffer.from(p))));
  it("reads the real type from the first bytes", () => {
    expect(sniffMediaType(b([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffMediaType(b("\x89PNG\r\n\x1a\n"))).toBe("image/png");
    expect(sniffMediaType(b("GIF89a"))).toBe("image/gif");
    expect(sniffMediaType(b("RIFF", [0, 0, 0, 0], "WEBPVP8 "))).toBe("image/webp");
    expect(sniffMediaType(b([0x1a, 0x45, 0xdf, 0xa3]))).toBe("video/webm");
    expect(sniffMediaType(b([0, 0, 0, 0x18], "ftypisom"))).toBe("video/mp4");
    expect(sniffMediaType(b([0, 0, 0, 0x14], "ftypqt  "))).toBe("video/quicktime");
    expect(sniffMediaType(b([0, 0, 0, 0x18], "ftypheic"))).toBe("image/heic");
  });
  it("refuses anything else, whatever it's called", () => {
    expect(sniffMediaType(b("%PDF-1.7"))).toBeNull();
    expect(sniffMediaType(b("<html><body>"))).toBeNull();
    expect(sniffMediaType(Buffer.alloc(0))).toBeNull();
  });
});
