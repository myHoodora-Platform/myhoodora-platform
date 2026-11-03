import type { ClientSession, Connection } from "mongoose";

/**
 * Run several writes as one unit (Mongoose connection.transaction: commits,
 * aborts and retries transient errors). Requires a replica set — Atlas is
 * one; tests use mongodb-memory-server's replica set. Never run operations
 * in parallel inside the callback (Mongo sessions don't support it).
 */
export function withTransaction<T>(connection: Connection, work: (session: ClientSession) => Promise<T>): Promise<T> {
  return connection.transaction(work);
}
