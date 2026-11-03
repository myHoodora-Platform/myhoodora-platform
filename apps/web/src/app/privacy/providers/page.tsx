import type { Metadata } from "next";
import Link from "next/link";
import { PRIVACY_EMAIL, publicPageMetadata } from "@/lib/site";
import { LegalPage, LegalSection } from "@/components/legal/legal-page";
import { PROVIDERS, PROVIDERS_UPDATED } from "@/components/legal/providers";
import { legalVersionLabel } from "@myhoodora/api-contract/legal";

export const metadata: Metadata = publicPageMetadata("/privacy/providers", {
  title: "Our service providers | myHoodora",
  description: "The companies that help run myHoodora, the personal data each one handles, where they store it and how it's protected.",
});

const link = "font-semibold text-primary hover:underline";

export default function Page() {
  return (
    <LegalPage
      explore={["safety", "guidelines", "about"]}
      title="Our service providers"
      updatedAt={legalVersionLabel(PROVIDERS_UPDATED)}
      intro="These are the companies that help us run myHoodora and handle personal data for us, what each one handles, where they store it, and what protects it. They handle it to provide their service to us, not for their own purposes."
    >
      <ul className="space-y-3">
        {PROVIDERS.map((p) => (
          <li key={p.name} className="rounded-2xl border border-border bg-card p-4 sm:p-5">
            <h2 className="text-base font-bold text-foreground">{p.name}</h2>
            <p className="text-sm text-muted-foreground">{p.role}</p>
            <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[9rem_1fr]">
              <dt className="font-semibold text-foreground">What they handle</dt>
              <dd className="text-muted-foreground">{p.data}</dd>
              <dt className="font-semibold text-foreground">Where</dt>
              <dd className="text-muted-foreground">{p.where ?? "Outside Nigeria. We're confirming the exact region"}</dd>
              <dt className="font-semibold text-foreground">Protection</dt>
              <dd className="text-muted-foreground">{p.safeguard}</dd>
            </dl>
          </li>
        ))}
      </ul>

      <LegalSection title="Why your data leaves Nigeria">
        <p>
          None of these providers stores data in Nigeria yet, so using myHoodora means sending your data abroad. The
          Nigeria Data Protection Act (sections 41 to 43) allows this when the data stays protected. We rely on
          contracts that require each provider to protect your data to the Act&apos;s standard, and standard
          contractual clauses where a provider offers them. Where we send only an address or an IP address that
          isn&apos;t linked to your account, we keep it to that.
        </p>
        <p>
          You can ask for a copy of the safeguard for any provider at{" "}
          <a href={`mailto:${PRIVACY_EMAIL}`} className={link}>
            {PRIVACY_EMAIL}
          </a>
          . When this list changes, the date at the top changes too. Everything else about your data is in our{" "}
          <Link href="/privacy" className={link}>
            Privacy Policy
          </Link>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}
