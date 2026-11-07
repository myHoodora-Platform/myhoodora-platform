/* global db, ObjectId, printjson -- mongosh shell globals; this file runs in mongosh, not the app */
// Store-screenshot demo content for Yaba (home) and Somolu (following), LOCAL Docker DB only.
// Everything carries storeShot: true (users: uid "store-u-*"), so it can be removed in one sweep.
// Re-runnable: clears its own previous run first. Run (from the repo root):
//   docker cp apps/mobile/store/src/store-seed.js myhoodora-mongo:/tmp/ && docker exec myhoodora-mongo mongosh myhoodora --quiet --file /tmp/store-seed.js
// Undo: see docs/mobile/store-listing.md ("How they were captured").
const ME = db.users.findOne({ email: "myhoodora+qa-store@gmail.com" }).uid;
const YABA = "6aac632e5d447a8480ed28f5";
const SOMOLU = "6abffb3e63249f964b7fd61e";
const CL = (p) => `https://res.cloudinary.com/demo/image/upload/${p}.jpg`;
const WEB = (f) => `http://localhost:3000/images/${f}`;
const NOW = Date.now();
const ago = (min) => new Date(NOW - min * 60000);
const H = 60, D = 1440;

// ---- clear the previous run ----
["posts", "listings", "comments", "reactions", "groups", "group_members", "group_posts", "rsvps", "conversations", "messages", "notifications", "poll_votes", "users"].forEach((c) => db[c].deleteMany({ storeShot: true }));

// ---- neighbours (made up, example.invalid, initials only: no faces) ----
const people = [
  ["Chiamaka Obi", YABA], ["Tunde Bakare", YABA], ["Aisha Lawal", YABA], ["Emeka Nwosu", YABA], ["Funke Adeyemi", YABA],
  ["Ibrahim Musa", YABA], ["Ngozi Okafor", YABA], ["Segun Oladipo", YABA], ["Blessing Etim", YABA], ["Kunle Ajayi", YABA],
  ["Zainab Yusuf", YABA], ["Chinedu Eze", YABA], ["Bisi Coker", YABA], ["Dayo Ogunleye", YABA], ["Ifeoma Nnaji", YABA],
  ["Yemisi Oduya", YABA], ["Adaeze Umeh", YABA], ["Femi Akinola", YABA], ["Grace Udo", YABA], ["Hauwa Bello", YABA],
  ["Kelechi Ibe", YABA], ["Tolu Martins", YABA], ["Lanre Shittu", SOMOLU], ["Amaka Chukwu", SOMOLU], ["Gbenga Oyewole", SOMOLU],
];
const bios = ["Yaba born and bred.", "Software engineer, jollof judge.", "Mum of two, always up for a chat.", "I fix things.", "Small business owner on Commercial Avenue.", ""];
const U = {}; // first name -> uid
const template = db.users.findOne({ uid: "demo-u-14" });
people.forEach(([name, hood], i) => {
  const uid = `store-u-${String(i + 1).padStart(2, "0")}`;
  U[name.split(" ")[0]] = uid;
  const since = ago((40 + i * 9) * D);
  const { _id, demoSeed, ...base } = template;
  db.users.insertOne({
    ...base, storeShot: true, uid, email: `store+${i + 1}@example.invalid`, displayName: name, bio: bios[i % bios.length] || undefined,
    neighborhoodId: hood, verifiedAt: since, emailVerifiedAt: since, createdAt: since, updatedAt: since,
    location: hood === YABA ? { lat: 6.5068, lng: 3.3755, address: "Yaba, Lagos" } : { lat: 6.5392, lng: 3.379, address: "Somolu, Lagos" },
  });
});
const crowd = Object.values(U);
const pick = (n, skip = []) => crowd.filter((u) => !skip.includes(u)).slice(0, n);

// The signed-in account gets a natural name for the shots (undo: displayName "QA Store").
db.users.updateOne({ uid: ME }, { $set: { displayName: "Dami Okoro", bio: "New to Yaba. Coffee, football and good neighbours." } });

