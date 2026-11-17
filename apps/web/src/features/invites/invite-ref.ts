import { INVITE_REF_KEEP_DAYS, normaliseInviteCode, type InviteVia } from "@myhoodora/api-contract/invites";

/**
 * The invite code someone arrived with (a shared post, a personal link, a QR poster, typed at sign-up),
 * kept in this browser until they've signed up and it has been claimed (InviteBootstrap). The first
 * code wins for 30 days; typing one in at sign-up is a deliberate choice, so that replaces it.
 * Also: their own code, to add to the links they share.
 */
const REF_KEY = "mh-invite-ref";
const MINE_KEY = "mh-my-invite-code";
const KEEP_MS = INVITE_REF_KEEP_DAYS * 24 * 60 * 60 * 1000;

export interface SavedInvite {
  code: string;
  via: InviteVia;
  at: number;
}

function store(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null; // Private mode or blocked storage: nothing to remember, nothing breaks.
  }
}

function read<T>(key: string): T | null {
  try {
    const raw = store()?.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

/** `replace`: a code typed in at sign-up replaces one a link brought. */
export function rememberInviteRef(raw: unknown, via: InviteVia, opts: { replace?: boolean; now?: number } = {}): void {
  const code = normaliseInviteCode(raw);
  const s = store();
  if (!code || !s) return;
  const now = opts.now ?? Date.now();
  const prev = readSavedInvite(now);
  if (prev && !opts.replace) return;
  try {
    s.setItem(REF_KEY, JSON.stringify({ code, via, at: now } satisfies SavedInvite));
  } catch {
    // Storage full or blocked.
  }
}

export function readSavedInvite(now = Date.now()): SavedInvite | null {
  const v = read<Partial<SavedInvite>>(REF_KEY);
  if (!v || typeof v.code !== "string" || typeof v.at !== "number" || now - v.at > KEEP_MS) return null;
  return { code: v.code, via: (v.via as InviteVia | undefined) ?? "post", at: v.at };
}

export function clearSavedInvite(): void {
  try {
    store()?.removeItem(REF_KEY);
  } catch {
    // ignore
  }
}

/** Their own code, once known: shared links carry it. */
export function myInviteCode(): string | null {
  try {
    return normaliseInviteCode(store()?.getItem(MINE_KEY));
  } catch {
    return null;
  }
}

export function rememberMyInviteCode(code: string): void {
  try {
    store()?.setItem(MINE_KEY, code);
  } catch {
    // ignore
  }
}

export function forgetMyInviteCode(): void {
  try {
    store()?.removeItem(MINE_KEY);
  } catch {
    // ignore
  }
}
