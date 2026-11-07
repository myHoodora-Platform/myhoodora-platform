/* global db, ObjectId, printjson, REVIEWER_EMAIL -- mongosh shell globals; this file runs in mongosh, not the app */
// Demo content for Google Play's reviewer (docs/mobile/play-store-release.md, section 4 "App access").
//
// Three small demo Hoods ("Agege (Demo)", "Ikorodu (Demo)", "Yaba (Demo)") placed 35 km out at sea,
// south of Lagos, so no real address can ever be matched into them, and they are never "nearby" a real
// Hood (5 km). Search is per Hood, so real members never see the demo neighbours or their posts.
// Everything carries reviewDemo: true and can be removed in one sweep (see the undo command in
// docs/mobile/store-listing.md).
//
// Re-runnable: clears its own previous run first. REVIEWER_EMAIL (optional) is an account someone has
// already created in the app; it is placed in Agege (Demo), following Ikorodu (Demo), and gets chats
// and notifications. Run (from the repo root), against the database the API uses:
//   mongosh "<MONGODB_URI>" --quiet --eval 'var REVIEWER_EMAIL = "reviewer@example.com"; load("apps/mobile/store/src/review-seed.js")'
//
// Local facts in the posts were checked on 7 November 2026: the monthly sanitation exercise (last
// Saturday, 6:30 to 8:30 am, no movement restriction), the power shortfall blamed on gas supply, and
// Ikorodu's Fanti Carnival on 14 November. Photos: Pexels (free licence) and myhoodora.com's own.
const TAG = { reviewDemo: true };
const NOW = Date.now();
const ago = (min) => new Date(NOW - min * 60000);
const H = 60, D = 1440;
const PX = (id) => `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=1200`;
const WEB = (f) => `https://www.myhoodora.com/images/${f}`;
const email = typeof REVIEWER_EMAIL === "string" ? REVIEWER_EMAIL.trim().toLowerCase() : "";

// ---- clear the previous run ----
const reviewer = email ? db.users.findOne({ email }) : null;
if (email && !reviewer) throw new Error(`No account with the email ${email}. Create it in the app first.`);
const COLLECTIONS = ["posts", "listings", "comments", "reactions", "groups", "group_members", "group_posts", "rsvps", "conversations", "messages", "notifications", "poll_votes", "users", "neighborhoods"];
COLLECTIONS.forEach((c) => db[c].deleteMany(TAG));

// ---- the demo Hoods, at sea ----
function hood(name, lat, lng, description) {
  const _id = new ObjectId();
  db.neighborhoods.insertOne({
    _id, ...TAG, name, city: "Lagos", country: "Nigeria", description, status: "active", isActive: true,
    location: { type: "Point", coordinates: [lng, lat] }, radiusMeters: 1500, createdAt: ago(120 * D), updatedAt: ago(120 * D),
  });
  return { id: _id.toHexString(), name, lat, lng };
}
const NOTE = "A demo neighbourhood for app review. The people and posts here are examples, not a real community.";
const AGEGE = hood("Agege (Demo)", 6.1, 3.3, NOTE);
const IKORODU = hood("Ikorodu (Demo)", 6.1, 3.33, NOTE);
const YABA = hood("Yaba (Demo)", 6.125, 3.315, NOTE);
const follow = (h, days) => ({ id: h.id, name: h.name, city: "Lagos", since: ago(days * D) });