// ---- posts ----
const posts = {};
function post(key, { by, hood = YABA, at, category, text, meta = {}, photos = [], reactions = {}, comments = [], place, extra = {} }) {
  const header = { category, ...meta };
  // Top-level copies the API writes on create (posts.service.ts create()).
  if (category === "alert") {
    extra = { alertCategory: meta.alertCategory ?? "other", activeUntil: new Date(at.getTime() + 24 * 3600000), ...extra };
    if (place) extra = { location: { type: "Point", coordinates: [place[1], place[2]] }, locationLabel: place[0], ...extra };
  }
  if (meta.thankedName) extra = { thankedName: meta.thankedName, ...extra };
  const _id = new ObjectId();
  const urgent = Boolean(meta.urgent);
  const type = category === "alert" ? "alert" : category === "event" ? "event" : photos.length ? "image" : "text";
  db.posts.insertOne({
    _id, storeShot: true, authorUid: by, neighborhoodId: hood, visibility: "neighbourhood", mediaUrls: photos,
    commentCount: comments.length, shareCount: Math.floor(Object.values(reactions).reduce((a, b) => a + b, 0) / 6),
    editedAt: null, commentsDisabled: false, resolvedAt: null, isActive: true, removedAt: null, urgent,
    createdAt: at, updatedAt: at, category, type, message: text, content: `<!--mh:${JSON.stringify(header)}-->\n${text}`,
    reactionCounts: reactions, ...extra,
  });
  const id = _id.toHexString();
  posts[key] = id;
  let last = null;
  comments.forEach(([who, body, reply], i) => {
    const cid = new ObjectId();
    const t = new Date(at.getTime() + (i + 1) * 7 * 60000);
    db.comments.insertOne({
      _id: cid, storeShot: true, postId: id, authorUid: who, content: body, deletedAt: null, removedAt: null,
      ...(reply && last && { parentId: last.id, replyToUid: last.uid }),
      likeCount: (i * 3) % 7, replyCount: 0, createdAt: t, updatedAt: t,
    });
    if (reply && last) db.comments.updateOne({ _id: new ObjectId(last.id) }, { $inc: { replyCount: 1 } });
    else last = { id: cid.toHexString(), uid: who };
  });
  return id;
}

