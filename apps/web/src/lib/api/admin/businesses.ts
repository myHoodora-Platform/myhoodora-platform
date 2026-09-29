import type { User } from "firebase/auth";
import { isLive } from "../config";
import { BUSINESS_CATEGORIES } from "../business";
import { actorOf, adminGet, adminSend, forbidden, mock, notFound } from "./http";
import { auditFor, businessRecords, businessState, buildReports, paginate, recordAudit, saveBusinessState, type BusinessRecord } from "./mock-db";
import type { AdminBusiness, AdminRole, AuditAction, BusinessDetail, BusinessStatus, ListQuery, Page } from "./types";

export type BusinessTab = "applications" | "verified" | "reported" | "rejected";

const categoryLabel = (id: string) => BUSINESS_CATEGORIES.find((c) => c.id === id)?.label ?? id;

function toBusiness(b: BusinessRecord): AdminBusiness {
  return {
    id: b.id,
    name: b.businessName,
    category: categoryLabel(b.category),
    owner: { name: b.contactName, email: b.email, phone: b.phone },
    areasServed: b.areasServed,
    status: businessState()[b.id]?.status ?? "applied",
    cacNumber: b.cacNumber,
    appliedAt: b.at,
    openReports: buildReports().filter((r) => r.target.type === "business" && r.target.id === b.id && r.status !== "resolved" && r.status !== "dismissed").length,
  };
}

const IN_TAB: Record<BusinessTab, (b: AdminBusiness) => boolean> = {
  applications: (b) => b.status === "applied" || b.status === "info_requested",
  verified: (b) => b.status === "verified",
  reported: (b) => b.openReports > 0 || b.status === "suspended",
  rejected: (b) => b.status === "rejected",
};

/** live: GET /admin/businesses?tab */
export async function listBusinesses(user: User, query: ListQuery & { tab?: BusinessTab } = {}): Promise<Page<AdminBusiness>> {
  if (isLive("admin.businesses")) return adminGet(user, "/businesses", query);
  return mock(() => {
    const rows = businessRecords()
      .map(toBusiness)
      .filter(IN_TAB[query.tab ?? "applications"])
      .sort((a, b) => a.appliedAt.localeCompare(b.appliedAt));
    return paginate(rows, query, (b) => `${b.name} ${b.owner.name} ${b.category} ${b.areasServed.join(" ")}`);
  });
}

/** live: GET /admin/businesses/:id */
export async function getBusiness(user: User, id: string): Promise<BusinessDetail> {
  if (isLive("admin.businesses")) return adminGet(user, `/businesses/${id}`);
  return mock(() => {
    const b = businessRecords().find((x) => x.id === id);
    if (!b) notFound("Business");
    const status = businessState()[id]?.status;
    return {
      ...toBusiness(b),
      description: b.description,
      address: b.address,
      wantsAdsUpdates: b.wantsAdsUpdates,
      // Phone OTP + CAC lookup happen server-side; mock shows plausible states.
      checks: {
        phone: status === "verified" ? "verified" : "pending",
        cac: !b.cacNumber ? "not_provided" : status === "verified" ? "matched" : "pending",
      },
      timeline: auditFor("business", id).sort((a, b2) => b2.at.localeCompare(a.at)),
    };
  });
}

export type BusinessAction = "approve" | "request_info" | "reject" | "suspend" | "reinstate";

const NEXT: Record<BusinessAction, BusinessStatus> = {
  approve: "verified",
  request_info: "info_requested",
  reject: "rejected",
  suspend: "suspended",
  reinstate: "verified",
};

const AUDIT: Record<BusinessAction, AuditAction> = {
  approve: "business_approve",
  request_info: "business_request_info",
  reject: "business_reject",
  suspend: "business_suspend",
  reinstate: "business_approve",
};

/** live: POST /admin/businesses/:id/actions (admin only) */
export async function actOnBusiness(user: User, id: string, input: { action: BusinessAction; reason?: string; message?: string }, role: AdminRole): Promise<BusinessDetail> {
  if (isLive("admin.businesses")) return adminSend(user, `/businesses/${id}/actions`, input);
  await mock(() => {
    if (role !== "admin") forbidden();
    const b = businessRecords().find((x) => x.id === id);
    if (!b) notFound("Business");
    saveBusinessState({ ...businessState(), [id]: { status: NEXT[input.action] } });
    recordAudit(actorOf(user, role), AUDIT[input.action], { type: "business", id, label: b.businessName }, input.reason, input.message);
  }, 350);
  return getBusiness(user, id);
}
