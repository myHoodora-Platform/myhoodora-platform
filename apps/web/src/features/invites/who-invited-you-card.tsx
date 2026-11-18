"use client";

import { useEffect, useState } from "react";
import { HeartHandshake, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@myhoodora/ui/button";
import { ApiError } from "@myhoodora/api-contract/errors";
import { normaliseInviteCode } from "@myhoodora/api-contract/invites";
import { useAuth } from "@/context/AuthContext";
import { UserAvatar } from "@/components/shared/user-avatar";
import { claimInvite, dismissWhoInvited } from "@/lib/api/invites";
import { searchNeighbours } from "@/lib/api/groups";
import { patchInvites, useInviteSummary } from "./use-invites";

type Neighbour = Awaited<ReturnType<typeof searchNeighbours>>[number];

/**
 * Path 7 of the referral plan: asked once of everyone who joined since the challenge began without a
 * code. Type the code from the poster or message, or pick the neighbour from your Hood. Optional.
 */
export function WhoInvitedYouCard() {
  const { user } = useAuth();
  const summary = useInviteSummary(user?.uid);
  const [mode, setMode] = useState<"code" | "neighbour">("code");
  const [code, setCode] = useState("");
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState<Neighbour[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || mode !== "neighbour" || query.trim().length < 2) {
      setPeople([]);
      return;
    }
    let live = true;
    const t = setTimeout(() => {
      searchNeighbours(user, query.trim())
        .then((found) => live && setPeople(found.filter((p) => p.kind !== "organisation").slice(0, 6)))
        .catch(() => live && setPeople([]));
    }, 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [user, mode, query]);

  if (!user || !summary?.askWhoInvited) return null;

  const send = async (input: { code?: string; uid?: string }) => {
    setBusy(true);
    setError(null);
    try {
      const { invitedBy } = await claimInvite(user, { ...input, via: "asked" });
      patchInvites({ askWhoInvited: false, invitedBy });
      toast.success(`Thanks! ${invitedBy.name} gets the credit for inviting you.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "That didn't go through. Try again.");
    } finally {
      setBusy(false);
    }
  };
  const dismiss = () => {
    patchInvites({ askWhoInvited: false });
    void dismissWhoInvited(user).catch(() => undefined);
  };
  const typed = normaliseInviteCode(code);

  return (
    <section aria-labelledby="who-invited" className="rounded-2xl border border-primary/30 bg-primary/5 p-4 text-sm">
      <div className="flex items-start gap-3">
        <HeartHandshake className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
        <div className="min-w-0 flex-1">
          <h2 id="who-invited" className="font-semibold">
            Did a neighbour invite you?
          </h2>
          <p className="mt-0.5 text-muted-foreground">Tell us who, and they get the credit for building up the neighbourhood. You can skip this.</p>
        </div>
        <button type="button" onClick={dismiss} className="rounded-full p-1 text-muted-foreground hover:bg-muted" aria-label="No one invited me. Close">
          <X className="size-4" />
        </button>
      </div>

      <div role="tablist" aria-label="How to say who" className="mt-3 inline-flex rounded-full bg-muted p-1 text-xs font-semibold">
        {(
          [
            ["code", "I have their code"],
            ["neighbour", "Find them by name"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={mode === key}
            onClick={() => {
              setMode(key);
              setError(null);
            }}
            className={mode === key ? "rounded-full bg-background px-3 py-1.5 shadow-sm" : "px-3 py-1.5 text-muted-foreground"}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === "code" ? (
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (typed) void send({ code: typed });
          }}
        >
          <label htmlFor="invite-code" className="sr-only">
            Invite code
          </label>
          <input
            id="invite-code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="e.g. ADA7K"
            autoComplete="off"
            autoCapitalize="characters"
            maxLength={14}
            className="h-10 min-w-0 flex-1 rounded-xl border border-border bg-background px-3 font-mono tracking-widest uppercase"
          />
          <Button type="submit" disabled={!typed || busy}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </form>
      ) : (
        <div className="mt-3">
          <label htmlFor="invite-who" className="sr-only">
            Neighbour&apos;s name
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              id="invite-who"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Their name"
              autoComplete="off"
              className="h-10 w-full rounded-xl border border-border bg-background pr-3 pl-9"
            />
          </div>
          {people.length > 0 && (
            <ul className="mt-2 divide-y divide-border overflow-hidden rounded-xl border border-border bg-background">
              {people.map((p) => (
                <li key={p.uid}>
                  <button type="button" disabled={busy} onClick={() => void send({ uid: p.uid })} className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted disabled:opacity-60">
                    <UserAvatar person={p} size="sm" />
                    <span className="truncate font-medium">{p.displayName}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {query.trim().length >= 2 && people.length === 0 && <p className="mt-2 text-xs text-muted-foreground">No neighbour by that name in your Hood yet. Try their code instead.</p>}
        </div>
      )}
      {error && (
        <p role="alert" className="mt-2 text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
