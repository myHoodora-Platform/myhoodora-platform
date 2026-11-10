"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, ExternalLink, Lock } from "lucide-react";
import { Button } from "@myhoodora/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@myhoodora/ui/dialog";
import { Skeleton } from "@myhoodora/ui/skeleton";
import { LEGAL_TITLES, currentLegalVersion, legalVersionLabel, type LegalDocument } from "@myhoodora/api-contract/legal";

const Loading = () => (
  <div className="space-y-3" aria-busy>
    <Skeleton className="h-6 w-1/2" />
    <Skeleton className="h-24 w-full" />
    <Skeleton className="h-24 w-full" />
  </div>
);

type Contents = Record<LegalDocument, React.ComponentType>;

/** The same text as the public pages, loaded the first time the dialog opens. */
const loadContents = (): Promise<Contents> =>
  Promise.all([import("./terms"), import("./privacy-policy")]).then(([t, p]) => ({ terms: t.TermsContent, privacy: p.PrivacyPolicyContent }));

const STEPS: { doc: LegalDocument; path: string }[] = [
  { doc: "terms", path: "/terms" },
  { doc: "privacy", path: "/privacy" },
];

interface PolicyReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called once both documents have been read to the end and "I agree" pressed. */
  onAgree: () => void | Promise<void>;
  busy?: boolean;
}

/**
 * The Terms of Use, then the Privacy Policy, in a page-like window. "I agree" (and "Next" before it)
 * stays off until each one has been scrolled to the end, so agreeing means having had the whole text
 * in front of you. Used by sign-up and /accept-terms; the app's PolicyReviewModal does the same.
 */
export function PolicyReviewDialog({ open, onOpenChange, onAgree, busy = false }: PolicyReviewDialogProps) {
  const [step, setStep] = useState(0);
  const [read, setRead] = useState<Partial<Record<LegalDocument, boolean>>>({});
  const [contents, setContents] = useState<Contents | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const { doc, path } = STEPS[step]!;
  const Content = contents?.[doc];
  const last = step === STEPS.length - 1;
  const done = Boolean(read[doc]);

  // Each opening starts again from the Terms.
  useEffect(() => {
    if (!open) return;
    setStep(0);
    setRead({});
    if (!contents) void loadContents().then(setContents);
  }, [open, contents]);

  // The end marker sits after the text: once it has been on screen, this document counts as read.
  // Not while the text is loading, when the marker sits right under the placeholder.
  useEffect(() => {
    if (!open || !Content) return;
    let observer: IntersectionObserver | null = null;
    // The dialog's content mounts a frame after `open` flips. Back to the top first: nothing may
    // count as read before the reader has scrolled.
    const frame = requestAnimationFrame(() => {
      if (!end.current || !scroller.current) return;
      scroller.current.scrollTo({ top: 0 });
      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) setRead((r) => ({ ...r, [doc]: true }));
        },
        { root: scroller.current, rootMargin: "0px 0px 40px 0px" },
      );
      observer.observe(end.current);
    });
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [open, doc, Content]);

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent hideClose className="flex h-[min(88dvh,820px)] max-w-2xl flex-col gap-0 overflow-hidden p-0">
        {/* Browser-style address bar: this is the page at myhoodora.com, not a summary of it. */}
        <div className="flex items-center gap-2 border-b border-border bg-muted/60 px-3 py-2">
          <span className="flex min-w-0 flex-1 items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-xs text-muted-foreground">
            <Lock className="size-3 shrink-0" aria-hidden />
            <span className="truncate">myhoodora.com{path}</span>
          </span>
          <a
            href={path}
            target="_blank"
            rel="noreferrer"
            aria-label={`Open the ${LEGAL_TITLES[doc]} in a new tab`}
            className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-card hover:text-foreground"
          >
            <ExternalLink className="size-4" />
          </a>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={busy}
            className="rounded-full px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-card hover:text-foreground disabled:opacity-50"
          >
            Close
          </button>
        </div>

        <div className="flex gap-1.5 px-5 pt-4" aria-hidden>
          {STEPS.map((s, i) => (
            <span key={s.doc} className={`h-1 flex-1 rounded-full ${i < step || (i === step && done) ? "bg-primary" : i === step ? "bg-primary/30" : "bg-muted"}`} />
          ))}
        </div>
        <div className="px-5 pt-3 pb-3">
          <p className="text-xs font-semibold text-muted-foreground">
            {step + 1} of {STEPS.length}
          </p>
          <DialogTitle className="text-xl font-bold tracking-tight">{LEGAL_TITLES[doc]}</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">Last updated {legalVersionLabel(currentLegalVersion(doc).version)}</DialogDescription>
        </div>

        <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto [overflow-anchor:none] border-y border-border px-5 py-6" tabIndex={0} aria-label={`${LEGAL_TITLES[doc]} text`}>
          {Content ? (
            <>
              <div className="space-y-10">
                <Content />
              </div>
              <div ref={end} className="h-px" />
            </>
          ) : (
            <Loading />
          )}
        </div>

        <div className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground" aria-live="polite">
            {done ? (
              last ? "Thanks for reading both." : `Next, the ${LEGAL_TITLES[STEPS[step + 1]!.doc]}.`
            ) : (
              <>
                <ArrowDown className="size-3.5 animate-bounce" aria-hidden /> Scroll to the end to continue
              </>
            )}
          </p>
          <div className="flex gap-2">
            {step > 0 && (
              <Button variant="outline" onClick={() => setStep(step - 1)} disabled={busy}>
                Back
              </Button>
            )}
            <Button
              className="flex-1 sm:flex-none"
              disabled={!done}
              loading={busy}
              onClick={() => (last ? void onAgree() : setStep(step + 1))}
            >
              {last ? "I agree" : "Next"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