// ---- demo neighbours: example.invalid addresses, no emails ever sent, initials instead of photos ----
const NOTIFY_NONE = Object.fromEntries(["urgent_alerts", "alerts", "comments", "messages", "events", "for_sale", "groups"].map((k) => [k, { push: false, email: false }]));
const people = [
  ["Kehinde Adebayo", AGEGE, "Agege born and bred. Bread lover, obviously 🍞"], ["Halima Sanni", AGEGE, "Nurse at the general hospital, Orile Agege."],
  ["Chukwudi Okeke", AGEGE, "Electrician. Ask me about your inverter."], ["Folake Ogunbiyi", AGEGE, "Caterer. Small chops and party jollof."],
  ["Musa Abdullahi", AGEGE, "Residents' association secretary, Oko-Oba."], ["Ronke Balogun", AGEGE, "Mum of three, Dopemu."],
  ["Victor Eze", AGEGE, "I fix phones and laptops."], ["Bukola Alade", AGEGE, ""], ["Samuel Ojo", AGEGE, "Red Line commuter, Agege to Yaba."],
  ["Ifeyinwa Nwachukwu", AGEGE, "Teacher. Tutoring on weekends."],
  ["Adewale Ogunsanya", IKORODU, "Ikorodu-Oga till I die 🥁"], ["Titilayo Bankole", IKORODU, "Ferry from Ebute every weekday."],
  ["Obinna Uche", IKORODU, "Ikorodu City FC season ticket holder."], ["Mariam Lawal", IKORODU, "Tailor, Igbogbo."],
  ["Gbolahan Shonibare", IKORODU, ""], ["Esther Akpan", IKORODU, "Small business owner, Ikorodu Garage."], ["Yusuf Bello", IKORODU, "Keke rider and proud of it."],
  ["Nkechi Obi", IKORODU, "Moved here from Surulere last year."],
  ["Tobi Adeniran", YABA, "Software engineer, Herbert Macaulay Way."], ["Amina Garba", YABA, "UNILAG postgrad."], ["Femi Coker", YABA, "Tejuosho trader."],
  ["Chioma Agu", YABA, "Food blogger. Jollof judge."], ["Seun Afolabi", YABA, "Runs the Saturday 5k."], ["Hadiza Usman", YABA, ""],
];
/** Who follows which other demo Hood: everyone who comments outside their own. */
const FOLLOWS = { Kehinde: [IKORODU], Samuel: [YABA], Adewale: [AGEGE], Yusuf: [AGEGE], Tobi: [AGEGE], Chioma: [AGEGE] };
const U = {}; // first name -> uid
people.forEach(([name, h, bio], i) => {
  const uid = `review-u-${String(i + 1).padStart(2, "0")}`;
  U[name.split(" ")[0]] = uid;
  const since = ago((30 + i * 11) * D);
  // Some follow a neighbouring demo Hood, so their comments there are ones the app would allow.
  const secondaryHoods = (FOLLOWS[name.split(" ")[0]] ?? []).map((x) => follow(x, 20));
  db.users.insertOne({
    ...TAG, uid, email: `review+${i + 1}@example.invalid`, displayName: name, ...(bio && { bio }), provider: "password",
    neighborhoodId: h.id, isOnboarded: true, role: "member", verificationStatus: "verified", verifiedAt: since,
    accountStatus: "active", restrictedUntil: null, emailVerifiedAt: since, deactivatedAt: null, purgedAt: null, deactivation: null, sessionsRevokedAt: null,
    preferences: { notifications: NOTIFY_NONE, digest: "off", privacy: { profileVisibility: "neighbourhood", messaging: "neighbourhood", showNeighbourSince: true } },
    blockedUids: [], verificationAttempts: [], secondaryHoods, requestedHood: null,
    location: { lat: h.lat, lng: h.lng, address: `${h.name}, Lagos` }, createdAt: since, updatedAt: since,
  });
});
const ME = reviewer ? reviewer.uid : null;
const inAgege = Object.keys(U).slice(0, 10).map((k) => U[k]);
const inIkorodu = Object.keys(U).slice(10, 18).map((k) => U[k]);

