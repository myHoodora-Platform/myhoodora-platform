/**
 * The Terms of Use and Privacy Policy versions members must have agreed to (docs/compliance/legal-versions.md).
 * Mirrors packages/api-contract/src/legal.ts, which holds every version and its changes for the
 * clients; legal.spec.ts checks the two agree. Bump these with a new *material* version there.
 */
export const CURRENT_LEGAL = { terms: "2026-11-03", privacy: "2026-11-07" } as const;

export type LegalDocument = keyof typeof CURRENT_LEGAL;

/** How many acceptance records a person keeps: proof of what they agreed to and when (GAID: keep records of consent). */
export const LEGAL_RECORDS_KEPT = 20;
