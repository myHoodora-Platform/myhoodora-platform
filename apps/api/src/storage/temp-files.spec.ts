import { mkdtempSync, existsSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sweepStaleTemps } from "./temp-files";

describe("sweepStaleTemps", () => {
  it("removes only temp files older than the cut-off", async () => {
    const dir = mkdtempSync(join(tmpdir(), "sweep-spec-"));
    const old = join(dir, "old");
    const fresh = join(dir, "fresh");
    writeFileSync(old, "x");
    writeFileSync(fresh, "x");
    const twoHoursAgo = (Date.now() - 2 * 60 * 60 * 1000) / 1000;
    utimesSync(old, twoHoursAgo, twoHoursAgo);
    await expect(sweepStaleTemps(60 * 60 * 1000, dir)).resolves.toBe(1);
    expect(existsSync(old)).toBe(false);
    expect(existsSync(fresh)).toBe(true);
  });
});