// ---- posts ----
const posts = {};
function post(key, { by, h = AGEGE, at, category, text, meta = {}, photos = [], reactions = {}, comments = [], place, extra = {} }) {
  const header = { category, ...meta };
  // Top-level copies the API writes on create (posts.service.ts create()).
  if (category === "alert") {
    extra = { alertCategory: meta.alertCategory ?? "other", activeUntil: new Date(at.getTime() + 24 * 3600000), ...extra };
    if (place) extra = { location: { type: "Point", coordinates: [h.lng + place[2], h.lat + place[1]] }, locationLabel: place[0], ...extra };
  }
  if (meta.thankedName) extra = { thankedName: meta.thankedName, ...extra };
  if (meta.eventDate) extra = { eventDate: new Date(meta.eventDate), eventLocation: meta.eventLocation, ...extra };
  if (meta.poll) extra = { poll: { options: meta.poll.options, closesAt: new Date(meta.poll.closesAt) }, ...extra };
  const _id = new ObjectId();
  const type = category === "alert" ? "alert" : category === "event" ? "event" : photos.length ? "image" : "text";
  const live = comments.filter(([who]) => who);
  db.posts.insertOne({
    _id, ...TAG, authorUid: by, neighborhoodId: h.id, visibility: "neighbourhood", mediaUrls: photos,
    commentCount: live.length, shareCount: Math.floor(Object.values(reactions).reduce((a, b) => a + b, 0) / 6),
    editedAt: null, commentsDisabled: false, resolvedAt: null, isActive: true, removedAt: null, urgent: Boolean(meta.urgent),
    createdAt: at, updatedAt: at, category, type, message: text, content: `<!--mh:${JSON.stringify(header)}-->\n${text}`,
    reactionCounts: reactions, ...extra,
  });
  const id = _id.toHexString();
  posts[key] = id;
  let last = null;
  live.forEach(([who, body, reply], i) => {
    const cid = new ObjectId();
    const t = new Date(at.getTime() + (i + 1) * 9 * 60000);
    db.comments.insertOne({
      _id: cid, ...TAG, postId: id, authorUid: who, content: body, deletedAt: null, removedAt: null,
      ...(reply && last && { parentId: last.id, replyToUid: last.uid }),
      likeCount: (i * 3) % 7, replyCount: 0, createdAt: t, updatedAt: t,
    });
    if (reply && last) db.comments.updateOne({ _id: new ObjectId(last.id) }, { $inc: { replyCount: 1 } });
    else last = { id: cid.toHexString(), uid: who };
  });
  return id;
}