post("alertSecurity", {
  by: U.Ibrahim, at: ago(22), category: "alert", meta: { alertCategory: "security", urgent: true }, place: ["Herbert Macaulay Way, Sabo", 6.5045, 3.3795],
  text: "Heads up: two men on a red okada are snatching phones around the Sabo end of Herbert Macaulay Way this evening. Keep your phone out of sight at the bus stop and walk in twos if you can. Sabo police station has been told.",
  reactions: { like: 31, helpful: 48, agree: 12 },
  comments: [
    [U.Ngozi, "Thanks for this. My cousin was nearly a victim there on Tuesday."],
    [U.Ibrahim, "Sorry about your cousin. Glad she's safe 🙏🏾", true],
    [U.Segun, "Shared with our street WhatsApp. Stay safe everyone."],
    [U.Hauwa, "Is there a description of the bike?"],
    [U.Ibrahim, "Red Bajaj, no plate number. Rider in a black helmet.", true],
    [ME, "Thanks Ibrahim, I take that bus stop every morning. Will be careful."],
    [U.Femi, "We should ask the association for better lighting at that stretch."],
  ],
});
post("alertPower", {
  by: U.Tolu, at: ago(58), category: "alert", meta: { alertCategory: "power" }, place: ["Commercial Avenue", 6.5076, 3.3769],
  text: "Planned outage: the transformer on Commercial Avenue will be off tomorrow from 10am to 2pm for maintenance. Charge your power banks 🔋",
  reactions: { like: 17, helpful: 26 },
  comments: [[U.Kunle, "Thanks for the notice!"], [U.Bisi, "At least they told us this time 😅"]],
});
post("amala", {
  by: U.Funke, at: ago(1 * H + 35), category: "recommendation",
  text: "Who else has tried the new fish spot on Akoka Road? Fresh croaker done with peppers and veg, and the pepper soup is proper 😋 ₦4,500 for a whole fish. The owner is a Yaba girl, let's support her!",
  photos: [CL("samples/food/fish-vegetables")],
  reactions: { like: 64, helpful: 19, agree: 22 },
  comments: [
    [U.Chinedu, "Went yesterday. Can confirm, the pepper soup is top-tier."], [U.Zainab, "Do they deliver?"],
    [U.Funke, "Yes, within Yaba. Ask for Mama Tope.", true], [U.Dayo, "Adding this to my list 📝"], [U.Adaeze, "Finally, someone said it!"],
  ],
});
post("cleanup", {
  by: U.Aisha, at: ago(2 * H + 10), category: "event",
  meta: { eventDate: "2026-11-14T06:00:00.000Z", eventLocation: "Tejuosho Market main gate, Yaba" },
  text: "Yaba Clean-Up Saturday 🧹\nLet's make our streets shine. Gloves, brooms and bags are provided by the residents' association. Free breakfast for every volunteer!",
  photos: [WEB("hero-street.webp")],
  reactions: { like: 52, agree: 14, helpful: 9 },
  comments: [[U.Kelechi, "Count me in. I'll bring my two boys."], [U.Grace, "What time does it end?"], [U.Aisha, "Around 11am. Come for any part of it!", true], [ME, "I'll be there 💪🏾"]],
  extra: { eventDate: new Date("2026-11-14T06:00:00.000Z"), eventLocation: "Tejuosho Market main gate, Yaba" },
});
post("electrician", {
  by: ME, at: ago(3 * H + 5), category: "recommendation",
  text: "Can anyone recommend a reliable electrician in Yaba? My inverter keeps tripping whenever the fridge comes on. Thanks in advance!",
  reactions: { like: 8, helpful: 5 },
  comments: [
    [U.Tunde, "Call Mr Segun Electrical on Montgomery Road. He sorted my inverter in one visit, fair price."],
    [U.Kunle, "Second Mr Segun. Very honest guy."], [U.Blessing, "Check your fridge isn't on the same circuit as the AC first."],
    [U.Emeka, "Happened to me. It was the battery terminals, quick fix."], [ME, "Thank you all! Calling him now 🙏🏾"],
  ],
});
post("catFound", {
  by: U.Blessing, at: ago(4 * H + 40), category: "lost_found",
  text: "Found: a friendly grey cat with a green collar near Alagomeji bus stop. She's safe with me for now. If she's yours, message me with a photo of her and I'll bring her home 🐈",
  photos: [CL("samples/animals/cat")],
  reactions: { like: 41, helpful: 12 },
  comments: [[U.Yemisi, "So kind of you! Sharing with the Alagomeji group."], [U.Ifeoma, "I think she belongs to the family at No. 14. I'll let them know."]],
});
post("meetingPoll", {
  by: U.Femi, at: ago(5 * H + 20), category: "poll",
  meta: { poll: { options: [{ id: "o1", text: "Saturday morning" }, { id: "o2", text: "Sunday after church" }, { id: "o3", text: "Wednesday evening" }], closesAt: "2026-11-10T18:00:00.000Z" } },
  text: "The residents' association is picking a day for the monthly meeting. Which works best for you?",
  reactions: { like: 15 },
  comments: [[U.Hauwa, "Saturday please, weekdays are rough with traffic."], [U.Chiamaka, "Sunday works for my family."]],
  extra: { poll: { options: [{ id: "o1", text: "Saturday morning" }, { id: "o2", text: "Sunday after church" }, { id: "o3", text: "Wednesday evening" }], closesAt: new Date("2026-11-10T18:00:00.000Z") } },
});
post("thanks", {
  by: U.Grace, at: ago(7 * H), category: "thanks", meta: { thankedName: "Mr Musa at the Montgomery Road gate" },
  text: "A big thank you to Mr Musa at the Montgomery Road gate, who helped push my car to the mechanic at 11pm last night. This is what good neighbours look like 🙏🏾",
  reactions: { like: 88, agree: 21 },
  comments: [[U.Ibrahim, "Mr Musa is a gem!"], [U.Bisi, "We should do something nice for him at Christmas."], [U.Tolu, "Agreed, I'll chip in."]],
});
post("market", {
  by: U.Bisi, at: ago(9 * H + 30), category: "general",
  text: "Tejuosho market this morning. Tomatoes have finally come down: ₦3,000 for a small basket 🍅 Pepper is still high though.",
  photos: [WEB("market-street.webp")],
  reactions: { like: 46, helpful: 30 },
  comments: [[U.Zainab, "Thank God! Stew is back on the menu 😂"], [U.Chinedu, "Which side of the market?"], [U.Bisi, "Back row, near the fabric sellers.", true]],
});
post("jazz", {
  by: U.Dayo, at: ago(12 * H), category: "event",
  meta: { eventDate: "2026-11-13T17:00:00.000Z", eventLocation: "Hub Café, Commercial Avenue, Yaba" },
  text: "Friday Live Jazz Night 🎷\nLive band, small chops and a chance to meet your neighbours. Free entry, bring a friend.",
  photos: [CL("samples/people/jazz")],
  reactions: { like: 39, agree: 6 },
  comments: [[U.Adaeze, "Last month's was so good!"], [U.Kelechi, "Is there parking?"], [U.Dayo, "Yes, behind the café.", true]],
  extra: { eventDate: new Date("2026-11-13T17:00:00.000Z"), eventLocation: "Hub Café, Commercial Avenue, Yaba" },
});
post("flood", {
  by: U.Emeka, at: ago(1 * D + 2 * H), category: "alert", meta: { alertCategory: "flooding" }, place: ["Iwaya Road junction", 6.5112, 3.3878],
  text: "Burst water pipe at the Iwaya Road junction. The road is flooded on one side, so drive slowly and expect a short hold-up.",
  reactions: { like: 22, helpful: 34 },
  comments: [[U.Segun, "The water board is on site now."], [U.Emeka, "Update: fixed and the water is draining. Thanks everyone!", true]],
  extra: { resolvedAt: ago(1 * D), activeUntil: ago(1 * D) },
});
post("welcome", {
  by: U.Aisha, at: ago(1 * D + 6 * H), category: "general",
  text: "Welcome to the 12 new neighbours who joined this week 👋🏾 Say hi below and tell us your favourite spot in Yaba!",
  reactions: { like: 57 },
  comments: [[ME, "Hi everyone! Just moved to Montgomery Road. Favourite spot so far: the suya man by the stadium 🔥"], [U.Tunde, "Welcome Dami! That suya man is a legend."], [U.Hauwa, "Welcome! Join the Foodies group too."], [U.Kunle, "Hello hello 👋🏾"]],
});
post("coffee", {
  by: U.Chinedu, at: ago(1 * D + 9 * H), category: "recommendation",
  text: "For anyone working remotely: the café at Sabo has fast Wi-Fi, plenty of sockets and the coffee is actually good ☕ Quiet before noon.",
  photos: [CL("samples/coffee")],
  reactions: { like: 33, helpful: 18 },
  comments: [[U.Tolu, "Their generator never fails too."], [U.Femi, "Good to know, thanks!"]],
});
post("scam", {
  by: U.Segun, at: ago(2 * D + 3 * H), category: "alert", meta: { alertCategory: "scam" },
  text: "Scam warning: someone is calling residents, pretending to be from the water board and asking for a ₦5,000 \"reconnection fee\". Nobody from the association collects money by phone. Don't send anything.",
  reactions: { like: 27, helpful: 45 },
  comments: [[U.Ngozi, "They called my mum yesterday! Thanks for this."], [U.Ifeoma, "Reported the number to the police."]],
});
// Following: Somolu
post("somoluTraffic", {
  by: U.Lanre, hood: SOMOLU, at: ago(45), category: "alert", meta: { alertCategory: "traffic" }, place: ["Ikorodu Road, Fadeyi", 6.5302, 3.3702],
  text: "Heavy traffic on Ikorodu Road at Fadeyi heading inward. A trailer has broken down on the middle lane. Use Bajulaiye Road if you can.",
  reactions: { like: 19, helpful: 23 }, comments: [[U.Amaka, "Thank you! Taking the inner road."]],
});
post("somoluPrint", {
  by: U.Amaka, hood: SOMOLU, at: ago(6 * H), category: "recommendation",
  text: "Need wedding invitations or flyers? Bayo Prints on Bajulaiye Road did 300 cards for me in two days. Lovely finish and a fair price.",
  reactions: { like: 21, helpful: 11 }, comments: [[U.Gbenga, "Somolu printers never disappoint 👌🏾"]],
});

