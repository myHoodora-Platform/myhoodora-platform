import type { MongoMemoryReplSet } from "mongodb-memory-server";

export default async function globalTeardown() {
  await (globalThis as { __MONGO__?: MongoMemoryReplSet }).__MONGO__?.stop();
}
