"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Download, MessageCircle, Printer, Share2, UserPlus } from "lucide-react";
import Link from "next/link";
import { ROUTES } from "@/lib/routes";
import { toast } from "sonner";
import { Button } from "@myhoodora/ui/button";
import { badgePath, badgeShareText, BUILDER_INVITES } from "@myhoodora/api-contract/invites";
import { useAuth } from "@/context/AuthContext";
import { ProblemState } from "@/components/shared/connection-states";
import { isLive } from "@/lib/api/config";
import { useNeighbourhood } from "@/hooks/use-neighbourhood";
import { timeAgo } from "@/lib/time";
import { loadInvites, useEngagement, useInviteSummary } from "./use-invites";
import { ParticipationBadge } from "@/components/shared/user-avatar";
import { badgeLabel, STREAK_TIER_AT } from "@myhoodora/api-contract/engagement";

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

  return (
    <div className="space-y-4">
      <section className="rounded-2xl bg-card p-5 ring-1 ring-border sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <UserPlus className="size-5" aria-hidden />
          </span>
          <div>
            <h1 className="text-xl font-bold">Invite neighbours</h1>
            <p className="text-sm text-muted-foreground">{hood ? `Help ${hood} come alive.` : "Bring your neighbours in."} Everyone who joins with your code is counted once they verify their address.</p>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-4 text-center">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Your invite code</p>
          <p className="mt-1 pl-[0.25em] text-4xl leading-tight font-bold tracking-[0.25em]">{summary.code}</p>
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
        <ChallengeProgress uid={user?.uid} fallbackInvites={summary.verified} code={summary.code} link={summary.link} hoodName={hood} />

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

function Bar({ value, max, label }: { value: number; max: number; label: string }) {
  const v = Math.min(value, max);
  return (
    <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={v} aria-label={label}>
      <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${(v / max) * 100}%` }} />
    </div>
  );
}

/**
 * The launch challenge (plan WP-C): Hood Builder by either path (verified invites, or active days), and
 * the streak. Counted back to the day the challenge began.
 */
function ChallengeProgress({ uid, fallbackInvites, code, link, hoodName }: { uid?: string; fallbackInvites: number; code: string; link: string; hoodName?: string }) {
  const e = useEngagement(uid);
  const label = badgeLabel(e?.badge);
  const c = e?.challenge;
  const minInvites = c?.minInvites ?? BUILDER_INVITES;
  return (
    <div className="mt-4 space-y-4 rounded-2xl bg-muted/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{c?.name ?? "myHoodora Launch Challenge"}</p>
          <p className="text-xs text-muted-foreground">
            {c?.builder ? "You're a Hood Builder. Thank you for building up your neighbourhood!" : c && !c.active ? "The challenge has ended." : "Become a Hood Builder: either path counts."}
          </p>
        </div>
        {e?.badge && (
          <span className="relative mt-1 size-9 shrink-0">
            <ParticipationBadge badge={e.badge} size="xl" />
          </span>
        )}
      </div>
      <div className="space-y-1.5">
        <div className="flex justify-between text-sm">
          <span>Neighbours who joined and verified</span>
          <span className="text-muted-foreground tabular-nums">
            {Math.min(c?.invites ?? fallbackInvites, minInvites)} of {minInvites}
          </span>
        </div>
        <Bar value={c?.invites ?? fallbackInvites} max={minInvites} label="Verified invites towards Hood Builder" />
      </div>
      {c && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-sm">
            <span>Days active</span>
            <span className="text-muted-foreground tabular-nums">
              {Math.min(c.activeDays, c.minActiveDays)} of {c.minActiveDays}
            </span>
          </div>
          <Bar value={c.activeDays} max={c.minActiveDays} label="Active days towards Hood Builder" />
        </div>
      )}
      {e?.streak && (
        <p className="text-sm">
          <span className="font-semibold">{e.streak.current}-day streak</span>
          <span className="text-muted-foreground">
            {" "}
            · best {e.streak.best}
            {e.streak.toNextTier ? ` · ${e.streak.toNextTier} more ${e.streak.toNextTier === 1 ? "day" : "days"} to ${e.streak.current >= STREAK_TIER_AT.silver ? "gold" : e.streak.current >= STREAK_TIER_AT.bronze ? "silver" : "bronze"}` : " · gold"}
            {e.streak.activeToday ? " · done for today ✓" : ""}
          </span>
        </p>
      )}
      <p className="text-xs text-muted-foreground">A day counts when you post, reply, vote or RSVP; reactions don&apos;t. One missed day a week doesn&apos;t break a streak.</p>
      {label && (
        // "Share my badge": a link whose WhatsApp preview is the badge card, or the card itself for a Status.
        <div className="flex flex-wrap gap-2 border-t border-border pt-3">
          <a
            href={`https://wa.me/?text=${encodeURIComponent(badgeShareText(label, hoodName, `${link}/badge`))}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#1fa855] px-4 text-sm font-semibold text-white hover:bg-[#1a9049]"
          >
            <MessageCircle className="size-4" aria-hidden /> Share my badge
          </a>
          <a href={`${badgePath(code)}/opengraph-image`} download={`myhoodora-badge-${code}.png`} className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold hover:bg-muted">
            <Download className="size-4" aria-hidden /> Save image
          </a>
        </div>
      )}
    </div>
  );
}