// Agege (Demo): the reviewer's home
post("power", {
  by: U.Chukwudi, at: ago(40), category: "alert", meta: { alertCategory: "power" }, place: ["Oko-Oba", 0.004, -0.003],
  text: "Power update for Oko-Oba and Dopemu: we've been getting 3 to 4 hours a day since Tuesday. The Ministry of Power says it's a gas shortage at the power stations, and they're working on restoring supply across Lagos. Keep your inverters charged and switch off heavy loads when it comes back, so the transformer doesn't trip.",
  reactions: { like: 24, helpful: 41, agree: 9 },
  comments: [
    [U.Ronke, "Thank you for explaining. I thought it was just our street."], [U.Chukwudi, "It's everywhere this week. Hold on 🙏🏾", true],
    [U.Samuel, "Same in Yaba where I work."], [U.Kehinde, "Who has a good inverter battery guy around Pen Cinema?"],
    [U.Chukwudi, "Send me a message, I'll share a number.", true],
  ],
});
post("sanitation", {
  by: U.Musa, at: ago(3 * H), category: "event",
  meta: { eventDate: "2026-11-28T05:30:00.000Z", eventLocation: "Oko-Oba junction, by the mosque" },
  text: "Monthly sanitation is on the last Saturday: 28 November, 6:30 to 8:30 am. The state says there's no movement restriction this time, but let's still clean our street together. The association will provide brooms, gloves and bags. Pap and akara for everyone after 😄",
  photos: [WEB("hero-street.webp")],
  reactions: { like: 38, agree: 16, helpful: 7 },
  comments: [[U.Halima, "I'll be there after my night shift."], [U.Bukola, "Which side are we starting from?"], [U.Musa, "From the junction, towards the school.", true], [U.Ifeyinwa, "I'll bring my students for their community service 🧹"]],
});
post("bread", {
  by: U.Kehinde, at: ago(5 * H), category: "recommendation",
  text: "If you haven't tried the akara and Agege bread at the small bakery by Pen Cinema, you're missing out. Hot bread comes out at 6 am. Get there before 7 or it's finished 😋",
  photos: [PX(37624176)],
  reactions: { like: 57, helpful: 13, agree: 20 },
  comments: [[U.Victor, "The bread is still warm when you get home. Best in Agege."], [U.Folake, "Their akara is crunchy, no oil soaking. Respect."], [U.Adewale, "Coming from Ikorodu this weekend just for this 😂"], [U.Kehinde, "You won't regret it!", true]],
});
post("redline", {
  by: U.Samuel, at: ago(8 * H), category: "general",
  text: "Tip for anyone working in Yaba or Ebute-Metta: the Red Line train from Agege station is faster than the road, especially in the evening. Buy your Cowry card the day before, the queue at the counter can be long in the morning.",
  reactions: { like: 44, helpful: 36 },
  comments: [[U.Ifeyinwa, "Life saver. I get to school in 25 minutes now."], [U.Tobi, "Can confirm from the Yaba end. It's very neat too."], [U.Bukola, "Does it run on Sundays?"]],
});
post("boli", {
  by: U.Folake, at: ago(11 * H), category: "recommendation",
  text: "Best boli and fish in Dopemu: the woman under the umbrella opposite the filling station. ₦1,500 for boli with pepper sauce, and she adds groundnut if you ask nicely 🔥",
  photos: [PX(36756598)],
  reactions: { like: 49, helpful: 18 },
  comments: [[U.Ronke, "Mama Ayo! Her pepper sauce is something else."], [U.Kehinde, "I buy there every Friday."]],
});
post("phone", {
  by: U.Bukola, at: ago(14 * H), category: "lost_found",
  text: "Lost: a black Infinix phone in a red case, somewhere between Agege train station and Capitol Road this morning. There's a photo of my daughter on the lock screen. Please message me if you find it 🙏🏾",
  reactions: { like: 21, helpful: 9 },
  comments: [[U.Victor, "I'll ask the phone repair guys at the station. They see everything."], [U.Musa, "Shared with the station security."]],
});
post("meeting", {
  by: U.Musa, at: ago(1 * D + 2 * H), category: "poll",
  meta: { poll: { options: [{ id: "o1", text: "Saturday 10 am" }, { id: "o2", text: "Sunday after service" }, { id: "o3", text: "Wednesday 7 pm" }], closesAt: "2026-11-20T18:00:00.000Z" } },
  text: "Residents' meeting for December: we need to agree the security levy and the Christmas street party. Which time works for you?",
  reactions: { like: 18 },
  comments: [[U.Halima, "Saturday please, I work Sundays."], [U.Kehinde, "Sunday is easiest for most families."]],
});
post("thanks", {
  by: U.Ronke, at: ago(1 * D + 6 * H), category: "thanks", meta: { thankedName: "Baba Sule, the keke driver at Dopemu" },
  text: "A big thank you to Baba Sule, the keke driver at Dopemu, who brought back the bag I left in his keke with my son's school fees inside. Honest people still exist ❤️",
  reactions: { like: 92, agree: 24 },
  comments: [[U.Yusuf, "Good one Baba Sule! Keke riders are not all bad 😄"], [U.Musa, "We should honour him at the residents' meeting."], [U.Ronke, "Yes please!", true]],
});
post("market", {
  by: U.Halima, at: ago(1 * D + 9 * H), category: "general",
  text: "Market check this morning: tomatoes are down to about ₦3,500 for a small basket, but pepper and onions are still high. Buy early, prices go up after 10.",
  photos: [PX(23490764)],
  reactions: { like: 39, helpful: 31 },
  comments: [[U.Folake, "Thank God for tomatoes. Stew is back on the menu 😂"], [U.Chioma, "Same story at Tejuosho."]],
});
post("scam", {
  by: U.Victor, at: ago(2 * D + 4 * H), category: "alert", meta: { alertCategory: "scam" },
  text: "Scam warning: someone is calling residents, claiming to be from the electricity company and asking for ₦10,000 to \"upgrade\" your prepaid meter. The company doesn't collect money by phone. Don't send anything, and tell your parents.",
  reactions: { like: 26, helpful: 47 },
  comments: [[U.Ifeyinwa, "They called my mum yesterday! Thank you."], [U.Chukwudi, "Real staff carry ID and never collect cash."]],
});
post("welcome", {
  by: U.Musa, at: ago(3 * D), category: "general",
  text: "Welcome to everyone who joined this week 👋🏾 Say hi below, tell us your street, and don't forget the sanitation exercise on the 28th.",
  reactions: { like: 51 },
  comments: [[U.Ifeyinwa, "Hello neighbours! Mulero Street here."], [U.Bukola, "Hi all 👋🏾"], [U.Samuel, "Welcome! Ask me anything about the train."]],
});

