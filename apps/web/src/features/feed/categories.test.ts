import { describe, expect, it } from "vitest";
import type { Post, PostMeta } from "@/lib/api/types";
import { isUrgentAlert, matchesFilter, parseFeedFilter } from "./categories";
import { needsKindnessReminder } from "./kindness";

function post(meta: PostMeta, hoursAgo = 0): Post {
  const createdAt = new Date(Date.now() - hoursAgo * 3_600_000).toISOString();
  return {
    _id: "p1",
    authorUid: "u1",
    neighborhoodId: "n1",
    type: "text",
    content: "",
    mediaUrls: [],
    likes: [],
    isActive: true,
    createdAt,
    updatedAt: createdAt,
    message: "",
    meta,
    commentCount: 0,
    myReaction: null,
  };
}

describe("feed filters", () => {
  it("parses unknown filters as all", () => {
    expect(parseFeedFilter("alerts")).toBe("alerts");
    expect(parseFeedFilter("nope")).toBe("all");
    expect(parseFeedFilter(null)).toBe("all");
  });

  it("groups lost & found and thanks under general", () => {
    expect(matchesFilter(post({ category: "lost_found" }), "general")).toBe(true);
    expect(matchesFilter(post({ category: "thanks" }), "general")).toBe(true);
    expect(matchesFilter(post({ category: "alert" }), "general")).toBe(false);
    expect(matchesFilter(post({ category: "for_sale" }), "for-sale")).toBe(true);
  });
});

describe("urgent alerts", () => {
  it("only take over the app for 2 hours", () => {
    expect(isUrgentAlert(post({ category: "alert", urgent: true }, 1))).toBe(true);
    expect(isUrgentAlert(post({ category: "alert", urgent: true }, 3))).toBe(false);
    expect(isUrgentAlert(post({ category: "alert" }, 0))).toBe(false);
  });
});

describe("kindness reminder", () => {
  it("flags insults, including Pidgin", () => {
    expect(needsKindnessReminder("You are a mumu")).toBe(true);
    expect(needsKindnessReminder("Stop this NONSENSE")).toBe(true);
  });

  it("does not flag ordinary words that contain them", () => {
    expect(needsKindnessReminder("Enter the code at the gate")).toBe(false);
    expect(needsKindnessReminder("Looking for a good plumber")).toBe(false);
  });
});
