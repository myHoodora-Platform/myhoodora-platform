import type { PostCategory, PostMeta, PostType } from "./types";

/**
 * The Post schema has no category/alert/event/visibility fields yet, so they
 * are encoded into the one `content` string behind a machine-parseable
 * prefix. This is real, round-tripping data the backend can migrate into
 * proper fields (see docs/api-contract.md → "Post meta migration").
 *
 *   <!--mh:{"category":"alert","alertCategory":"power"}-->
 *   Light has been out on Admiralty Way since 6am…
 *
 * Posts written before this format used `<!--event:{date,location}-->`;
 * those still decode.
 */
const PREFIX = "<!--mh:";
const LEGACY_EVENT_PREFIX = "<!--event:";
const SUFFIX = "-->";

/** PostType the backend stores for each composer category. */
export function postTypeFor(meta: PostMeta, hasMedia: boolean): PostType {
  if (meta.category === "alert") return "alert";
  if (meta.category === "event") return "event";
  return hasMedia ? "image" : "text";
}

function defaultCategory(type: PostType): PostCategory {
  if (type === "alert") return "alert";
  if (type === "event") return "event";
  return "general";
}

export function encodePostContent(message: string, meta: PostMeta): string {
  // Drop empty values so the prefix stays small.
  const compact = Object.fromEntries(
    Object.entries(meta).filter(([, v]) => v !== undefined && v !== ""),
  );
  const isPlainGeneral = Object.keys(compact).length === 1 && meta.category === "general";
  if (isPlainGeneral) return message;
  return `${PREFIX}${JSON.stringify(compact)}${SUFFIX}\n${message}`;
}

export function decodePostContent(
  content: string,
  type: PostType,
): { message: string; meta: PostMeta } {
  const fallback = { message: content, meta: { category: defaultCategory(type) } };
  const prefix = content.startsWith(PREFIX)
    ? PREFIX
    : content.startsWith(LEGACY_EVENT_PREFIX)
      ? LEGACY_EVENT_PREFIX
      : null;
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
    return {
      message,
      meta: { ...(parsed as Partial<PostMeta>), category: (parsed.category as PostCategory) ?? defaultCategory(type) },
    };
  } catch {
    return fallback;
  }
}
