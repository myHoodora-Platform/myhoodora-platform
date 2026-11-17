import AsyncStorage from "@react-native-async-storage/async-storage";
import { INVITE_REF_KEEP_DAYS, normaliseInviteCode, type InviteVia } from "@myhoodora/api-contract/invites";

/**
 * The invite code someone arrived with (a myhoodora://i/<code> link, typed at sign-up), kept on the
 * phone until it has been claimed after sign-in (useClaimSavedInvite). The first code wins for 30
 * days; one typed at sign-up replaces it. Plus their own code, which the links they share carry (the
 * web does the same: features/invites/invite-ref.ts there).
 */
const REF_KEY = "invite.ref";
const MINE_KEY = "invite.mine";
const KEEP_MS = INVITE_REF_KEEP_DAYS * 24 * 60 * 60 * 1000;

export interface SavedInvite {
  code: string;
  via: InviteVia;
  at: number;
}

/** Read at share time, which can't wait for storage. Loaded at start-up and whenever it changes. */
let mine: string | null = null;

export async function rememberInviteRef(raw: unknown, via: InviteVia, opts: { replace?: boolean; now?: number } = {}): Promise<void> {
  const code = normaliseInviteCode(raw);
  if (!code) return;
  const now = opts.now ?? Date.now();
  if (!opts.replace && (await readSavedInvite(now))) return;
  await AsyncStorage.setItem(REF_KEY, JSON.stringify({ code, via, at: now } satisfies SavedInvite)).catch(() => undefined);
}

export async function readSavedInvite(now = Date.now()): Promise<SavedInvite | null> {
  try {
    const v = JSON.parse((await AsyncStorage.getItem(REF_KEY)) ?? "null") as Partial<SavedInvite> | null;
    if (!v || typeof v.code !== "string" || typeof v.at !== "number" || now - v.at > KEEP_MS) return null;
    return { code: v.code, via: (v.via as InviteVia | undefined) ?? "link", at: v.at };
  } catch {
    return null;
  }
}

export async function clearSavedInvite(): Promise<void> {
  await AsyncStorage.removeItem(REF_KEY).catch(() => undefined);
}

export function myInviteCode(): string | null {
  return mine;
}

export async function loadMyInviteCode(): Promise<void> {
  mine = normaliseInviteCode(await AsyncStorage.getItem(MINE_KEY).catch(() => null));
}

export async function rememberMyInviteCode(code: string | null): Promise<void> {
  mine = normaliseInviteCode(code);
  await (mine ? AsyncStorage.setItem(MINE_KEY, mine) : AsyncStorage.removeItem(MINE_KEY)).catch(() => undefined);
}
