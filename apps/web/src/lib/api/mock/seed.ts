/**
 * Seed data for preview/mock mode. Realistic Lagos-estate content so every
 * screen can be designed, demoed and tested before its endpoint exists.
 */
import { encodePostContent } from "../post-meta";
import type {
  ApiPost,
  Comment,
  Conversation,
  Group,
  GroupPost,
  Listing,
  Message,
  PostMeta,
  PublicProfile,
} from "../types";
import { daysFromNow, hoursAgo } from "./store";

export const MOCK_NEIGHBORHOOD = {
  _id: "mock-lekki-phase-1",
  name: "Lekki Phase 1",
  city: "Lagos",
  country: "Nigeria",
  location: { type: "Point" as const, coordinates: [3.4746, 6.4478] as [number, number] },
};

export const MOCK_NEIGHBOURS: PublicProfile[] = [
  { uid: "nb_adaeze", displayName: "Adaeze Okafor", neighborhoodName: "Lekki Phase 1", neighbourSince: "2023-02-11", bio: "Mum of two, runs a small bakery from home. Happy to recommend good tailors!", verified: true },
  { uid: "nb_tunde", displayName: "Tunde Bakare", neighborhoodName: "Lekki Phase 1", neighbourSince: "2022-08-03", bio: "Civil engineer. Chairman, Road 12 residents.", verified: true },
  { uid: "nb_chidinma", displayName: "Chidinma Eze", neighborhoodName: "Lekki Phase 1", neighbourSince: "2024-01-20", verified: true },
  { uid: "nb_emeka", displayName: "Emeka Nwosu", neighborhoodName: "Lekki Phase 1", neighbourSince: "2021-11-05", bio: "Weekend footballer. Ask me about solar inverters.", verified: true },
  { uid: "nb_ngozi", displayName: "Ngozi Fashola", neighborhoodName: "Lekki Phase 1", neighbourSince: "2020-06-14", verified: true },
  { uid: "nb_ibrahim", displayName: "Ibrahim Musa", neighborhoodName: "Lekki Phase 1", neighbourSince: "2024-05-02", verified: true },
  { uid: "nb_funke", displayName: "Funke Ajayi", neighborhoodName: "Lekki Phase 1", neighbourSince: "2023-09-30", verified: true },
  { uid: "org_estate", displayName: "Lekki Phase 1 Residents Association", neighborhoodName: "Lekki Phase 1", neighbourSince: "2019-01-01", bio: "Official updates from the LPRA executive committee.", verified: true, kind: "organisation" },
];

function post(
  id: string,
  authorUid: string,
  type: ApiPost["type"],
  message: string,
  meta: PostMeta,
  createdAt: string,
  extra: Partial<ApiPost> = {},
): ApiPost {
  return {
    _id: id,
    authorUid,
    neighborhoodId: MOCK_NEIGHBORHOOD._id,
    type,
    content: encodePostContent(message, meta),
    mediaUrls: [],
    likes: [],
    isActive: true,
    createdAt,
    updatedAt: createdAt,
    ...extra,
  };
}

