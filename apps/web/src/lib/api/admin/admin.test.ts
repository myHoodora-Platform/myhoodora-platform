import { describe, expect, it } from "vitest";
import type { User } from "firebase/auth";
import { ApiError } from "../client";
import { isRemoved } from "../mock/moderation-state";
import { submitReport } from "../reports";
import { actOnNeighbour, createHood, getNeighbour, hoodsNear, listVerification, updateHood } from "./community";
import { actOnReport, getReport, listAudit, listReports, setReportClaim } from "./moderation";
import { actOnBusiness, listBusinesses } from "./businesses";
import { getAdminSession } from "./session";

// Node has no browser storage; the mock store falls back to memory.
Object.assign(globalThis, { window: { location: { origin: "http://test" }, dispatchEvent: () => true } });

const staff = { uid: "staff_1", displayName: "Test Moderator" } as User;
const neighbour = { uid: "nb_reporter" } as User;

describe("admin session", () => {
  it("gives moderators only moderation and verification capabilities", async () => {
    const s = await getAdminSession(staff, "moderator");
    expect(s.role).toBe("moderator");
    expect(s.can).toEqual(["moderation.act", "verification.review"]);
    expect(s.preview).toBe(false);
  });

  it("labels non-staff access in mock mode as a preview", async () => {
    const s = await getAdminSession(neighbour, "member");
    expect(s.preview).toBe(true);
  });
});

describe("moderation flow", () => {
  it("groups reports filed from the app into one queue item, most severe first", async () => {
    await submitReport(neighbour, { targetType: "post", targetId: "mp_lost", reason: "spam" });
    const queue = await listReports(staff, { status: "active", pageSize: 100 });
    const lost = queue.items.find((r) => r.id === "post:mp_lost");
    expect(lost).toMatchObject({ status: "open", reporterCount: 1, severity: "low" });
    // Severity ordering: nothing low comes before something high.
    const firstLow = queue.items.findIndex((r) => r.severity === "low");
    const lastHigh = queue.items.map((r) => r.severity).lastIndexOf("high");
    expect(lastHigh).toBeLessThan(firstLow);
  });

  it("shows full context on the report detail", async () => {
    const r = await getReport(staff, "post:ep_loans");
    expect(r.reporterCount).toBe(3);
    expect(r.author?.displayName).toBe("Quick Loans NG");
    expect(r.content.kind).toBe("post");
    expect(r.reports.every((x) => x.reporter.displayName)).toBe(true);
  });

  it("blocks a second moderator from claiming a report someone is reviewing", async () => {
    await expect(setReportClaim({ uid: "other" } as User, "post:ep_meters", true, "moderator")).rejects.toBeInstanceOf(ApiError);
  });

  it("removing content resolves the report, hides it from the feed and logs it", async () => {
    await actOnReport(staff, "post:mp_lost", { action: "remove_content", reason: "Spam or advertising" }, "moderator");
    const r = await getReport(staff, "post:mp_lost");
    expect(r.status).toBe("resolved");
    expect(r.content).toMatchObject({ removed: true });
    // The mock feed, comments and listings all read this shared removal state.
    expect(isRemoved("post", "mp_lost")).toBe(true);
    const log = await listAudit(staff, { action: "remove_content" });
    expect(log.items[0]?.reason).toBe("Spam or advertising");
  });

  it("only admins can suspend", async () => {
    await expect(actOnReport(staff, "user:nb_quickloans", { action: "suspend_author", reason: "Scam or fraud" }, "moderator")).rejects.toMatchObject({ kind: "forbidden" });
    await actOnReport(staff, "user:nb_quickloans", { action: "suspend_author", reason: "Scam or fraud" }, "admin");
    expect((await getNeighbour(staff, "nb_quickloans")).accountStatus).toBe("suspended");
  });
});

describe("community", () => {
  it("verifying moves someone out of the verification queue into a Hood", async () => {
    const before = await listVerification(staff, { status: "pending_review" });
    expect(before.items.some((c) => c.uid === "nb_chidi")).toBe(true);
    await actOnNeighbour(staff, "nb_chidi", { action: "verify", hoodId: "hood-ikeja", reason: "Address matched manually" }, "moderator");
    const after = await listVerification(staff, { status: "pending_review" });
    expect(after.items.some((c) => c.uid === "nb_chidi")).toBe(false);
    expect((await getNeighbour(staff, "nb_chidi")).hood?.name).toBe("Ikeja");
  });

  it("keeps verification and account status separate", async () => {
    await actOnNeighbour(staff, "nb_segun", { action: "restrict", days: 3, reason: "Spam" }, "moderator");
    const n = await getNeighbour(staff, "nb_segun");
    expect(n).toMatchObject({ verificationStatus: "verified", accountStatus: "restricted" });
    await expect(actOnNeighbour(staff, "nb_segun", { action: "reinstate", reason: "Appeal accepted" }, "moderator")).rejects.toMatchObject({ kind: "forbidden" });
  });

  it("refuses a Hood centred inside an existing one, and archives instead of deleting", async () => {
    await expect(
      createHood(staff, { name: "Lekki Central", city: "Lagos", country: "Nigeria", center: { lat: 6.448, lng: 3.475 }, radiusMeters: 1000 }, "admin"),
    ).rejects.toThrow(/centre is inside Lekki Phase 1/);
    const archived = await updateHood(staff, "hood-apapa", { status: "archived", reason: "Merged" }, "admin");
    expect(archived.status).toBe("archived");
  });

  it("lists the Hoods in reach of a point, nearest first, archived ones included", async () => {
    const near = await hoodsNear(staff, { lat: 6.4478, lng: 3.4746 });
    expect(near[0]!.name).toBe("Lekki Phase 1");
    expect(near.map((h) => h.city)).not.toContain("Ibadan");
    // Apapa is about 13 km away and was archived above.
    expect(near.find((h) => h.id === "hood-apapa")?.status).toBe("archived");
  });
});

describe("businesses", () => {
  it("approving an application moves it to Verified", async () => {
    const apps = await listBusinesses(staff, { tab: "applications" });
    const id = apps.items[0]!.id;
    await actOnBusiness(staff, id, { action: "approve", reason: "Details check out" }, "admin");
    const verified = await listBusinesses(staff, { tab: "verified", pageSize: 50 });
    expect(verified.items.some((b) => b.id === id)).toBe(true);
    await expect(actOnBusiness(staff, id, { action: "suspend", reason: "x" }, "moderator")).rejects.toMatchObject({ kind: "forbidden" });
  });
});
