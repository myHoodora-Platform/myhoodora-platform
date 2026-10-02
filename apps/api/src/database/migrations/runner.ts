import type { mongo } from "mongoose";
type Db = mongo.Db;
import { MIGRATIONS, type Migration } from "./index";

/** Applies pending migrations in order and records each in `migrations`. Safe to re-run. */
export async function runMigrations(db: Db, opts: { dryRun?: boolean; log?: (msg: string) => void; migrations?: Migration[] } = {}): Promise<string[]> {
  const log = opts.log ?? (() => undefined);
  const dryRun = Boolean(opts.dryRun);
  const applied = new Set((await db.collection("migrations").find().toArray()).map((m) => String(m._id)));
  const ran: string[] = [];
  for (const m of opts.migrations ?? MIGRATIONS) {
    if (applied.has(m.id)) {
      log(`skip ${m.id} (applied)`);
      continue;
    }
    log(`${dryRun ? "DRY RUN " : ""}${m.id}: ${m.description}`);
    await m.up({ db, dryRun, log: (msg) => log(`  ${msg}`) });
    if (!dryRun) await db.collection("migrations").insertOne({ _id: m.id as never, appliedAt: new Date() });
    ran.push(m.id);
  }
  return ran;
}