// Ikorodu (Demo)
post("fanti", {
  by: U.Adewale, h: IKORODU, at: ago(2 * H), category: "event",
  meta: { eventDate: "2026-11-14T09:00:00.000Z", eventLocation: "Ikorodu town, around the palace" },
  text: "Ikorodu-Oga Fanti Carnival is on Saturday 14 November 🥁 The council chairman says it'll be bigger this year, with the youths' all-white party too. Check the council's programme for exact times, and expect traffic around town from the morning.",
  photos: [PX(16114749)],
  reactions: { like: 63, agree: 12 },
  comments: [[U.Obinna, "Best day of the year in Ikorodu!"], [U.Mariam, "I'm making all-white outfits this week, message me 😉"], [U.Kehinde, "Coming from Agege for this 🙌🏾"]],
});
post("brt", {
  by: U.Titilayo, h: IKORODU, at: ago(6 * H), category: "alert", meta: { alertCategory: "traffic" }, place: ["Ikorodu Road, Agric", -0.003, 0.002],
  text: "Slow traffic on Ikorodu Road from Agric towards Mile 12 this evening. The BRT lane is moving well, so the bus is faster than a car right now.",
  photos: [PX(8608890)],
  reactions: { like: 17, helpful: 28 },
  comments: [[U.Gbolahan, "Thanks, taking the BRT."], [U.Esther, "Or the ferry from Ebute if you're going to the Island."]],
});
post("sanitationIkorodu", {
  by: U.Esther, h: IKORODU, at: ago(1 * D + 3 * H), category: "general",
  text: "The governor's wife was in Ikorodu at the start of the month asking us to keep up the monthly sanitation, and said the state will soon name the cleanest local government. Ikorodu, let's win this one 💪🏾 Next exercise: Saturday 28 November.",
  photos: [WEB("trust-neighbors.webp")],
  reactions: { like: 34, agree: 19 },
  comments: [[U.Nkechi, "Our street is ready."], [U.Yusuf, "Keke riders will help carry the bags."]],
});
post("tailor", {
  by: U.Nkechi, h: IKORODU, at: ago(2 * D), category: "recommendation",
  text: "Need an outfit for the carnival or a wedding? Mariam in Igbogbo sewed my Ankara in three days, perfect fit and fair price.",
  reactions: { like: 22, helpful: 10 },
  comments: [[U.Mariam, "Thank you so much Nkechi 🥰"]],
});