// QA Store's own reactions and poll vote
[["alertSecurity", "helpful"], ["amala", "like"], ["thanks", "like"], ["cleanup", "like"]].forEach(([k, type]) =>
  db.reactions.insertOne({ storeShot: true, uid: ME, postId: posts[k], type, createdAt: ago(20), updatedAt: ago(20) }));
crowd.forEach((uid, i) =>
  db.poll_votes.insertOne({ storeShot: true, postId: posts.meetingPoll, uid, optionId: i < 13 ? "o1" : i < 21 ? "o2" : "o3", createdAt: ago(60), updatedAt: ago(60) }));
// RSVPs
crowd.slice(0, 16).forEach((uid) => db.rsvps.insertOne({ storeShot: true, uid, postId: posts.cleanup, status: "going", remindersSent: [], createdAt: ago(90), updatedAt: ago(90) }));
db.rsvps.insertOne({ storeShot: true, uid: ME, postId: posts.cleanup, status: "going", remindersSent: [], createdAt: ago(30), updatedAt: ago(30) });
crowd.slice(5, 14).forEach((uid) => db.rsvps.insertOne({ storeShot: true, uid, postId: posts.jazz, status: "going", remindersSent: [], createdAt: ago(300), updatedAt: ago(300) }));

// ---- For Sale & Free ----
const listings = {};
[
  ["armchair", U.Chiamaka, "Armchair and coffee table", "Solid wood, cushions recently re-covered. Moving out, so it must go this week.", 60000, true, "furniture", "good", "samples/chair-and-coffee-table", 40],
  ["bike", U.Kunle, "Bicycle, good condition", "Adult bike, new tyres and brakes. Great for getting around the estate.", 45000, true, "other", "good", "samples/bike", 95],
  ["bag", U.Ngozi, "Leather laptop bag, brown", "Used twice. Real leather, fits a 15-inch laptop.", 18000, false, "fashion", "like_new", "samples/ecommerce/leather-bag-gray", 150],
  ["watch", U.Emeka, "Classic wristwatch", "Gift I never wear. Comes with the box.", 35000, true, "fashion", "like_new", "samples/ecommerce/analog-classic", 210],
  ["shoes", U.Segun, "Men's leather shoes, size 43", "Brown, worn once to a wedding.", 25000, true, "fashion", "good", "samples/ecommerce/shoes", 300],
  ["chair", U.Grace, "Free: wooden chair", "Free to a neighbour who can pick it up today.", null, false, "furniture", "fair", "samples/chair", 340],
  ["seats", U.Tolu, "Car seat covers, full set", "Fits most saloon cars. Black with grey stitching.", 15000, true, "vehicles", "new", "samples/ecommerce/car-interior-design", 480],
  ["mugs", ME, "Set of 6 coffee mugs", "Ceramic, never used. Duplicate wedding gift 😅", 6000, false, "home_appliances", "new", "samples/cup-on-a-table", 600],
  ["handbag2", U.Zainab, "Tan shoulder bag", "Good condition, a few marks on the strap.", 9000, true, "fashion", "good", "samples/ecommerce/accessories-bag", 800],
].forEach(([key, seller, title, description, priceNaira, negotiable, category, condition, photo, minutes]) => {
  const _id = new ObjectId();
  db.listings.insertOne({ _id, storeShot: true, sellerUid: seller, neighborhoodId: YABA, title, description, priceNaira, negotiable, category, condition, photos: [CL(photo)], status: key === "shoes" ? "sold" : "available", removedAt: null, deletedAt: null, createdAt: ago(minutes), updatedAt: ago(minutes) });
  listings[key] = { id: _id.toHexString(), title, priceNaira, photo: CL(photo) };
});

