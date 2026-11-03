import { randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { join } from "node:path";
import { removeTemp, UPLOAD_TMP_DIR } from "./temp-files";

/**
 * Safe server-side download of a file someone linked (POST /media/import).
 * Guards against SSRF: https only, every redirect hop re-checked, hosts that
 * resolve to private/loopback/link-local addresses refused, size and time
 * capped while streaming to a temp file (never held in memory). The caller
 * owns the file and removes it. Vendor-neutral: it goes through
 * StorageService like any upload.
 */

export class RemoteFileError extends Error {}

export interface RemoteFile {
  /** Temp file on disk; remove with removeTemp() when done. */
  path: string;
  mimetype: string;
  size: number;
}

interface FetchRemoteOptions {
  maxBytes: number;
  timeoutMs?: number;
  maxRedirects?: number;
  fetchImpl?: typeof fetch;
  resolveHost?: (hostname: string) => Promise<string[]>;
}

const EXT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  heic: "image/heic",
  mp4: "video/mp4",
  m4v: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
};

/** True for addresses a server must never be tricked into calling. */
export function isPrivateAddress(ip: string): boolean {
  const v4 = ip.startsWith("::ffff:") ? ip.slice(7) : ip;
  if (isIP(v4) === 4) {
    const [a, b] = v4.split(".").map(Number) as [number, number];
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    );
  }
  const v6 = ip.toLowerCase();
  return v6 === "::" || v6 === "::1" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe80");
}

const defaultResolve = async (hostname: string) => (await lookup(hostname, { all: true })).map((a) => a.address);

async function assertPublic(url: URL, resolveHost: (h: string) => Promise<string[]>) {
  if (url.protocol !== "https:") throw new RemoteFileError("Links must start with https://.");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(host) ? [host] : await resolveHost(host).catch(() => [] as string[]);
  if (!addresses.length) throw new RemoteFileError("We couldn't reach that link.");
  if (addresses.some(isPrivateAddress)) throw new RemoteFileError("That link can't be used.");
}

export async function fetchRemoteFile(link: string, opts: FetchRemoteOptions): Promise<RemoteFile> {
  const { maxBytes, timeoutMs = 30_000, maxRedirects = 3, fetchImpl = fetch, resolveHost = defaultResolve } = opts;
  const signal = AbortSignal.timeout(timeoutMs);
  let url: URL;
  try {
    url = new URL(link);
  } catch {
    throw new RemoteFileError("That isn't a valid link.");
  }

  let res: Response | undefined;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    await assertPublic(url, resolveHost);
    try {
      res = await fetchImpl(url, { redirect: "manual", signal, headers: { Accept: "image/*,video/*" } });
    } catch {
      throw new RemoteFileError("We couldn't download that link. Try again, or upload the file instead.");
    }
    const location = res.status >= 300 && res.status < 400 ? res.headers.get("location") : null;
    if (!location) break;
    url = new URL(location, url);
    res = undefined;
  }
  if (!res) throw new RemoteFileError("That link redirects too many times.");
  if (!res.ok) throw new RemoteFileError(`That link didn't open (HTTP ${res.status}).`);

  const declared = Number(res.headers.get("content-length") ?? 0);
  if (declared > maxBytes) throw new RemoteFileError(`That file is too big (over ${Math.round(maxBytes / 1024 / 1024)} MB).`);
  let mimetype = (res.headers.get("content-type") ?? "").split(";")[0]!.trim().toLowerCase();
  if (!mimetype.startsWith("image/") && !mimetype.startsWith("video/")) {
    // Some hosts send files as application/octet-stream; trust a known extension then.
    const ext = /\.([a-z0-9]+)$/i.exec(url.pathname)?.[1]?.toLowerCase();
    mimetype = (ext && EXT_TYPES[ext]) || mimetype;
  }
  if (!mimetype.startsWith("image/") && !mimetype.startsWith("video/")) {
    throw new RemoteFileError("That link isn't a photo or video file. Link straight to the file, or upload it.");
  }

  const reader = res.body?.getReader();
  if (!reader) throw new RemoteFileError("That link returned nothing.");
  const path = join(UPLOAD_TMP_DIR, `link-${randomUUID()}`);
  const out = createWriteStream(path);
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new RemoteFileError(`That file is too big (over ${Math.round(maxBytes / 1024 / 1024)} MB).`);
      }
      // Respect back-pressure so a fast link can't pile up in memory either.
      if (!out.write(value)) await new Promise<void>((r) => out.once("drain", () => r()));
    }
    await new Promise<void>((resolve, reject) => out.end((err?: Error | null) => (err ? reject(err) : resolve())));
  } catch (err) {
    // The file opens asynchronously: wait for the stream to close, or a late open would recreate it after the delete.
    await new Promise<void>((resolve) => {
      out.once("close", () => resolve());
      out.destroy();
    });
    await removeTemp(path);
    throw err;
  }
  return { path, mimetype, size };
}