// Yaba (Demo)
post("danfo", {
  by: U.Femi, h: YABA, at: ago(4 * H), category: "general",
  text: "Danfo fares from Yaba to Oshodi went up again this week. The drivers say it's fuel. Anyone else noticed?",
  photos: [PX(5409303)],
  reactions: { like: 29, agree: 21 },
  comments: [[U.Amina, "Yes! The train is cheaper now for me."], [U.Samuel, "Red Line from Yaba to Agege, try it."]],
});
post("jollof", {
  by: U.Chioma, h: YABA, at: ago(9 * H), category: "recommendation",
  text: "Hidden gem: the buka behind the stadium does jollof with dodo for ₦2,500, and it has that party-jollof smoky taste 🔥",
  photos: [PX(17952748)],
  reactions: { like: 71, helpful: 15 },
  comments: [[U.Tobi, "I can confirm. I eat there three times a week 😂"], [U.Hadiza, "Do they open on Sundays?"], [U.Chioma, "From 12 noon.", true]],
});
post("tejuosho", {
  by: U.Femi, h: YABA, at: ago(1 * D + 5 * H), category: "general",
  text: "Tejuosho is busy today, everybody is already shopping for December. Come early if you want to find parking.",
  photos: [PX(16155217)],
  reactions: { like: 25, helpful: 14 },
  comments: [[U.Seun, "Thanks for the heads up."]],
});

// Reactions from demo neighbours on each other's posts are in reactionCounts; poll votes and RSVPs here.
inAgege.forEach((uid, i) => db.poll_votes.insertOne({ ...TAG, postId: posts.meeting, uid, optionId: i < 5 ? "o1" : i < 8 ? "o2" : "o3", createdAt: ago(20 * H), updatedAt: ago(20 * H) }));
inAgege.slice(0, 8).forEach((uid) => db.rsvps.insertOne({ ...TAG, uid, postId: posts.sanitation, status: "going", remindersSent: [], createdAt: ago(2 * H), updatedAt: ago(2 * H) }));
inIkorodu.forEach((uid) => db.rsvps.insertOne({ ...TAG, uid, postId: posts.fanti, status: "going", remindersSent: [], createdAt: ago(H), updatedAt: ago(H) }));

// ---- For Sale & Free (Agege) ----
const listings = {};
[
  ["sofa", U.Ronke, "3-seater sofa, beige", "Firm cushions, no tears. Moving to a smaller flat, so it has to go.", 180000, true, "furniture", "good", PX(7166930), 50],
  ["armchair", U.Kehinde, "Armchair, grey fabric", "Comfortable reading chair. Pick up from Oko-Oba.", 45000, true, "furniture", "good", PX(13942423), 130],
  ["generator", U.Chukwudi, "Soundproof generator, 20 kVA", "Serviced last month, low hours. Good for a small business or a compound. Can help with installation.", 4200000, true, "home_appliances", "good", PX(5693845), 260],
  ["jollof", U.Folake, "Party jollof trays", "Smoky party jollof with chicken. Order by Thursday for Saturday delivery in Agege.", 25000, false, "other", "new", PX(40262791), 400],
  ["veg", U.Halima, "Fresh peppers and vegetables", "Bell peppers, broccoli and cauliflower from the market. Small basket.", 8000, true, "other", "new", PX(33624058), 700],
  ["corn", U.Bukola, "Free: roasted corn for the sanitation crew", "I'll roast corn for everyone who comes out on the 28th. Free, just come with your broom 😄", null, false, "other", "new", PX(11572454), 900],
].forEach(([key, seller, title, description, priceNaira, negotiable, category, condition, photo, minutes]) => {
  const _id = new ObjectId();
  db.listings.insertOne({ _id, ...TAG, sellerUid: seller, neighborhoodId: AGEGE.id, title, description, priceNaira, negotiable, category, condition, photos: [photo], status: "available", removedAt: null, deletedAt: null, createdAt: ago(minutes), updatedAt: ago(minutes) });
  listings[key] = { id: _id.toHexString(), title, priceNaira, photo };
});