// ---- messages ----
function chat({ kind = "direct", title, with: others, context, request, msgs, unread = 0 }) {
  const _id = new ObjectId();
  const id = _id.toHexString();
  const all = [ME, ...others];
  let last = null;
  msgs.forEach(([who, body, minutes]) => {
    const t = ago(minutes);
    db.messages.insertOne({ storeShot: true, conversationId: id, senderUid: who, body, createdAt: t });
    last = { body, senderUid: who, createdAt: t };
  });
  db.conversations.insertOne({
    _id, storeShot: true, kind, ...(title && { title, admins: [others[0]] }),
    threadKey: kind === "group" ? `group:${id}` : [...all].sort().join(":") + ":" + (context ? context.id : "direct"),
    participantUids: all,
    members: all.map((uid) => ({ uid, unread: uid === ME ? unread : 0, archivedAt: null, lastReadAt: uid === ME && unread ? ago(msgs[msgs.length - unread - 1]?.[2] ?? 9999) : last.createdAt, ...(uid === ME && request && { requestedAt: ago(msgs[0][2]) }) })),
    ...(context && { context: { type: "listing", ...context } }),
    startedBy: request ? others[0] : (context ? ME : others[0]), removedAt: null, lastMessage: last,
    createdAt: ago(msgs[0][2]), updatedAt: last.createdAt,
  });
  return id;
}
const armchairChat = chat({
  with: [U.Chiamaka], context: listings.armchair, unread: 2,
  msgs: [[ME, "Hi Chiamaka, is the armchair and coffee table still available?", 35], [U.Chiamaka, "Hi Dami! Yes, it's still available 😊", 31], [ME, "Would you take ₦50,000?", 30], [U.Chiamaka, "Let's do ₦55,000 and it's yours.", 12], [U.Chiamaka, "You can come and see it this evening after 6.", 11]],
});
chat({
  kind: "group", title: "Montgomery Road neighbours 🏠", with: [U.Tunde, U.Hauwa, U.Kunle, U.Grace, U.Ibrahim], unread: 3,
  msgs: [[U.Hauwa, "Good evening neighbours 🌙", 190], [U.Tunde, "Has anyone's water come back on?", 70], [U.Grace, "Ours came back 10 minutes ago", 64], [ME, "Same here, thanks!", 60], [U.Kunle, "Reminder: gate levy is due Friday 🙏🏾", 18], [U.Ibrahim, "Paid. Also, please lock the side gate at night.", 9], [U.Hauwa, "Will do 👍🏾", 6]],
});
chat({ with: [U.Tunde], msgs: [[U.Tunde, "Did Mr Segun come to fix the inverter?", 150], [ME, "Yes! Sorted in 30 minutes. Thanks so much for the number 🙌🏾", 140], [U.Tunde, "Anytime, neighbour.", 138]] });
chat({ with: [U.Aisha], msgs: [[U.Aisha, "Thanks for signing up for the clean-up! Could you help at the gloves table?", 400], [ME, "Of course, happy to help.", 390], [U.Aisha, "You're a star ⭐", 385]] });
chat({ with: [U.Kelechi], request: true, unread: 1, msgs: [[U.Kelechi, "Hi Dami, I saw your post about the electrician. I run a small solar business in Yaba if you ever want a quote ☀️", 95]] });

