import { DEFAULT_RULES, gapAfter, initialState, pickAd, placeAds, type Candidate, type Placed } from "./placement";

const posts = (from: number, n: number) => Array.from({ length: n }, (_, i) => `p${from + i}`);
const ad = (id: string, format = "image", priority = 5, remainingToday = 3): Candidate => ({ id, format, priority, remainingToday });
const shape = (items: Placed<string>[]) => items.map((i) => (i.type === "post" ? "P" : "A")).join("");

describe("placeAds", () => {
  const rules = DEFAULT_RULES;
  const opts = { session: "s1", rules, more: true };

  it("puts the first ad after the third post, then one every 6 to 8 posts, never two in a row", () => {
    const { items } = placeAds(posts(0, 30), [ad("a"), ad("b", "video")], initialState(rules), opts);
    const s = shape(items);
    expect(s.startsWith("PPPA")).toBe(true);
    expect(s).not.toContain("AA");
    const gaps = s.split("A").slice(1, -1).map((g) => g.length);
    for (const g of gaps) expect(g).toBeGreaterThanOrEqual(rules.minGap);
    for (const g of gaps) expect(g).toBeLessThanOrEqual(rules.maxGap);
  });

  it("continues across pages exactly as one long feed would (no shifted or repeated slots)", () => {
    const candidates = [ad("a"), ad("b", "video"), ad("c", "carousel")];
    const whole = placeAds(posts(0, 30), candidates, initialState(rules), opts).items;
    const first = placeAds(posts(0, 10), candidates, initialState(rules), opts);
    const second = placeAds(posts(10, 10), candidates, first.state, opts);
    const third = placeAds(posts(20, 10), candidates, second.state, opts);
    expect([...first.items, ...second.items, ...third.items]).toEqual(whole);
    const slots = whole.filter((i) => i.type === "ad").map((i) => (i as { slotId: string }).slotId);
    expect(new Set(slots).size).toBe(slots.length);
  });

  it("asking for the same page again gives the same ads", () => {
    const candidates = [ad("a", "image", 1), ad("b", "video", 9), ad("c", "carousel", 4)];
    const once = placeAds(posts(0, 20), candidates, initialState(rules), opts);
    const again = placeAds(posts(0, 20), candidates, initialState(rules), opts);
    expect(again).toEqual(once);
  });

  it("no ads on a page with too few posts, nor when there are none to show", () => {
    expect(shape(placeAds(posts(0, 2), [ad("a")], initialState(rules), opts).items)).toBe("PP");
    expect(shape(placeAds(posts(0, 20), [], initialState(rules), opts).items)).not.toContain("A");
  });

  it("never ends the feed on an ad", () => {
    expect(shape(placeAds(posts(0, 3), [ad("a")], initialState(rules), { ...opts, more: false }).items)).toBe("PPP");
    // With more to come, the slot is kept: the next page starts with a post.
    expect(shape(placeAds(posts(0, 3), [ad("a")], initialState(rules), opts).items)).toBe("PPPA");
  });

  it("stops showing an ad once its daily cap is used, counting this session's placements", () => {
    const { items } = placeAds(posts(0, 40), [ad("a", "image", 5, 2)], initialState(rules), opts);
    expect(items.filter((i) => i.type === "ad")).toHaveLength(2);
    const later = placeAds(posts(0, 40), [ad("a", "image", 5, 0)], initialState(rules), opts);
    expect(later.items.some((i) => i.type === "ad")).toBe(false);
  });
});

describe("pickAd", () => {
  it("avoids the previous format when another is available", () => {
    const state = { ...initialState(DEFAULT_RULES), lastFormat: "video" };
    for (let seed = 0; seed < 50; seed++) expect(pickAd([ad("v", "video", 10), ad("i", "image", 1)], state, seed)?.id).toBe("i");
    // Only videos left: a video it is.
    expect(pickAd([ad("v", "video")], state, 3)?.id).toBe("v");
  });

  it("favours higher priority roughly in proportion", () => {
    const state = initialState(DEFAULT_RULES);
    let heavy = 0;
    for (let seed = 0; seed < 1000; seed++) if (pickAd([ad("x", "image", 9), ad("y", "image", 1)], state, seed)?.id === "x") heavy++;
    expect(heavy).toBe(900);
  });
});

describe("gapAfter", () => {
  it("stays within the configured range", () => {
    for (let n = 0; n < 200; n++) {
      const g = gapAfter("session", n, DEFAULT_RULES);
      expect(g).toBeGreaterThanOrEqual(6);
      expect(g).toBeLessThanOrEqual(8);
    }
  });
});
