import { describe, expect, it } from "vitest";
import { shareNote } from "@myhoodora/api-contract/invites";

describe("the note when sharing", () => {
  it("only for posts their Hood alone can read", () => {
    expect(shareNote({ visibility: "neighbourhood" }, "Ikeja")).toMatch(/outside Ikeja will see a preview only/);
    expect(shareNote({}, "Ikeja")).toMatch(/preview only/);
    expect(shareNote({ visibility: "anyone" }, "Ikeja")).toBeNull();
    expect(shareNote({ visibility: "nearby" })).toBeNull();
    expect(shareNote({ category: "alert" }, "Yaba")).toMatch(/Safety alerts stay in Yaba/);
  });
});
