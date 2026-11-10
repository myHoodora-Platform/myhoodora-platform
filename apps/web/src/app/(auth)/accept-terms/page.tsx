"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ScrollText } from "lucide-react";
import { Button } from "@myhoodora/ui/button";
import { Skeleton } from "@myhoodora/ui/skeleton";
import { LEGAL_TITLES, currentLegalVersion, legalVersionLabel, unseenLegalChanges, type LegalDocument } from "@myhoodora/api-contract/legal";
import { useAuth } from "@/context/AuthContext";
import { errorMessage } from "@/lib/api/client";
import { isClosed, isStaff, needsAgeCheck, needsTermsAcceptance } from "@/lib/auth/profile";
import { DEFAULT_APP_ROUTE, ROUTES } from "@/lib/routes";
import { PolicyReviewDialog } from "@/components/legal/policy-review-dialog";

const DOCS: { doc: LegalDocument; href: string }[] = [
  { doc: "terms", href: "/terms" },
  { doc: "privacy", href: "/privacy" },
];

/**
 * /accept-terms: agreeing to the current Terms of Use and Privacy Policy (docs/compliance/legal-versions.md).
 * A new account that hasn't (a Google sign-up) is asked once; a member is asked again after a material
 * change, with what changed since the version they agreed to. It can't be skipped, only signed out of.
 * Agreeing goes through PolicyReviewDialog: both documents, each read to the end, then "I agree".
 */
export default function AcceptTermsPage() {
  const router = useRouter();
  const { user, profile, profileStatus, loading, acceptLegal, logout } = useAuth();
  const [busy, setBusy] = useState(false);
  const [reviewing, setReviewing] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace(ROUTES.login);
    else if (profileStatus === "ready" && profile && !needsTermsAcceptance(profile)) {
      router.replace(
        isClosed(profile) ? ROUTES.welcomeBack : needsAgeCheck(profile) ? ROUTES.confirmAge : profile.isOnboarded || isStaff(profile.role) ? DEFAULT_APP_ROUTE : ROUTES.onboarding,
      );
    }
  }, [loading, user, profile, profileStatus, router]);

  if (loading || !user || profileStatus !== "ready" || !profile?.legal || !needsTermsAcceptance(profile)) {
    return (
      <div className="space-y-4" aria-busy>
        <Skeleton className="mx-auto size-12 rounded-full" />
        <Skeleton className="mx-auto h-8 w-3/4" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    );
  }

  const legal = profile.legal;
  const firstTime = !legal.terms && !legal.privacy;
  const versions = { terms: currentLegalVersion("terms").version, privacy: currentLegalVersion("privacy").version };

  const agree = async () => {
    setBusy(true);
    try {
      await acceptLegal(versions);
      // The effect above moves them on once the profile says they've agreed.
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't save that. Please try again."));
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3 text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <ScrollText className="size-6" aria-hidden />
        </span>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{firstTime ? "Before you join" : "We've updated our terms"}</h1>
        <p className="text-sm text-muted-foreground">
          {firstTime
            ? "Please read and agree to how myHoodora works and how we use your data."
            : "Please read what's changed. You'll need to agree to keep using myHoodora."}
        </p>
      </div>

      <div className="space-y-3">
        {DOCS.map(({ doc, href }) => {
          const changes = firstTime ? [] : unseenLegalChanges(doc, legal[doc]);
          return (
            <div key={doc} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-bold text-foreground">{LEGAL_TITLES[doc]}</h2>
                <span className="text-xs text-muted-foreground">{legalVersionLabel(versions[doc])}</span>
              </div>
              {changes.length > 0 && (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {changes.flatMap((v) => v.changes).map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              )}
              <Link href={href} target="_blank" className="mt-2 inline-block text-sm font-semibold text-primary hover:underline">
                Read the {LEGAL_TITLES[doc]}
              </Link>
            </div>
          );
        })}
      </div>

      <Button className="w-full" onClick={() => setReviewing(true)}>
        Read and agree
      </Button>
      <PolicyReviewDialog open={reviewing} onOpenChange={setReviewing} onAgree={agree} busy={busy} />
      <p className="border-t border-border pt-4 text-center text-xs text-muted-foreground">
        Don&apos;t agree? You can{" "}
        <button type="button" onClick={() => void logout().then(() => router.replace(ROUTES.home))} className="font-semibold underline hover:text-primary">
          sign out
        </button>{" "}
        or delete your account in Settings → Account.
      </p>
    </div>
  );
}
