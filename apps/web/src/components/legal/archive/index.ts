import type { ComponentType } from "react";
import type { LegalDocument } from "@myhoodora/api-contract/legal";
import { PrivacyPolicy20260928 } from "./privacy-2026-09-28";
import { Terms20260928 } from "./terms-2026-09-28";

/**
 * Past versions, by document and version (packages/api-contract/src/legal.ts). When a new version
 * is published, the one it replaces is copied here first, unchanged, and added to this map.
 */
export const LEGAL_ARCHIVE: Record<LegalDocument, Record<string, ComponentType>> = {
  terms: { "2026-09-28": Terms20260928 },
  privacy: { "2026-09-28": PrivacyPolicy20260928 },
};
