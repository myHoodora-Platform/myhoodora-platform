import { sizedImage } from "../media";

const photo = "https://res.cloudinary.com/demo/image/upload/v17/myhoodora/post/abc.jpg";

describe("sizedImage", () => {
  it("asks Cloudinary for the shown width in device pixels, rounded up to a step", () => {
    expect(sizedImage(photo, 390, 3)).toBe("https://res.cloudinary.com/demo/image/upload/c_limit,w_1440,q_auto,f_auto/v17/myhoodora/post/abc.jpg");
    expect(sizedImage(photo, 195, 2)).toBe("https://res.cloudinary.com/demo/image/upload/c_limit,w_480,q_auto,f_auto/v17/myhoodora/post/abc.jpg");
  });

  it("leaves other links and already transformed ones alone", () => {
    expect(sizedImage("https://images.unsplash.com/photo-1.jpg", 300, 2)).toBe("https://images.unsplash.com/photo-1.jpg");
    const done = "https://res.cloudinary.com/demo/image/upload/c_fill,w_200/v1/x.jpg";
    expect(sizedImage(done, 300, 2)).toBe(done);
    const video = "https://res.cloudinary.com/demo/video/upload/v1/x.mp4";
    expect(sizedImage(video, 300, 2)).toBe(video);
  });
});
