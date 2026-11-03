import { describe, expect, it } from "vitest";
import { bulkFailureSummary } from "./bulk-outcome";

const names: Record<string, string> = { u1: "Ada Okafor", u2: "Bola Ade", u3: "Chidi Eze", u4: "Dayo Bello", u5: "Emeka Obi" };
const nameOf = (uid: string) => names[uid] ?? "A neighbour";

describe("bulkFailureSummary", () => {
  it("has nothing to say when everyone was changed", () => {
    expect(bulkFailureSummary({ updated: 2, results: [{ uid: "u1", ok: true }, { uid: "u2", ok: true }] }, nameOf)).toBeNull();
  });

  it("names who wasn't changed and why, alongside how many were", () => {
    const summary = bulkFailureSummary(
      { updated: 2, results: [{ uid: "u1", ok: true }, { uid: "u2", ok: false, message: "Neighbour not found." }, { uid: "u3", ok: true }] },
      nameOf,
    );
    expect(summary).toBe("2 done, 1 not. Bola Ade: Neighbour not found.");
  });

  it("says so plainly when nobody was changed", () => {
    const summary = bulkFailureSummary({ updated: 0, results: [{ uid: "u1", ok: false, message: "You can't take action on staff at or above your role." }] }, nameOf);
    expect(summary).toBe("Nobody was changed. Ada Okafor: You can't take action on staff at or above your role.");
  });

  it("keeps a long list readable", () => {
    const results = ["u1", "u2", "u3", "u4", "u5"].map((uid) => ({ uid, ok: false, message: "Neighbour not found." }));
    const summary = bulkFailureSummary({ updated: 0, results }, nameOf)!;
    expect(summary).toContain("Ada Okafor");
    expect(summary).toContain("Chidi Eze");
    expect(summary).not.toContain("Dayo Bello");
    expect(summary.endsWith("and 2 more")).toBe(true);
  });

  it("treats an answer from an older API (a count only) as everyone changed, as it meant then", () => {
    expect(bulkFailureSummary({ updated: 3 }, nameOf)).toBeNull();
  });

  it("still names someone it has no name for, and a failure with no reason given", () => {
    expect(bulkFailureSummary({ updated: 0, results: [{ uid: "ghost", ok: false }] }, nameOf)).toBe("Nobody was changed. A neighbour: couldn't be changed");
  });
});
