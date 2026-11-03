import type { ApiPost } from "@myhoodora/api-contract/types";
import { activeCounts, alertStatus, groupActiveAlerts, isActiveAlert, splitAlerts } from "../alert-lifecycle";

const NOW = new Date("2026-10-28T12:00:00Z").getTime();
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000).toISOString();

function alert(id: string, over: Partial<ApiPost> = {}): ApiPost {
  return { _id: id, category: "alert", alertCategory: "power", createdAt: hoursAgo(1), ...over } as ApiPost;
}

describe("alert lifecycle", () => {
  it("is urgent for two hours, then active until its window ends", () => {
    expect(alertStatus(alert("a", { urgent: true, createdAt: hoursAgo(1) }), NOW)).toBe("urgent");
    expect(alertStatus(alert("a", { urgent: true, createdAt: hoursAgo(3) }), NOW)).toBe("active");
    expect(alertStatus(alert("a", { createdAt: hoursAgo(13) }), NOW)).toBe("ended");
  });

  it("follows the API's activeUntil over the built-in windows", () => {
    expect(alertStatus(alert("a", { createdAt: hoursAgo(20), activeUntil: hoursAgo(-1) }), NOW)).toBe("active");
    expect(alertStatus(alert("a", { createdAt: hoursAgo(1), activeUntil: hoursAgo(0.5) }), NOW)).toBe("ended");
  });

  it("a resolved alert is over, whatever its age", () => {
    expect(alertStatus(alert("a", { urgent: true, resolvedAt: hoursAgo(0.1) }), NOW)).toBe("resolved");
    expect(isActiveAlert(alert("a", { resolvedAt: hoursAgo(0.1) }), NOW)).toBe(false);
  });

  it("only alerts count", () => {
    expect(isActiveAlert({ ...alert("a"), category: "general" } as ApiPost, NOW)).toBe(false);
  });

  it("splits a week into active (urgent first) and earlier; older ones drop off", () => {
    const posts = [
      alert("old", { createdAt: hoursAgo(24 * 8) }),
      alert("ended", { createdAt: hoursAgo(30) }),
      alert("active", { createdAt: hoursAgo(0.5) }),
      alert("urgent", { urgent: true, createdAt: hoursAgo(1) }),
    ];
    const { active, earlier } = splitAlerts(posts, NOW);
    expect(active.map((p) => p._id)).toEqual(["urgent", "active"]);
    expect(earlier.map((p) => p._id)).toEqual(["ended"]);
  });

  it("groups reports of one kind, urgent kinds first", () => {
    const groups = groupActiveAlerts(
      [alert("p1"), alert("p2", { createdAt: hoursAgo(0.2) }), alert("s1", { alertCategory: "security", urgent: true })],
      NOW,
    );
    expect(groups.map((g) => [g.category, g.posts.length, g.urgent])).toEqual([
      ["security", 1, true],
      ["power", 2, false],
    ]);
    expect(groups[1]!.latest._id).toBe("p2");
  });

  it("counts what's active, per kind", () => {
    expect(activeCounts([alert("a"), alert("b", { alertCategory: "water" }), alert("c", { resolvedAt: hoursAgo(0) })], NOW)).toEqual({ all: 2, power: 1, water: 1 });
  });
});
