/**
 * Versions of the Terms of Use and the Privacy Policy (docs/compliance/legal-versions.md), as Nextdoor
 * names and keeps its "Privacy Policy 2026" and "Member Agreement 2024". Each version is the date it
 * took effect. Past versions stay readable at /terms/versions/<version> and /privacy/versions/<version>.
 *
 * `material`: the change is big enough that members are asked to agree again (a screen they can't skip)
 * the next time they open myHoodora. A typo fix or a clearer sentence isn't; a new use of data, a new
 * right or obligation, or a change to how leaving works is.
 *
 * The API keeps the current versions too (apps/api/src/users/domain/legal.ts): the two must agree,
 * which apps/api/src/users/domain/legal.spec.ts checks.
 */

export type LegalDocument = "terms" | "privacy";

export interface LegalVersion {
  /** The date it took effect, "YYYY-MM-DD". Also its id in URLs and on acceptance records. */
  version: string;
  material: boolean;
  /** What changed from the version before, in a line each. The first version says what it is. */
  changes: string[];
}

/** Newest first. Add a new version at the top; never edit or remove a published one. */
export const LEGAL_VERSIONS: Record<LegalDocument, LegalVersion[]> = {
  terms: [
    {
      version: "2026-11-03",
      material: true,
      changes: [
        "Leaving: you can now deactivate your account (and reactivate it whenever you like) or delete it, which happens 7 days later unless you cancel.",
        "myHoodora is for adults: everyone is asked when they were born before they join.",
      ],
    },
    { version: "2026-09-28", material: true, changes: ["The first published Terms of Use."] },
  ],
  privacy: [
    {
      version: "2026-11-03",
      material: true,
      changes: [
        "The age check: we ask when you were born, keep only that you passed, and never the date.",
        "Every service provider we use is listed on its own page, with where it stores your data.",
        "New sections on phone permissions, local ads, automated decisions and how long we keep each kind of data.",
        "Privacy requests now go to privacy@myhoodora.com, and you can reach our Data Protection Officer, Peace Arakunle, at dpo@myhoodora.com.",
        "Deactivating and deleting your account are now two separate choices.",
      ],
    },
    { version: "2026-09-28", material: true, changes: ["The first published Privacy Policy."] },
  ],
};

export const LEGAL_TITLES: Record<LegalDocument, string> = { terms: "Terms of Use", privacy: "Privacy Policy" };

export function currentLegalVersion(doc: LegalDocument): LegalVersion {
  return LEGAL_VERSIONS[doc][0]!;
}

export function findLegalVersion(doc: LegalDocument, version: string): LegalVersion | undefined {
  return LEGAL_VERSIONS[doc].find((v) => v.version === version);
}

/** "3 November 2026": how a version is named on the page. */
export function legalVersionLabel(version: string): string {
  const [y, m, d] = version.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!)).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

/** What a member has agreed to, as GET /users/me reports it (null: never, e.g. a new Google sign-up). */
export interface LegalAcceptance {
  terms: string | null;
  privacy: string | null;
}

/** The newest material version, the one a member must have agreed to (or something newer). */
function latestMaterial(doc: LegalDocument): string {
  return LEGAL_VERSIONS[doc].find((v) => v.material)!.version;
}

/** True when either document has a material change they haven't agreed to: show the "updated terms" screen. */
export function needsLegalAcceptance(accepted: LegalAcceptance | null | undefined): boolean {
  if (!accepted) return false; // an older API that doesn't report it
  return (["terms", "privacy"] as const).some((doc) => (accepted[doc] ?? "") < latestMaterial(doc));
}

/** The changes they haven't seen yet, newest first, for the "updated terms" screen. */
export function unseenLegalChanges(doc: LegalDocument, accepted: string | null): LegalVersion[] {
  return LEGAL_VERSIONS[doc].filter((v) => !accepted || v.version > accepted);
}
