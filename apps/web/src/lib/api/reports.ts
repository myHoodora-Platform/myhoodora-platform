import type { User } from "firebase/auth";
import { apiFetch } from "./client";
import { isLive } from "./config";
import { latency, load, save } from "./mock/store";
import type { ReportInput } from "./types";

/**
 * live: POST /reports { targetType, targetId, reason, details }.
 * Reports go to Neighbourhood Leads / admins for review (Nextdoor model).
 */
export async function submitReport(user: User, input: ReportInput): Promise<void> {
  if (isLive("reports")) {
    await apiFetch<void>(user, "/reports", { method: "POST", json: input });
    return;
  }
  await latency(300);
  const reports = load<(ReportInput & { reporterUid: string; createdAt: string })[]>("reports", () => []);
  save("reports", [...reports, { ...input, reporterUid: user.uid, createdAt: new Date().toISOString() }]);
}
