import { describe, expect, it } from "vitest";
import { submissionIds } from "./submission-id";

describe("submissionIds", () => {
  const counting = () => {
    let n = 0;
    return submissionIds(() => `id-${++n}`);
  };

  it("gives a retry of the same draft the same id, so the API can tell it is one submission", () => {
    const ids = counting();
    const draft = { values: { category: "alert", message: "Burst pipe on Road 12" }, mediaUrls: ["https://cdn.test/a.jpg"] };
    const first = ids.for(draft);
    // A new but identical object: what a second press of "Post" builds.
    expect(ids.for(structuredClone(draft))).toBe(first);
    expect(ids.for(structuredClone(draft))).toBe(first);
  });

  it("gives an edited draft a new id, so the edit isn't discarded as a repeat", () => {
    const ids = counting();
    const first = ids.for({ values: { message: "Burst pipe on Road 12" }, mediaUrls: [] });
    const edited = ids.for({ values: { message: "Burst pipe on Road 12, now fixed" }, mediaUrls: [] });
    const withPhoto = ids.for({ values: { message: "Burst pipe on Road 12, now fixed" }, mediaUrls: ["https://cdn.test/a.jpg"] });
    expect(new Set([first, edited, withPhoto]).size).toBe(3);
    // Going back to earlier wording is a new submission too: only an immediate repeat is a retry.
    expect(ids.for({ values: { message: "Burst pipe on Road 12" }, mediaUrls: [] })).not.toBe(first);
  });

  it("keeps separate composers apart, and makes ids the API accepts by default", () => {
    const draft = { values: { message: "Hello" }, mediaUrls: [] };
    const a = submissionIds().for(draft);
    const b = submissionIds().for(draft);
    expect(a).not.toBe(b);
    // The API's rule for clientId (apps/api/src/posts/dto/posts.dto.ts).
    expect(a).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
  });
});