// ---- groups (Agege) ----
function group({ name, description, category, privacy = "open", cover, memberCount, by, members, posts: gposts = [], joined, h = AGEGE }) {
  const _id = new ObjectId();
  const id = _id.toHexString();
  db.groups.insertOne({ _id, ...TAG, name, nameKey: name.toLowerCase(), description, privacy, category, boundary: "neighbourhood", coverPhoto: cover, neighborhoodId: h.id, city: "Lagos", createdBy: by, official: false, memberCount, inviteToken: `review${Math.random().toString(36).slice(2, 12)}`, archivedAt: null, createdAt: ago(60 * D), updatedAt: ago(60 * D) });
  [by, ...members.filter((uid) => uid !== by)].forEach((uid, i) => db.group_members.insertOne({ ...TAG, groupId: id, uid, role: i === 0 ? "admin" : "member", joinedAt: ago((50 - i) * D) }));
  if (joined && ME) db.group_members.insertOne({ ...TAG, groupId: id, uid: ME, role: "member", joinedAt: ago(2 * D) });
  gposts.forEach(([who, content, minutes]) => db.group_posts.insertOne({ ...TAG, groupId: id, authorUid: who, content, createdAt: ago(minutes), updatedAt: ago(minutes) }));
  return id;
}
const safety = group({ name: "Agege Safety Watch 🛡️", description: "Alerts, street lighting, gate rotas and safety tips for Agege.", category: "safety", cover: WEB("hero-aerial.webp"), memberCount: 9, by: U.Musa, members: inAgege.slice(0, 8), joined: true,
  posts: [[U.Musa, "Night patrol rota for next week is ready. Thank you to the volunteers 🙏🏾", 300], [U.Chukwudi, "Two new solar street lights went up on Mulero Street today!", 1500]] });
group({ name: "Agege Foodies 🍲", description: "Bread, bukas, boli spots and recipes.", category: "hobbies", cover: PX(17952748), memberCount: 7, by: U.Folake, members: inAgege.slice(0, 6), joined: true,
  posts: [[U.Folake, "Weekend challenge: show us your Sunday rice 📸", 200]] });
group({ name: "Ikorodu Carnival Crew 🥁", description: "Planning our street's outing for the Fanti Carnival.", category: "hobbies", cover: PX(16114749), memberCount: 8, by: U.Adewale, members: inIkorodu, h: IKORODU });

