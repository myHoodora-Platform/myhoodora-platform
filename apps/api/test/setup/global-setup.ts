import { MongoMemoryReplSet } from "mongodb-memory-server";

/** One throwaway replica set (transactions need one) for the whole run. */
export default async function globalSetup() {
  const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  (globalThis as { __MONGO__?: MongoMemoryReplSet }).__MONGO__ = replSet;
  process.env.TEST_MONGO_URI = replSet.getUri();
}
