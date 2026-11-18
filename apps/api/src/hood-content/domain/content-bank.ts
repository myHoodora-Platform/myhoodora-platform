/**
 * The Hood content bank (docs/product/hood-content-bank.md): ready-made posts for the Hood Team.
 * Pure functions, no Nest: parsing the markdown file, filling in a Hood's details, and the checks
 * that keep an unfinished item ("[FILL: …]") from ever being posted.
 */

export const CONTENT_TAGS = ["welcome", "starter", "info", "daily", "festive"] as const;
export type ContentTag = (typeof CONTENT_TAGS)[number];

/** The post categories the Hood Team may use (never alerts: those come from neighbours). */
export const TEAM_CATEGORIES = ["general", "recommendation", "for_sale", "event", "lost_found", "poll"] as const;
export type TeamCategory = (typeof TEAM_CATEGORIES)[number];

export interface ParsedItem {
  code: string;
  tag: ContentTag;
  category: TeamCategory;
  body: string;
  /** Poll options (2–4) for category "poll". */
  pollOptions?: string[];
  /** How long a poll stays open, in days (1–7). */
  pollDays?: number;
  /** Pin to the top of the feed for this many days. */
  pinDays?: number;
}

export interface ParseResult {
  items: ParsedItem[];
  /** Headings that looked like items but couldn't be read, with why. */
  problems: { line: number; heading: string; problem: string }[];
}

const HEADING = /^###\s+([A-Z]{1,3}\d{2,3})\s+·\s+(.+)$/;
const MAX_BODY = 2000;

/**
 * Reads the bank's markdown. An item is a `### CODE · tag · category[ · pin Nd][ · poll Nd]` heading,
 * its body lines, and (for polls) a `Poll: A | B | C` line. Everything else (other headings, notes,
 * code blocks) is ignored, so the file stays readable for people.
 */
export function parseContentBank(markdown: string): ParseResult {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const items: ParsedItem[] = [];
  const problems: ParseResult["problems"] = [];
  let inFence = false;
  let current: { line: number; heading: string; code: string; parts: string[]; body: string[]; poll?: string[] } | null = null;

  const finish = () => {
    if (!current) return;
    const result = buildItem(current.code, current.parts, current.body, current.poll);
    if ("problem" in result) problems.push({ line: current.line, heading: current.heading, problem: result.problem });
    else if (items.some((i) => i.code === result.code)) problems.push({ line: current.line, heading: current.heading, problem: `${result.code} appears twice.` });
    else items.push(result);
    current = null;
  };

  lines.forEach((raw, index) => {
    const line = raw.trimEnd();
    if (line.trimStart().startsWith("```")) {
      inFence = !inFence;
      return;
    }
    if (inFence) return;
    const heading = HEADING.exec(line);
    if (heading) {
      finish();
      current = { line: index + 1, heading: line, code: heading[1]!, parts: heading[2]!.split("·").map((p) => p.trim()), body: [] };
      return;
    }
    if (/^#{1,6}\s/.test(line) || /^---+$/.test(line.trim())) {
      finish();
      return;
    }
    if (!current) return;
    const poll = /^Poll:\s*(.+)$/.exec(line.trim());
    if (poll) current.poll = poll[1]!.split("|").map((o) => o.trim()).filter(Boolean);
    else current.body.push(line);
  });
  finish();
  return { items, problems };
}

function buildItem(code: string, parts: string[], bodyLines: string[], poll?: string[]): ParsedItem | { problem: string } {
  const [tag, category, ...flags] = parts;
  if (!tag || !(CONTENT_TAGS as readonly string[]).includes(tag)) return { problem: `Unknown tag "${tag ?? ""}".` };
  if (!category || !(TEAM_CATEGORIES as readonly string[]).includes(category)) return { problem: `Category "${category ?? ""}" can't be used by the Hood Team.` };
  const body = bodyLines.join("\n").trim();
  if (!body) return { problem: "No text." };
  if (body.length > MAX_BODY) return { problem: `Longer than ${MAX_BODY} characters.` };

  const item: ParsedItem = { code, tag: tag as ContentTag, category: category as TeamCategory, body };
  for (const flag of flags) {
    const m = /^(pin|poll)\s+(\d{1,2})d$/.exec(flag);
    if (!m) return { problem: `Unknown option "${flag}".` };
    const days = Number(m[2]);
    if (m[1] === "pin") {
      if (days < 1 || days > 30) return { problem: "Pins last 1 to 30 days." };
      item.pinDays = days;
    } else {
      if (days < 1 || days > 7) return { problem: "Polls run 1 to 7 days." };
      item.pollDays = days;
    }
  }
  if (category === "poll") {
    const problem = pollProblem(poll);
    if (problem) return { problem };
    item.pollOptions = poll;
    item.pollDays ??= 5;
  } else if (poll) {
    return { problem: "Has poll options but isn't a poll." };
  }
  return item;
}

/** Why a set of poll options can't be used, or null. Same rules as PostsService (2–4, all different). */
export function pollProblem(options: string[] | undefined): string | null {
  if (!options || options.length < 2 || options.length > 4) return "Polls need 2 to 4 options.";
  if (options.some((o) => !o.trim() || o.trim().length > 60)) return "Each poll option needs 1 to 60 characters.";
  if (new Set(options.map((o) => o.trim().toLowerCase())).size !== options.length) return "Poll options must be different.";
  return null;
}

export interface HoodDetails {
  name: string;
  city?: string;
}

/** Puts the Hood's name and city in. `{city}` falls back to "your city" when a Hood has none. */
export function fillTemplate(text: string, hood: HoodDetails): string {
  return text.replace(/\{hood\}/g, hood.name).replace(/\{city\}/g, hood.city?.trim() || "your city");
}

/** True while the text still has a "[FILL: …]" a moderator must complete, or a placeholder nothing fills. */
export function needsLocalDetails(text: string): boolean {
  return /\[FILL\b/i.test(text) || /\{(?!hood\}|city\})[a-z_]+\}/i.test(text);
}

/**
 * The text to post in one Hood: the item's version for the Hood's city when there is one (local
 * numbers, local companies), otherwise the general text. Null when what's left still needs local
 * details: those items are never posted automatically.
 */
export function textForHood(item: { body: string; cityVariants?: { city: string; body: string }[] }, hood: HoodDetails): string | null {
  const local = item.cityVariants?.find((v) => v.city.trim().toLowerCase() === (hood.city ?? "").trim().toLowerCase());
  const text = fillTemplate(local?.body ?? item.body, hood);
  return needsLocalDetails(text) ? null : text;
}