// ---- the reviewer ----
if (ME) {
  db.users.updateOne({ uid: ME }, {
    $set: {
      neighborhoodId: AGEGE.id, isOnboarded: true, verificationStatus: "verified", verifiedAt: ago(3 * D), emailVerifiedAt: reviewer.emailVerifiedAt ?? ago(3 * D),
      requestedHood: null, location: { lat: AGEGE.lat, lng: AGEGE.lng, address: "Agege (Demo), Lagos" }, secondaryHoods: [follow(IKORODU, 2)],
      reviewDemoAccount: true,
    },
  });
  [["power", "helpful"], ["bread", "like"], ["thanks", "like"]].forEach(([k, type]) =>
    db.reactions.insertOne({ ...TAG, uid: ME, postId: posts[k], type, createdAt: ago(30), updatedAt: ago(30) }));
  db.rsvps.insertOne({ ...TAG, uid: ME, postId: posts.sanitation, status: "going", remindersSent: [], createdAt: ago(60), updatedAt: ago(60) });

  function chat({ kind = "direct", title, with: others, context, request, msgs, unread = 0 }) {
    const _id = new ObjectId();
    const id = _id.toHexString();
    const all = [ME, ...others];
    let last = null;
    msgs.forEach(([who, body, minutes]) => {
      const t = ago(minutes);
      db.messages.insertOne({ ...TAG, conversationId: id, senderUid: who, body, createdAt: t });
      last = { body, senderUid: who, createdAt: t };
    });
    db.conversations.insertOne({
      _id, ...TAG, kind, ...(title && { title, admins: [others[0]] }),
      threadKey: kind === "group" ? `group:${id}` : [...all].sort().join(":") + ":" + (context ? context.id : "direct"),
      participantUids: all,
      members: all.map((uid) => ({ uid, unread: uid === ME ? unread : 0, archivedAt: null, lastReadAt: uid === ME && unread ? ago(msgs[msgs.length - unread - 1]?.[2] ?? 9999) : last.createdAt, ...(uid === ME && request && { requestedAt: ago(msgs[0][2]) }) })),
      ...(context && { context: { type: "listing", ...context } }),
      startedBy: request ? others[0] : (context ? ME : others[0]), removedAt: null, lastMessage: last,
      createdAt: ago(msgs[0][2]), updatedAt: last.createdAt,
    });
    return id;
  }
  const sofaChat = chat({
    with: [U.Ronke], context: listings.sofa, unread: 2,
    msgs: [[ME, "Good evening, is the sofa still available?", 95], [U.Ronke, "Yes it is! 😊", 90], [ME, "Would you take ₦150,000?", 88], [U.Ronke, "Let's do ₦165,000, and my husband can help you load it.", 25], [U.Ronke, "You can come and see it tomorrow after 5.", 24]],
  });
  chat({
    kind: "group", title: "Oko-Oba Street 🏠", with: [U.Musa, U.Halima, U.Chukwudi, U.Kehinde, U.Ronke], unread: 3,
    msgs: [[U.Musa, "Good evening neighbours 🌙", 300], [U.Halima, "Has NEPA brought light on your side?", 120], [U.Chukwudi, "Not yet. Gas shortage, they said.", 115], [ME, "Same here, thanks for the update.", 110], [U.Musa, "Reminder: security levy is due Friday 🙏🏾", 40], [U.Kehinde, "Paid. Please lock the side gate at night.", 15], [U.Ronke, "Will do 👍🏾", 8]],
  });
  chat({ with: [U.Chukwudi], msgs: [[U.Chukwudi, "Here's the inverter battery guy's number I mentioned: ask for Emeka at the shop by Pen Cinema.", 180], [ME, "Thank you so much!", 170], [U.Chukwudi, "Anytime, neighbour.", 168]] });
  chat({ with: [U.Folake], request: true, unread: 1, msgs: [[U.Folake, "Hi neighbour! I saw you're going to the sanitation exercise. I'm doing party jollof trays for Christmas if you need any 🍛", 70]] });

  [
    ["alert", U.Chukwudi, "Power alert in Agege (Demo)", "We've been getting 3 to 4 hours a day since Tuesday…", `/p/${posts.power}`, 39, null],
    ["message", U.Ronke, "Ronke Balogun sent you a message", "You can come and see it tomorrow after 5.", `/inbox/${sofaChat}`, 24, null],
    ["event", null, "Monthly sanitation on 28 November", "Oko-Oba junction, by the mosque", `/p/${posts.sanitation}`, 120, null],
    ["comment", U.Victor, "Victor Eze commented on a post you reacted to", "The bread is still warm when you get home…", `/p/${posts.bread}`, 280, ago(200)],
    ["group", U.Musa, "New post in Agege Safety Watch", "Night patrol rota for next week is ready…", `/g/${safety}`, 300, ago(250)],
  ].forEach(([type, actorUid, title, body, href, minutes, readAt]) =>
    db.notifications.insertOne({ ...TAG, uid: ME, type, ...(actorUid && { actorUid }), title, ...(body && { body }), href, readAt, createdAt: ago(minutes) }));
}

printjson({
  hoods: db.neighborhoods.countDocuments(TAG), users: db.users.countDocuments(TAG), posts: db.posts.countDocuments(TAG), comments: db.comments.countDocuments(TAG),
  listings: db.listings.countDocuments(TAG), groups: db.groups.countDocuments(TAG), conversations: db.conversations.countDocuments(TAG), notifications: db.notifications.countDocuments(TAG),
  reviewer: ME ? `${email} in Agege (Demo), following Ikorodu (Demo)` : "not linked (no REVIEWER_EMAIL)",
});
