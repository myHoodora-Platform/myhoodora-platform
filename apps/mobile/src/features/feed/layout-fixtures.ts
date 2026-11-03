import type { ApiPost } from "@myhoodora/api-contract/types";

/**
 * Made-up posts of every shape the feed has to lay out (QA layout gallery only, never sent anywhere):
 * short, long, very long, line breaks, one to seven photos of different shapes, alerts, categories,
 * busy and empty counts, your own post, a departed author.
 */
const DEMO = ["sample", "cld-sample", "cld-sample-2", "cld-sample-3", "cld-sample-4", "cld-sample-5"];
/** Cloudinary's public demo photos: grid tiles as uploaded (so the app's resizing applies), single ones cut to a shape. */
const photo = (seed: string, w: number, h: number) => {
  const name = DEMO[[...seed].reduce((a, c) => a + c.charCodeAt(0), 0) % DEMO.length];
  return w === h ? `https://res.cloudinary.com/demo/image/upload/${name}.jpg` : `https://res.cloudinary.com/demo/image/upload/c_fill,w_${w},h_${h}/${name}.jpg`;
};
const hour = 3_600_000;
const at = (hoursAgo: number) => new Date(Date.now() - hoursAgo * hour).toISOString();
const ada = { uid: "qa-ada", displayName: "Ada Okafor", neighborhoodName: "Ikeja GRA" };
const tunde = { uid: "qa-tunde", displayName: "Tunde Bakare-Williams Oluwaseun", photoURL: photo("tunde", 200, 200), neighborhoodName: "Ikeja" };

let n = 0;
function post(extra: Partial<ApiPost>): ApiPost {
  n += 1;
  const id = `qa${String(n).padStart(22, "0")}`;
  return {
    _id: id,
    authorUid: ada.uid,
    neighborhoodId: "qa-hood",
    type: "text" as ApiPost["type"],
    content: extra.message ?? "",
    mediaUrls: [],
    likes: [],
    isActive: true,
    createdAt: at(n),
    updatedAt: at(n),
    author: ada,
    reactionTotal: 0,
    reactionCounts: {},
    commentCount: 0,
    ...extra,
  };
}

const long = "The water board says the main on Allen Avenue will be off from Tuesday morning while they replace the valve. Fill your tanks tonight. ".repeat(4).trim();
const veryLong = `${"Minutes from Saturday's residents' meeting. ".repeat(10)}${"We discussed security, the drainage on Road 3, the new gate times and the levy for the transformer repair. ".repeat(20)}`;

export function layoutFixtures(myUid: string): ApiPost[] {
  n = 0;
  return [
    post({ message: "Short one. Anyone else lose power just now?", reactionTotal: 3, reactionCounts: { like: 2, sad: 1 }, commentCount: 4 }),
    post({ message: long, author: tunde, authorUid: tunde.uid, reactionTotal: 128, reactionCounts: { like: 90, helpful: 30, wow: 8 }, commentCount: 37, myReaction: "helpful" }),
    post({ message: "Line\nbreaks\nmake\nthis\npost\ntall\nthough\nit's\nshort", commentCount: 1 }),
    post({ message: veryLong, reactionTotal: 1, reactionCounts: { agree: 1 } }),
    post({ message: "One wide photo", mediaUrls: [photo("wide", 1600, 700)], mediaAspects: [1600 / 700], reactionTotal: 12, reactionCounts: { like: 12 } }),
    post({ message: "One tall photo (cropped to 4:5)", mediaUrls: [photo("tall", 900, 1600)], mediaAspects: [900 / 1600] }),
    post({ message: "", mediaUrls: [photo("noshape", 1200, 900)], mediaAspects: [null] }),
    post({ message: "Two photos", mediaUrls: [photo("two-a", 900, 900), photo("two-b", 900, 1200)], mediaAspects: [1, 0.75], commentCount: 2 }),
    post({ message: "Three, first one tall", mediaUrls: [photo("three-a", 800, 1200), photo("three-b", 900, 900), photo("three-c", 900, 900)], mediaAspects: [0.67, 1, 1] }),
    post({ message: "Three, first one wide", mediaUrls: [photo("threew-a", 1600, 900), photo("threew-b", 900, 900), photo("threew-c", 900, 900)], mediaAspects: [1.78, 1, 1] }),
    post({ message: "Four photos", mediaUrls: ["a", "b", "c", "d"].map((s) => photo(`four-${s}`, 900, 900)), mediaAspects: [1, 1, 1, 1] }),
    post({ message: "Seven photos: 2×2 and +3", mediaUrls: ["a", "b", "c", "d", "e", "f", "g"].map((s) => photo(`seven-${s}`, 900, 900)), reactionTotal: 5, reactionCounts: { haha: 5 } }),
    post({ message: "Armed robbery reported at the Allen roundabout. Avoid the area.", category: "alert", urgent: true, reactionTotal: 40, reactionCounts: { sad: 25, helpful: 15 }, commentCount: 12 }),
    post({ message: "Gate on Road 5 was left open last night; sorted now.", category: "alert", resolvedAt: at(1) }),
    post({ message: "Best tailor around Ikeja? Mine moved to Abuja.", category: "recommendation", commentCount: 9 }),
    post({ message: "Selling a barely used 2.5kVA generator, ₦180,000.", category: "for_sale", mediaUrls: [photo("gen", 1200, 1200)], mediaAspects: [1] }),
    post({ message: "My own post: the menu offers Delete.", authorUid: myUid, author: { uid: myUid, displayName: "You", neighborhoodName: "Ikeja" } }),
    post({ message: "Author left myHoodora: no profile link.", author: undefined, authorUid: "gone" }),
  ];
}
