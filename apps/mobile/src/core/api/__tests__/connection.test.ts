import { noticeFor } from "../connection";
import { refreshFailure } from "@/shared/hooks/use-pull-refresh";

describe("the connection strip", () => {
  it("says nothing when all is well", () => {
    expect(noticeFor({ online: true, justBack: false, slow: false })).toBeNull();
  });

  it("puts no connection ahead of a slow one, and back online ahead of slow", () => {
    expect(noticeFor({ online: false, justBack: true, slow: true })).toBe("offline");
    expect(noticeFor({ online: true, justBack: true, slow: true })).toBe("back");
    expect(noticeFor({ online: true, justBack: false, slow: true })).toBe("slow");
  });
});

describe("a pull that failed", () => {
  it("finds the error in one refetch result or several", () => {
    const boom = new Error("offline");
    expect(refreshFailure({ error: null, data: [] })).toBeNull();
    expect(refreshFailure({ error: boom })).toBe(boom);
    expect(refreshFailure([{ error: null }, { error: boom }])).toBe(boom);
    expect(refreshFailure(undefined)).toBeNull();
  });
});