export function seedPosts(): ApiPost[] {
  return [
    post("mp_power", "org_estate", "alert", "Scheduled outage: Eko DisCo will be working on the Admiralty Way feeder from 9am to 4pm today. Please plan your generator fuel accordingly.", { category: "alert", alertCategory: "power" }, hoursAgo(1), { likes: ["nb_tunde", "nb_ngozi", "nb_funke"] }),
    post("mp_security", "nb_tunde", "alert", "Two young men on a motorbike were seen checking car doors on Road 14 around 2am. Estate security has been informed. Please don't leave valuables in your cars and keep gates locked.", { category: "alert", alertCategory: "security", urgent: true }, hoursAgo(0.6), { likes: ["nb_adaeze", "nb_emeka", "nb_ibrahim", "nb_chidinma"] }),
    post("mp_reco", "nb_chidinma", "text", "Can anyone recommend a reliable electrician around here? My inverter keeps tripping whenever the fridge comes on. 🙏", { category: "recommendation" }, hoursAgo(3), { likes: ["nb_adaeze"] }),
    post("mp_event", "nb_adaeze", "event", "Monthly estate sanitation + Road 12 clean-up. Gloves and bags provided. Kids welcome — there'll be zobo and puff-puff after!", { category: "event", eventDate: daysFromNow(4, 8), eventLocation: "Road 12 park, by the water tank" }, hoursAgo(20), { likes: ["nb_tunde", "nb_funke"], mediaUrls: ["/images/hero-street.webp"] }),
    post("mp_flood", "nb_emeka", "alert", "Heads up: the drainage by Freedom Way junction is blocked again and water is already ankle-deep after this morning's rain. Avoid if you're driving a low car.", { category: "alert", alertCategory: "flooding" }, hoursAgo(6), { likes: ["nb_ngozi"] }),
    post("mp_lost", "nb_funke", "text", "Found: a set of car keys (Toyota) with a small Arsenal keyholder near the Mega Chicken on Admiralty. I've dropped them with the gate security at Road 5.", { category: "lost_found" }, hoursAgo(9)),
    post("mp_thanks", "nb_ngozi", "text", "Big thank you to Mallam Sani, our Road 3 security man, who helped push my car to the mechanic in the rain yesterday. People like him make this estate home ❤️", { category: "thanks", thankedName: "Mallam Sani (Road 3 security)" }, hoursAgo(26), { likes: ["nb_adaeze", "nb_tunde", "nb_emeka", "nb_chidinma", "nb_ibrahim"] }),
    post("mp_sale", "nb_ibrahim", "image", "Selling my 2.5KVA inverter + 2 batteries, 18 months old, works perfectly. Moving to a flat with solar. Pick up on Road 7.", { category: "for_sale", priceNaira: 380000 }, hoursAgo(30)),
    post("mp_general", "nb_emeka", "text", "Anyone up for 5-a-side football on Saturday mornings? We're a group of 8 and need a few more. All levels welcome.", { category: "general" }, hoursAgo(50), { likes: ["nb_ibrahim"] }),
    post("mp_scam", "org_estate", "alert", "Scam warning: someone is calling residents pretending to be from the LPRA and asking for 'security levy' transfers. The association never collects dues by phone. Only pay at the secretariat.", { category: "alert", alertCategory: "scam" }, hoursAgo(72), { likes: ["nb_tunde", "nb_ngozi", "nb_adaeze"] }),
  ];
}

export function seedComments(): Comment[] {
  return [
    { _id: "mc_1", postId: "mp_reco", authorUid: "nb_emeka", content: "Call Oga Femi — 0803 000 0000. He fixed my inverter last month and didn't overcharge.", createdAt: hoursAgo(2.5), likes: ["nb_chidinma"] },
    { _id: "mc_2", postId: "mp_reco", authorUid: "nb_adaeze", content: "+1 for Femi. Also check that your fridge has a surge protector.", createdAt: hoursAgo(2), likes: [] },
    { _id: "mc_3", postId: "mp_security", authorUid: "nb_ibrahim", content: "Thanks for the heads up. I'll speak to the Road 14 guards tonight.", createdAt: hoursAgo(0.4), likes: ["nb_tunde"] },
    { _id: "mc_4", postId: "mp_event", authorUid: "nb_funke", content: "We'll be there! Should we bring rakes?", createdAt: hoursAgo(12), likes: [] },
  ];
}

export function seedListings(): Listing[] {
  const base = { neighborhoodId: MOCK_NEIGHBORHOOD._id, status: "available" as const, photos: [] as string[] };
  return [
    { ...base, _id: "ml_sofa", sellerUid: "nb_chidinma", title: "3-seater fabric sofa", description: "Grey fabric, very comfortable. Small stain on one cushion (see photo). Selling because we're relocating.", priceNaira: 85000, negotiable: true, category: "furniture", condition: "good", createdAt: hoursAgo(2) },
    { ...base, _id: "ml_inverter", sellerUid: "nb_ibrahim", title: "2.5KVA inverter + 2 batteries", description: "18 months old, works perfectly. Moving to a flat with solar.", priceNaira: 380000, negotiable: true, category: "electronics", condition: "good", createdAt: hoursAgo(30) },
    { ...base, _id: "ml_books", sellerUid: "nb_adaeze", title: "Primary 4 textbooks (full set)", description: "Complete set for Primary 4, barely used. Free to a family that needs them.", priceNaira: null, negotiable: false, category: "books", condition: "like_new", createdAt: hoursAgo(6) },
    { ...base, _id: "ml_bike", sellerUid: "nb_emeka", title: "Kids' bicycle (age 6–9)", description: "Blue, with training wheels. Tyres recently replaced.", priceNaira: 25000, negotiable: false, category: "kids", condition: "good", createdAt: hoursAgo(28) },
    { ...base, _id: "ml_freezer", sellerUid: "nb_funke", title: "Chest freezer (Haier Thermocool, 200L)", description: "Still freezing well. Pick up only.", priceNaira: 120000, negotiable: true, category: "home_appliances", condition: "fair", createdAt: hoursAgo(48) },
    { ...base, _id: "ml_agbada", sellerUid: "nb_tunde", title: "Agbada set, size L (worn once)", description: "Navy blue with gold embroidery. Worn once to a wedding.", priceNaira: 45000, negotiable: true, category: "fashion", condition: "like_new", createdAt: hoursAgo(70) },
  ];
}

