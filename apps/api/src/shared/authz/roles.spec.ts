import { can, capabilitiesOf, effectiveAccountStatus, type CapabilitySubject } from "./roles";

const member = (patch: Partial<CapabilitySubject> = {}): CapabilitySubject => ({
  role: "member",
  accountStatus: "active",
  verificationStatus: "verified",
  hoodId: "h1",
  ...patch,
});

describe("capabilitiesOf", () => {
  it("verified members in a Hood can post, react and report", () => {
    expect(capabilitiesOf(member())).toEqual(expect.arrayContaining(["content.create", "content.react", "report.create", "profile.manage"]));
    expect(can(member(), "admin.access")).toBe(false);
  });

  it("unverified or Hood-less people can report but not post", () => {
    for (const s of [member({ verificationStatus: "unverified" }), member({ hoodId: null })]) {
      expect(can(s, "content.create")).toBe(false);
      expect(can(s, "report.create")).toBe(true);
    }
  });

  it("without a confirmed email (where one is required) a verified neighbour can react and report, but not post or message", () => {
    const unconfirmed = member({ emailConfirmed: false });
    expect(can(unconfirmed, "content.create")).toBe(false);
    expect(can(unconfirmed, "messages.send")).toBe(false);
    expect(can(unconfirmed, "content.react")).toBe(true);
    expect(can(unconfirmed, "report.create")).toBe(true);
    expect(can(unconfirmed, "profile.manage")).toBe(true);
    // Confirmed, or not a consideration at all: both write.
    for (const s of [member({ emailConfirmed: true }), member()]) {
      expect(can(s, "content.create")).toBe(true);
      expect(can(s, "messages.send")).toBe(true);
    }
    // It adds a condition; it never replaces the others.
    expect(can(member({ emailConfirmed: true, verificationStatus: "unverified" }), "content.create")).toBe(false);
    expect(can(member({ emailConfirmed: false, role: "admin" }), "admin.access")).toBe(true);
  });

  it("restriction blocks posting until it expires", () => {
    const now = new Date("2026-09-29T12:00:00Z");
    const restricted = member({ accountStatus: "restricted", restrictedUntil: new Date("2026-09-30T00:00:00Z") });
    expect(can(restricted, "content.create", now)).toBe(false);
    expect(can(restricted, "profile.manage", now)).toBe(true);
    expect(effectiveAccountStatus(restricted, new Date("2026-10-01T00:00:00Z"))).toBe("active");
    expect(can(restricted, "content.create", new Date("2026-10-01T00:00:00Z"))).toBe(true);
  });

  it("suspension removes everything, including staff powers", () => {
    expect(capabilitiesOf(member({ accountStatus: "suspended", role: "admin" }))).toEqual([]);
  });

  it("staff powers stack by role; only owners manage admins", () => {
    expect(can(member({ role: "moderator" }), "moderation.act")).toBe(true);
    expect(can(member({ role: "moderator" }), "moderation.suspend")).toBe(false);
    expect(can(member({ role: "admin" }), "moderation.suspend")).toBe(true);
    expect(can(member({ role: "moderator" }), "neighbours.address")).toBe(false);
    expect(can(member({ role: "admin" }), "neighbours.address")).toBe(true);
    expect(can(member({ role: "owner" }), "neighbours.address")).toBe(true);
    expect(can(member({ role: "admin" }), "team.manage.admins")).toBe(false);
    expect(can(member({ role: "owner" }), "team.manage.admins")).toBe(true);
  });
});
