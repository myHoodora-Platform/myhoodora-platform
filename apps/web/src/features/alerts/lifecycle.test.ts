import { describe, expect, it } from "vitest";
import type { AlertCategory, Post } from "@/lib/api/types";
import { alertStatus, groupActiveAlerts, isActiveAlert, isRecentAlert } from "./lifecycle";

let n = 0;
function alert(category: AlertCategory, hoursAgo: number, extra: Partial<Post> & { urgent?: boolean } = {}): Post {
  const createdAt = new Date(Date.now() - hoursAgo * 3_600_000).toISOString();
  const { urgent, ...rest } = extra;
  return {
    _id: `a${++n}`, authorUid: "u", neighborhoodId: "n", type: "alert", content: "", mediaUrls: [], likes: [],
    isActive: true, createdAt, updatedAt: createdAt, message: "m", commentCount: 0, myReaction: null,
    resolvedAt: null, meta: { category: "alert", alertCategory: category, urgent }, ...rest,
  };
}

describe("alert lifecycle", () => {
  it("is urgent only for 2 hours, then active until its type's window ends", () => {
    expect(alertStatus(alert("security", 1, { urgent: true }))).toBe("urgent");
    expect(alertStatus(alert("security", 3, { urgent: true }))).toBe("active");
    expect(alertStatus(alert("security", 13, { urgent: true }))).toBe("ended");
  });

  it("uses a per-type active window", () => {
    expect(isActiveAlert(alert("traffic", 2))).toBe(true);
    expect(isActiveAlert(alert("traffic", 4))).toBe(false); // traffic clears after 3h
    expect(isActiveAlert(alert("scam", 72))).toBe(true); // scams stay relevant for a week
  });

  it("ends immediately when resolved, even if urgent", () => {
    const p = alert("fire", 0.5, { urgent: true, resolvedAt: new Date().toISOString() });
    expect(alertStatus(p)).toBe("resolved");
    expect(isActiveAlert(p)).toBe(false);
  });

  it("keeps a week of history on the Alerts page", () => {
    expect(isRecentAlert(alert("power", 24 * 6))).toBe(true);
    expect(isRecentAlert(alert("power", 24 * 8))).toBe(false);
  });

  it("groups reports of the same type, urgent groups first", () => {
    const groups = groupActiveAlerts([
      alert("power", 1),
      alert("power", 0.5),
      alert("power", 0.2),
      alert("fire", 1.5, { urgent: true }),
      alert("traffic", 5), // ended — not grouped
    ]);
    expect(groups.map((g) => [g.category, g.posts.length, g.urgent])).toEqual([
      ["fire", 1, true],
      ["power", 3, false],
    ]);
    expect(groups[1]!.latest.createdAt >= groups[1]!.posts[2]!.createdAt).toBe(true);
  });
});
