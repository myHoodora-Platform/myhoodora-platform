import { Logger } from "@nestjs/common";
import mongoose from "mongoose";
import { runMigrations } from "./migrations/runner";

/**
 * pnpm --filter @myhoodora/api migrate [--dry-run]
 * Applies pending migrations in order and records them. Reads MONGODB_URI.
 */
async function main() {
  const logger = new Logger("Migrate");
  const dryRun = process.argv.includes("--dry-run");
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set.");
  // Mongoose's bundled driver, so the script and the app always speak the same driver version.
  const client = await mongoose.mongo.MongoClient.connect(uri);
  try {
    await runMigrations(client.db(), { dryRun, log: (msg) => logger.log(msg) });
    logger.log(dryRun ? "Dry run complete; nothing written." : "Migrations complete.");
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  new Logger("Migrate").error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