export function seedGroups(): Group[] {
  const base = { neighborhoodId: MOCK_NEIGHBORHOOD._id, createdAt: hoursAgo(24 * 200) };
  return [
    { ...base, _id: "mg_watch", name: "Lekki Phase 1 Safety Watch", description: "Real-time security updates from verified residents and estate security. Report anything suspicious here first.", privacy: "private", category: "safety", memberCount: 128, membership: "none" },
    { ...base, _id: "mg_road12", name: "Road 12 Residents", description: "Everything happening on Road 12: dues, repairs, power, meet-ups.", privacy: "private", category: "estate", memberCount: 46, membership: "none" },
    { ...base, _id: "mg_parents", name: "Lekki Parents Network", description: "School runs, lesson teachers, kids' activities and swaps.", privacy: "open", category: "parents", memberCount: 212, membership: "none" },
    { ...base, _id: "mg_football", name: "Saturday 5-a-side", description: "Casual football every Saturday 7am. All levels.", privacy: "open", category: "hobbies", memberCount: 19, membership: "none" },
    { ...base, _id: "mg_business", name: "Lekki Small Businesses", description: "Home bakers, tailors, caterers and more — promote your services to neighbours.", privacy: "open", category: "business", memberCount: 87, membership: "none" },
  ];
}

export function seedGroupPosts(): GroupPost[] {
  return [
    { _id: "mgp_1", groupId: "mg_watch", authorUid: "nb_tunde", content: "New guard rotation starts Monday. Night shift will now patrol Roads 10–14 every hour.", createdAt: hoursAgo(5) },
    { _id: "mgp_2", groupId: "mg_watch", authorUid: "nb_ngozi", content: "Gate 2 barrier is stuck open again — reported to management.", createdAt: hoursAgo(15) },
    { _id: "mgp_3", groupId: "mg_parents", authorUid: "nb_adaeze", content: "Does anyone know a good maths lesson teacher for JSS2?", createdAt: hoursAgo(8) },
    { _id: "mgp_4", groupId: "mg_football", authorUid: "nb_emeka", content: "Game on this Saturday — pitch is booked 7–9am.", createdAt: hoursAgo(20) },
    { _id: "mgp_5", groupId: "mg_business", authorUid: "nb_adaeze", content: "Taking orders for small chops trays this weekend! DM me.", createdAt: hoursAgo(30) },
  ];
}

/** Per-viewer seed: an existing conversation about a listing. */
export function seedConversations(viewerUid: string): { conversations: Conversation[]; messages: Message[] } {
  const convo: Conversation = {
    _id: "mcv_sofa",
    participantUids: [viewerUid, "nb_chidinma"],
    context: { type: "listing", id: "ml_sofa", title: "3-seater fabric sofa", priceNaira: 85000 },
    lastMessage: { body: "Yes it's still available. You can come and see it after 5pm.", senderUid: "nb_chidinma", createdAt: hoursAgo(1) },
    unreadCount: 1,
    updatedAt: hoursAgo(1),
  };
  const messages: Message[] = [
    { _id: "mm_1", conversationId: convo._id, senderUid: viewerUid, body: "Hi Chidinma, is the sofa still available?", createdAt: hoursAgo(1.5) },
    { _id: "mm_2", conversationId: convo._id, senderUid: "nb_chidinma", body: "Yes it's still available. You can come and see it after 5pm.", createdAt: hoursAgo(1) },
  ];
  return { conversations: [convo], messages };
}
