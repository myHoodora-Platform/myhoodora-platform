import Link from "next/link";
import { LEGAL_VERSIONS, legalVersionLabel, type LegalDocument } from "@myhoodora/api-contract/legal";
import { LEGAL_ARCHIVE } from "./archive";

const BASE: Record<LegalDocument, string> = { terms: "/terms", privacy: "/privacy" };

/**
 * Under a legal page's title: what changed in this version, and every earlier version, readable as
 * published (docs/compliance/legal-versions.md). `version`: the one on screen.
 */
export function VersionHistory({ doc, version }: { doc: LegalDocument; version: string }) {
  const versions = LEGAL_VERSIONS[doc];
  const shown = versions.find((v) => v.version === version);
  const isCurrent = versions[0]?.version === version;
  const others = versions.filter((v) => v.version !== version && (v === versions[0] || LEGAL_ARCHIVE[doc][v.version]));
  const hasEarlier = versions.length > 1;

  return (
    <div className="rounded-2xl border border-border bg-canvas p-5 text-[15px] sm:p-6">
      {!isCurrent && (
        <p className="mb-3 rounded-xl bg-warning-soft/60 p-3 text-sm font-semibold text-foreground">
          This is an earlier version, kept so you can see what it said. It no longer applies.{" "}
          <Link href={BASE[doc]} className="text-primary hover:underline">
            Read the current version
          </Link>
          .
        </p>
      )}
      {shown && hasEarlier && shown !== versions[versions.length - 1] && (
        <>
          <h2 className="text-base font-bold text-foreground">What changed in this version</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-muted-foreground">
            {shown.changes.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </>
      )}
      {hasEarlier && (
        <p className={shown && shown !== versions[versions.length - 1] ? "mt-4 text-sm text-muted-foreground" : "text-sm text-muted-foreground"}>
          {isCurrent ? "Earlier versions: " : "Other versions: "}
          {others.map((v, i) => (
            <span key={v.version}>
              {i > 0 && " · "}
              <Link href={v === versions[0] ? BASE[doc] : `${BASE[doc]}/versions/${v.version}`} className="font-semibold text-primary hover:underline">
                {legalVersionLabel(v.version)}
                {v === versions[0] ? " (current)" : ""}
              </Link>
            </span>
          ))}
        </p>
      )}
    </div>
  );
}
