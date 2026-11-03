/**
 * Where sponsored items go in a feed page, and which ad fills each slot (docs/feed-redesign-spec.md
 * §5.3). Pure: the service supplies the posts, the candidates and what this viewer has seen, so the
 * rules are tested without a database.
 *
 * Slots are numbered per feed session, and the state that decides them travels in the page cursor,
 * so the next page continues where this one ended: no slot moves, none repeats, and asking for the
 * same page again gives the same ads.
 */

export interface PlacementRules {
  /** Organic posts before the first ad (3: the ad is at the earliest the 4th item). */
  firstAfter: number;
  /** Organic posts between ads, chosen per slot within this range. */
  minGap: number;
  maxGap: number;
  /** A page with fewer organic posts than this gets no ads. */
  minOrganic: number;
}

export const DEFAULT_RULES: PlacementRules = { firstAfter: 3, minGap: 6, maxGap: 8, minOrganic: 3 };

/** What the next page needs to carry on. Lives (encoded) in the cursor. */
export interface PlacementState {
  /** Organic posts shown so far this session. */
  seen: number;
  /** The organic count after which the next ad goes. */
  nextAt: number;
  /** Slots filled so far (for slot ids and the gap seed). */
  slots: number;
  /** The previous ad's format, to avoid two of a kind in a row. */
  lastFormat?: string;
  /** How many times each ad was placed this session (counts toward its daily cap). */
  served: Record<string, number>;
}

export function initialState(rules: PlacementRules): PlacementState {
  return { seen: 0, nextAt: rules.firstAfter, slots: 0, served: {} };
}

export interface Candidate {
  id: string;
  format: string;
  /** 1–10: how often it wins against others. */
  priority: number;
  /** How many more times this viewer may be shown it today (cap minus today's impressions). */
  remainingToday: number;
}

export type Placed<P> = { type: "post"; data: P } | { type: "ad"; adId: string; slotId: string };

/** A small deterministic hash (FNV-1a), so a slot's choices are the same every time it's asked for. */
export function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** The gap after slot `n`: within [minGap, maxGap], fixed for the session. */
export function gapAfter(session: string, n: number, rules: PlacementRules): number {
  const span = rules.maxGap - rules.minGap + 1;
  return rules.minGap + (hash(`${session}:gap:${n}`) % span);
}

/**
 * Picks one ad for a slot: weighted by priority among those still under their cap, preferring a
 * format other than the last one when there's a choice. Deterministic per slot.
 */
export function pickAd(candidates: Candidate[], state: PlacementState, seed: number): Candidate | null {
  const open = candidates.filter((c) => c.remainingToday - (state.served[c.id] ?? 0) > 0);
  if (!open.length) return null;
  const fresh = open.filter((c) => c.format !== state.lastFormat);
  const pool = fresh.length ? fresh : open;
  // Stable order first, so the same seed always lands on the same ad.
  const sorted = [...pool].sort((a, b) => (a.id < b.id ? -1 : 1));
  const total = sorted.reduce((n, c) => n + Math.max(1, c.priority), 0);
  let roll = seed % total;
  for (const c of sorted) {
    roll -= Math.max(1, c.priority);
    if (roll < 0) return c;
  }
  return sorted[sorted.length - 1]!;
}

/**
 * Lays out one page: its posts in order, with ads in the slots that fall on it. `more` says whether
 * another page follows: an ad is never the page's last item unless one does, so the feed never ends
 * on an ad. Never two ads in a row (the gap is at least one post).
 */
export function placeAds<P>(posts: P[], candidates: Candidate[], state: PlacementState, opts: { session: string; rules: PlacementRules; more: boolean }): { items: Placed<P>[]; state: PlacementState } {
  const { session, rules, more } = opts;
  const next: PlacementState = { ...state, served: { ...state.served } };
  const items: Placed<P>[] = [];
  const allowAds = posts.length >= rules.minOrganic && candidates.length > 0;
  posts.forEach((post, i) => {
    items.push({ type: "post", data: post });
    next.seen += 1;
    if (!allowAds || next.seen < next.nextAt) return;
    const last = i === posts.length - 1;
    if (last && !more) return;
    const ad = pickAd(candidates, next, hash(`${session}:slot:${next.slots}`));
    if (!ad) return;
    items.push({ type: "ad", adId: ad.id, slotId: `${session}:${next.slots}` });
    next.served[ad.id] = (next.served[ad.id] ?? 0) + 1;
    next.lastFormat = ad.format;
    next.nextAt = next.seen + gapAfter(session, next.slots, rules);
    next.slots += 1;
  });
  return { items, state: next };
}
