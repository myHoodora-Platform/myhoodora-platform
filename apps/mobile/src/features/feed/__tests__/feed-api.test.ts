import type { ApiPost } from "@myhoodora/api-contract/types";
import { FEED_PAGE, nextCursor } from "../feed-api";

const post = (createdAt: string) => ({ _id: createdAt, createdAt }) as ApiPost;

describe("feed paging", () => {
  it("continues from the oldest post of a full page", () => {
    const page = Array.from({ length: FEED_PAGE }, (_, i) => post(`2026-10-${String(20 - i).padStart(2, "0")}T00:00:00.000Z`));
    expect(nextCursor(page)).toBe("2026-10-11T00:00:00.000Z");
  });

  it("stops after a short page", () => {
    expect(nextCursor([post("2026-10-20T00:00:00.000Z")])).toBeUndefined();
    expect(nextCursor([])).toBeUndefined();
  });
});