// ---- groups ----
function group({ name, description, category, privacy = "open", cover, memberCount, by, members, posts: gposts = [], joined }) {
  const _id = new ObjectId();
  const id = _id.toHexString();
  db.groups.insertOne({ _id, storeShot: true, name, nameKey: name.toLowerCase(), description, privacy, category, boundary: "neighbourhood", coverPhoto: cover, neighborhoodId: YABA, city: "Lagos", createdBy: by, official: false, memberCount, inviteToken: `store${Math.random().toString(36).slice(2, 12)}`, archivedAt: null, createdAt: ago(60 * D), updatedAt: ago(60 * D) });
  [by, ...members.filter((uid) => uid !== by)].forEach((uid, i) => db.group_members.insertOne({ storeShot: true, groupId: id, uid, role: i === 0 ? "admin" : "member", joinedAt: ago((50 - i) * D) }));
  if (joined) db.group_members.insertOne({ storeShot: true, groupId: id, uid: ME, role: "member", joinedAt: ago(3 * D) });
  gposts.forEach(([who, content, minutes]) => db.group_posts.insertOne({ storeShot: true, groupId: id, authorUid: who, content, createdAt: ago(minutes), updatedAt: ago(minutes) }));
  return id;
}
group({ name: "Yaba Safety Watch 🛡️", description: "Neighbours keeping Yaba safe: alerts, lighting, gate rotas and tips.", category: "safety", cover: WEB("trust-neighbors.webp"), memberCount: 186, by: U.Ibrahim, members: pick(14), joined: true,
  posts: [[U.Ibrahim, "Night patrol rota for next week is pinned. Thanks to all the volunteers 🙏🏾", 300], [U.Segun, "New solar street lights went up on Montgomery Road today!", 1500]] });
