"use client";

import { useEffect, useState } from "react";
import { Check, Copy, MessageCircle, Printer, Share2, UserPlus } from "lucide-react";
import Link from "next/link";
import { ROUTES } from "@/lib/routes";
import { toast } from "sonner";
import { Button } from "@myhoodora/ui/button";
import { BUILDER_INVITES } from "@myhoodora/api-contract/invites";
import { useAuth } from "@/context/AuthContext";
import { ProblemState } from "@/components/shared/connection-states";
import { isLive } from "@/lib/api/config";
import { useNeighbourhood } from "@/hooks/use-neighbourhood";
import { timeAgo } from "@/lib/time";
import { loadInvites, useInviteSummary } from "./use-invites";

/**
 * Invite neighbours (plan WP-E): their code and personal link, WhatsApp first, how many joined and
 * verified (only verified count), and who. Like Nextdoor's invite page, without anyone's address.
 */
export function InvitePage() {
  const { user } = useAuth();
  const hoodName = useNeighbourhood()?.name;
  const summary = useInviteSummary(user?.uid);
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState<"code" | "link" | null>(null);

  useEffect(() => {
    if (!user || !isLive("invites")) return;
    // Fresh numbers each visit.
    loadInvites(user).catch(() => setFailed(true));
  }, [user]);

  const retry = () => {
    if (user) void loadInvites(user).then(() => setFailed(false), () => setFailed(true));
  };
  if (!isLive("invites")) return <p className="rounded-2xl bg-card p-6 text-sm text-muted-foreground ring-1 ring-border">Invites need the live app. Turn off preview mode to invite neighbours.</p>;
  if (failed && !summary) return <ProblemState title="Couldn't load your invites" message="Check your connection and try again." kind={null} onRetry={retry} />;
  if (!summary) return <div className="h-64 animate-pulse rounded-2xl bg-muted" aria-label="Loading" />;

  const hood = hoodName;
  const message = `Join me on myHoodora${hood ? `, the app for ${hood}` : ""}: safety alerts, trusted recommendations and things for sale near us. ${summary.link}\n\nMy invite code: ${summary.code}`;
  const copy = async (what: "code" | "link") => {
    try {
      await navigator.clipboard.writeText(what === "code" ? summary.code : summary.link);
      setCopied(what);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      toast.error("Couldn't copy.");
    }
  };
  const share = async () => {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "Join me on myHoodora", text: message });
      } catch {
        // Cancelled.
      }
    } else await copy("link");
  };
  const toBuilder = Math.max(0, BUILDER_INVITES - summary.verified);

  return (
    <div className="space-y-4">
      <section className="rounded-2xl bg-card p-5 ring-1 ring-border sm:p-6">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
            <UserPlus className="size-5" aria-hidden />
          </span>
          <div>
            <h1 className="text-xl font-bold">Invite neighbours</h1>
            <p className="text-sm text-muted-foreground">{hood ? `Help ${hood} come alive.` : "Bring your neighbours in."} Everyone who joins with your code is counted once they verify their address.</p>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-4 text-center">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Your invite code</p>
          <p className="mt-1 font-mono text-4xl font-bold tracking-[0.25em]">{summary.code}</p>
          <button type="button" onClick={() => void copy("code")} className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
            {copied === "code" ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />} {copied === "code" ? "Copied" : "Copy code"}
          </button>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <a
            href={`https://wa.me/?text=${encodeURIComponent(message)}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#1fa855] px-4 text-sm font-semibold text-white hover:bg-[#1a9049]"
          >
            <MessageCircle className="size-4" aria-hidden /> WhatsApp
          </a>
          <Button variant="outline" onClick={() => void copy("link")}>
            {copied === "link" ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />} {copied === "link" ? "Link copied" : "Copy link"}
          </Button>
          <Button variant="outline" onClick={() => void share()}>
            <Share2 className="size-4" aria-hidden /> More ways
          </Button>
        </div>
        <Link href={`${ROUTES.invite}/poster`} className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-dashed border-border py-2.5 text-sm font-semibold hover:bg-muted">
          <Printer className="size-4" aria-hidden /> Print a QR poster for your estate gate or notice board
        </Link>
        <p className="mt-3 text-center text-xs text-muted-foreground">Posts you share carry your code too, so they count as invites.</p>
      </section>

      <section aria-labelledby="invite-progress" className="rounded-2xl bg-card p-5 ring-1 ring-border sm:p-6">
        <h2 id="invite-progress" className="font-semibold">
          Your neighbours
        </h2>
        <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
          {(
            [
              ["Joined", summary.joined],
              ["Verified", summary.verified],
              [hood ? `In ${hood}` : "In your Hood", summary.verifiedInMyHood],
            ] as const
          ).map(([label, n]) => (
            <div key={label} className="rounded-xl bg-muted/60 p-3">
              <dd className="text-2xl font-bold">{n}</dd>
              <dt className="truncate text-xs text-muted-foreground">{label}</dt>
            </div>
          ))}
        </dl>
        <div className="mt-4">
          <div className="flex justify-between text-sm">
            <span className="font-semibold">Hood Builder</span>
            <span className="text-muted-foreground">
              {Math.min(summary.verified, BUILDER_INVITES)} of {BUILDER_INVITES} verified
            </span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={BUILDER_INVITES} aria-valuenow={Math.min(summary.verified, BUILDER_INVITES)} aria-label="Verified invites towards Hood Builder">
            <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${(Math.min(summary.verified, BUILDER_INVITES) / BUILDER_INVITES) * 100}%` }} />
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {toBuilder ? `${toBuilder} more verified ${toBuilder === 1 ? "neighbour" : "neighbours"} to become a Hood Builder in the launch challenge.` : "You've reached Hood Builder. Thank you for building up your neighbourhood!"}
          </p>
        </div>

        {summary.people.length > 0 ? (
          <ul className="mt-4 divide-y divide-border">
            {summary.people.map((p, i) => (
              <li key={`${p.name}-${p.joinedAt}-${i}`} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{p.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    Joined {timeAgo(p.joinedAt)}
                    {p.hoodName ? ` · ${p.hoodName}` : ""}
                  </span>
                </span>
                <span className={p.verified ? "rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary" : "rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"}>
                  {p.verified ? "Verified" : "Verifying"}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">Nobody yet. Send your link on your estate or street WhatsApp group: that&apos;s where most neighbours join from.</p>
        )}
        {summary.invitedBy && <p className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">You were invited by {summary.invitedBy.name}.</p>}
      </section>
    </div>
  );
}
