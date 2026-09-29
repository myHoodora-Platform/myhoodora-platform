/**
 * Server-side port of apps/web/src/lib/api/post-meta.ts. Posts written by
 * the current web client carry metadata in a `<!--mh:{…}-->` prefix on
 * `content`; this turns it into first-class fields (and back, so older
 * clients that decode `content` keep working during the migration).
 */
export const POST_CATEGORIES = ["general", "recommendation", "for_sale", "alert", "event", "lost_found", "thanks", "poll"] as const;
export type PostCategory = (typeof POST_CATEGORIES)[number];
export const POST_VISIBILITIES = ["neighbourhood", "nearby", "anyone"] as const;
export type PostVisibility = (typeof POST_VISIBILITIES)[number];
export type PostType = "text" | "image" | "event" | "alert";

export interface PostMeta {
  category: PostCategory;
  alertCategory?: string;
  urgent?: boolean;
  eventDate?: string;
  eventLocation?: string;
  visibility?: PostVisibility;
  thankedName?: string;
  priceNaira?: number | null;
  poll?: { options: { id: string; text: string }[]; closesAt: string };
}

const PREFIX = "<!--mh:";
const LEGACY_EVENT_PREFIX = "<!--event:";
const SUFFIX = "-->";

export function defaultCategory(type: PostType): PostCategory {
  return type === "alert" ? "alert" : type === "event" ? "event" : "general";
}

export function postTypeFor(category: PostCategory, hasMedia: boolean): PostType {
  if (category === "alert") return "alert";
  if (category === "event") return "event";
  return hasMedia ? "image" : "text";
}

export function encodePostContent(message: string, meta: PostMeta): string {
  const compact = Object.fromEntries(Object.entries(meta).filter(([, v]) => v !== undefined && v !== ""));
  if (Object.keys(compact).length === 1 && meta.category === "general") return message;
  return `${PREFIX}${JSON.stringify(compact)}${SUFFIX}\n${message}`;
}

export function decodePostContent(content: string, type: PostType): { message: string; meta: PostMeta } {
  const fallback = { message: content, meta: { category: defaultCategory(type) } };
  const prefix = content.startsWith(PREFIX) ? PREFIX : content.startsWith(LEGACY_EVENT_PREFIX) ? LEGACY_EVENT_PREFIX : null;
  if (!prefix) return fallback;
  const end = content.indexOf(SUFFIX);
  if (end === -1) return fallback;
  try {
    const parsed = JSON.parse(content.slice(prefix.length, end)) as Record<string, unknown>;
    const message = content.slice(end + SUFFIX.length).replace(/^\n/, "");
    if (prefix === LEGACY_EVENT_PREFIX) {
      return {
        message,
        meta: {
          category: "event",
          eventDate: typeof parsed.date === "string" ? parsed.date : undefined,
          eventLocation: typeof parsed.location === "string" ? parsed.location : undefined,
        },
      };
    }
    const category = POST_CATEGORIES.includes(parsed.category as PostCategory) ? (parsed.category as PostCategory) : defaultCategory(type);
    return { message, meta: { ...(parsed as Partial<PostMeta>), category } };
  } catch {
    return fallback;
  }
}