group({ name: "Yaba Foodies 🍲", description: "Best bukas, suya spots and recipes in the area.", category: "hobbies", cover: CL("samples/food/spices"), memberCount: 129, by: U.Funke, members: pick(12, [U.Funke]), joined: true,
  posts: [[U.Funke, "Weekend challenge: show us your Sunday rice 📸", 200]] });
const parentsGroup = group({ name: "Yaba Mums & Dads", description: "School runs, playdates, tutors and hand-me-downs.", category: "parents", privacy: "private", cover: CL("samples/balloons"), memberCount: 74, by: U.Hauwa, members: pick(8, [U.Hauwa]) });
group({ name: "Yaba Tech & Startups", description: "Builders, freelancers and founders around Yaba. Meetups every month.", category: "business", cover: CL("samples/cup-on-a-table"), memberCount: 241, by: U.Chinedu, members: pick(15, [U.Chinedu]), joined: true,
  posts: [[U.Chinedu, "Monthly meetup is on the 20th at the Hub. Lightning talks welcome ⚡", 500]] });
group({ name: "Montgomery Road Residents", description: "Our street: gate levy, security rota, power updates and the odd street party.", category: "estate", privacy: "private", cover: WEB("hero-aerial.webp"), memberCount: 58, by: U.Kunle, members: pick(10, [U.Kunle]), joined: true,
  posts: [[U.Kunle, "Gate levy for November is due on Friday. Thank you to everyone who has paid 🙏🏾", 30]] });
group({ name: "Yaba Morning Runners 🏃🏾", description: "5km around Yaba every Saturday at 6am. All paces welcome.", category: "hobbies", cover: WEB("about-aerial.webp"), memberCount: 63, by: U.Femi, members: pick(9, [U.Femi]), joined: true });
// Older test groups in Yaba are hidden for the shots (undo: storeShotHidden).
db.groups.updateMany({ neighborhoodId: YABA, storeShot: { $ne: true }, archivedAt: null }, { $set: { archivedAt: new Date(), storeShotHidden: true } });

// ---- notifications for the signed-in account ----
[
  ["alert", U.Ibrahim, "Urgent security alert in Yaba", "Two men on a red okada are snatching phones around the Sabo end of Herbert Macaulay Way…", `/p/${posts.alertSecurity}`, 21, null],
  ["message", U.Chiamaka, "Chiamaka Obi sent you a message", "You can come and see it this evening after 6.", `/inbox/${armchairChat}`, 11, null],
  ["comment", U.Tunde, "Tunde Bakare and 3 others commented on your post", "Call Mr Segun Electrical on Montgomery Road…", `/p/${posts.electrician}`, 150, null],
  ["event", null, "Yaba Clean-Up Saturday is in 2 days", "Tejuosho Market main gate, Yaba", `/p/${posts.cleanup}`, 240, ago(200)],
  ["reaction", U.Ngozi, "Ngozi Okafor and 12 others reacted to your comment", null, `/p/${posts.welcome}`, 600, ago(500)],
  ["group", U.Hauwa, "Hauwa Bello invited you to join Yaba Mums & Dads", "School runs, playdates, tutors and hand-me-downs.", `/g/${parentsGroup}`, 900, ago(800)],
].forEach(([type, actorUid, title, body, href, minutes, readAt]) =>
  db.notifications.insertOne({ storeShot: true, uid: ME, type, ...(actorUid && { actorUid }), title, ...(body && { body }), href, readAt, createdAt: ago(minutes) }));

printjson({
  users: db.users.countDocuments({ storeShot: true }), posts: db.posts.countDocuments({ storeShot: true }), comments: db.comments.countDocuments({ storeShot: true }),
  listings: db.listings.countDocuments({ storeShot: true }), conversations: db.conversations.countDocuments({ storeShot: true }), messages: db.messages.countDocuments({ storeShot: true }),
  groups: db.groups.countDocuments({ storeShot: true }), notifications: db.notifications.countDocuments({ storeShot: true }),
});
