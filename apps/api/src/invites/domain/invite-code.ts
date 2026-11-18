/**
 * Personal invite codes (docs/product/hood-activation-plan.md, WP-E). Short enough to read out or
 * print on a poster at the estate gate: the first three letters of the name, then a few characters
 * nobody misreads (no 0/O, 1/I/L).
 */
export const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const CODE = /^[A-Z0-9]{4,10}$/;

/** How the invite reached them: the path it came by (plan WP-E table). */
export const INVITE_VIAS = ["link", "post", "badge", "group", "qr", "code", "asked"] as const;
export type InviteVia = (typeof INVITE_VIAS)[number];

/** When the launch challenge started: "Who invited you?" is asked of everyone who joined since. */
export const CHALLENGE_STARTED_AT = new Date("2026-11-16T23:00:00.000Z"); // 17 Nov 2026, 00:00 WAT
/** A newcomer can say who invited them for this long after joining. */
export const CLAIM_WINDOW_DAYS = 30;

/** "Adaeze Okafor" + 2 random → "ADA7K". Letters only from the name; "N" pads short or non-Latin names. */
export function makeInviteCode(name: string | undefined | null, randomChars: number, random: () => number = Math.random): string {
  const letters = (name ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .replace(/[OIL]/g, (c) => ({ O: "Q", I: "J", L: "K" })[c]!)
    .slice(0, 3)
    .padEnd(3, "N");
  let tail = "";
  for (let i = 0; i < randomChars; i++) tail += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)];
  return letters + tail;
}

/** What someone typed or a link carried → the stored form, or null if it can't be a code. */
export function normaliseCode(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const c = input.trim().toUpperCase().replace(/[\s-]/g, "");
  return CODE.test(c) ? c : null;
}

/** Whether someone who joined at `joinedAt` may still name who invited them. */
export function canStillClaim(joinedAt: Date | undefined, now = new Date()): boolean {
  if (!joinedAt) return true;
  return joinedAt >= CHALLENGE_STARTED_AT && now.getTime() - joinedAt.getTime() <= CLAIM_WINDOW_DAYS * 86_400_000;
}

/** "Adaeze Okafor" → "Adaeze O." (what an inviter sees of the people who joined with their code). */
export function shortName(name: string | undefined | null): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "A neighbour";
  const last = parts.length > 1 ? ` ${parts[parts.length - 1]![0]!.toUpperCase()}.` : "";
  return parts[0] + last;
}

/** Only the first name: what the public invite page shows of the inviter. */
export function firstName(name: string | undefined | null): string {
  return (name ?? "").trim().split(/\s+/)[0] || "A neighbour";
}
