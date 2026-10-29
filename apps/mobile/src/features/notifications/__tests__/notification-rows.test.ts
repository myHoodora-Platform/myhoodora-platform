import type { AppNotification } from "@myhoodora/api-contract/types";
import { sectionNotifications, shortAge, titleParts } from "../notification-rows";

const now = Date.parse("2026-10-27T12:00:00Z");
const ago = (hours: number) => new Date(now - hours * 3_600_000).toISOString();
const row = (id: string, hours: number, read = true): AppNotification => ({ _id: id, type: "reaction", title: "x", href: "/", createdAt: ago(hours), read });

describe("sectionNotifications", () => {
  it("puts unread under New and the rest by age, skipping empty sections", () => {
    const rows = [row("a", 30 * 24, false), row("b", 2), row("c", 3 * 24), row("d", 20 * 24), row("e", 60 * 24)];
    expect(sectionNotifications(rows, now).map((s) => [s.title, s.data.map((n) => n._id)])).toEqual([
      ["New", ["a"]],
      ["Today", ["b"]],
      ["This week", ["c"]],
      ["This month", ["d"]],
      ["Earlier", ["e"]],
    ]);
    expect(sectionNotifications([row("b", 1)], now).map((s) => s.title)).toEqual(["Today"]);
    expect(sectionNotifications([], now)).toEqual([]);
  });
});

describe("shortAge", () => {
  it("counts in the largest whole unit", () => {
    expect(shortAge(ago(0), now)).toBe("now");
    expect(shortAge(ago(0.5), now)).toBe("30m");
    expect(shortAge(ago(5), now)).toBe("5h");
    expect(shortAge(ago(2 * 24), now)).toBe("2d");
    expect(shortAge(ago(15 * 24), now)).toBe("2w");
    expect(shortAge(ago(400 * 24), now)).toBe("1y");
    expect(shortAge("not a date", now)).toBe("");
  });
});

describe("titleParts", () => {
  const tunde = { uid: "t", displayName: "Tunde Bello" };
  const ada = { uid: "a", displayName: "Ada" };

  it("makes the names bold, however many people", () => {
    expect(titleParts({ title: "Tunde Bello reacted to your post", actors: [tunde] })).toEqual({ names: "Tunde Bello", rest: " reacted to your post" });
    expect(titleParts({ title: "Tunde Bello and Ada reacted to your post", actors: [tunde, ada], actorCount: 2 })).toEqual({ names: "Tunde Bello and Ada", rest: " reacted to your post" });
    expect(titleParts({ title: "Tunde Bello and 4 others reacted to your post", actors: [tunde, ada], actorCount: 5 })).toEqual({ names: "Tunde Bello and 4 others", rest: " reacted to your post" });
  });

  it("leaves titles worded another way alone", () => {
    expect(titleParts({ title: "Power is back on Admiralty Way", actors: [tunde] })).toEqual({ names: "", rest: "Power is back on Admiralty Way" });
    expect(titleParts({ title: "Your email is confirmed" })).toEqual({ names: "", rest: "Your email is confirmed" });
  });
});
