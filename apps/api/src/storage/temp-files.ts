import { mkdirSync } from "node:fs";
import { readdir, stat, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Where uploads and downloaded links wait (on disk, not in memory) until they're sent to storage. */
export const UPLOAD_TMP_DIR = join(tmpdir(), "myhoodora-uploads");
mkdirSync(UPLOAD_TMP_DIR, { recursive: true });

/** Always called once a temp file has been used; a missing file is fine. */
export async function removeTemp(path: string | undefined): Promise<void> {
  if (path) await unlink(path).catch(() => undefined);
}

/**
 * Removes temp files older than `maxAgeMs`: leftovers from a process that
 * died mid-upload (crash, deploy, restart). Nothing live is that old, since
 * uploads time out well before an hour.
 */
export async function sweepStaleTemps(maxAgeMs = 60 * 60 * 1000, dir = UPLOAD_TMP_DIR): Promise<number> {
  const names = await readdir(dir).catch(() => [] as string[]);
  let removed = 0;
  for (const name of names) {
    const path = join(dir, name);
    const info = await stat(path).catch(() => null);
    if (info?.isFile() && Date.now() - info.mtimeMs > maxAgeMs) {
      await removeTemp(path);
      removed++;
    }
  }
  return removed;
}
