import { describe, expect, it } from "vitest";
import { clampAspect, imageSrcSet, imageUrl, isVideoUrl, videoPoster } from "./media-url";

const STORED = "https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/v1/myhoodora/production/post/abc?_a=BAM";

describe("imageUrl", () => {
  it("resizes without cropping by default, replacing the stored delivery settings", () => {
    expect(imageUrl(STORED, { width: 720 })).toBe("https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_720,c_limit/v1/myhoodora/production/post/abc?_a=BAM");
  });
  it("smart-crops to an aspect ratio (faces and subjects stay in frame)", () => {
    expect(imageUrl(STORED, { width: 540, aspect: 0.8 })).toContain("/f_auto,q_auto,w_540,c_fill,g_auto,ar_0.800/v1/myhoodora/");
  });
  it("handles URLs without a version or stored transformation", () => {
    expect(imageUrl("https://res.cloudinary.com/demo/image/upload/folder/pic.jpg", { width: 100 })).toBe("https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_100,c_limit/folder/pic.jpg");
  });
  it("leaves other hosts alone", () => {
    const u = "https://images.unsplash.com/photo-1?w=1200";
    expect(imageUrl(u, { width: 300, aspect: 1 })).toBe(u);
    expect(imageSrcSet(u, {})).toBeUndefined();
  });
  it("builds a width-based srcset for Cloudinary", () => {
    expect(imageSrcSet(STORED, { aspect: 1 }, [360, 720])).toMatch(/w_360,c_fill,g_auto,ar_1\.000\/.* 360w, .*w_720.* 720w$/);
  });
});

describe("clampAspect", () => {
  it("keeps feed photos between 4:5 and 1.91:1", () => {
    expect(clampAspect(9 / 16)).toBe(0.8);
    expect(clampAspect(3 / 1)).toBe(1.91);
    expect(clampAspect(4 / 3)).toBeCloseTo(1.333);
  });
});

describe("video helpers", () => {
  const VIDEO = "https://res.cloudinary.com/demo/video/upload/q_auto,w_1280,c_limit/v1/myhoodora/production/post/clip.mp4?_a=X";
  it("recognises videos by extension or Cloudinary path", () => {
    expect(isVideoUrl(VIDEO)).toBe(true);
    expect(isVideoUrl("https://example.com/a.webm#t=0.1")).toBe(true);
    expect(isVideoUrl(STORED)).toBe(false);
  });
  it("derives a poster frame for Cloudinary videos only", () => {
    expect(videoPoster(VIDEO)).toBe("https://res.cloudinary.com/demo/video/upload/so_0,f_auto,q_auto,w_720,c_limit/v1/myhoodora/production/post/clip.jpg?_a=X");
    expect(videoPoster("https://example.com/a.mp4")).toBeUndefined();
  });
});
