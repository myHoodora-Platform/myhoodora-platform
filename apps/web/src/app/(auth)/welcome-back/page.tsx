"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Hand, Trash2 } from "lucide-react";
import { Button } from "@myhoodora/ui/button";
import { Skeleton } from "@myhoodora/ui/skeleton";
import { useAuth } from "@/context/AuthContext";
import { errorMessage } from "@/lib/api/client";
import { isClosed, isStaff, needsAgeCheck } from "@/lib/auth/profile";
import { DEFAULT_APP_ROUTE, ROUTES } from "@/lib/routes";
import { takeOAuthResume } from "@/lib/oauth/resume";

const longDate = (iso: string) => new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" });

/**
 * /welcome-back: signing in to a closed account doesn't reopen it (as on Nextdoor). They choose:
 * reactivate, or (for a deactivated one) leave it closed and sign out. A scheduled deletion says when,
 * and reactivating cancels it. The app shell and sign-in send people here while `profile.closure` is set.
 */
export default function WelcomeBackPage() {
  const router = useRouter();
  const { user, profile, profileStatus, loading, reactivate, logout } = useAuth();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace(ROUTES.login);
    else if (profileStatus === "ready" && profile && !isClosed(profile)) {
      // Reopened: on to "Continue to myHoodora AI" if that's what sent them here (lib/oauth/resume.ts).
      router.replace(needsAgeCheck(profile) ? ROUTES.confirmAge : (takeOAuthResume() ?? (profile.isOnboarded || isStaff(profile.role) ? DEFAULT_APP_ROUTE : ROUTES.onboarding)));
    }
  }, [loading, user, profile, profileStatus, router]);

  const closure = profile?.closure;
  if (loading || !user || profileStatus !== "ready" || !closure) {
    return (
      <div className="space-y-4" aria-busy>
        <Skeleton className="mx-auto size-12 rounded-full" />
        <Skeleton className="mx-auto h-8 w-3/4" />
        <Skeleton className="h-12 w-full rounded-xl" />
      </div>
    );
  }

  const deleting = closure.kind === "deleting";

  const reopen = async () => {
    setBusy(true);
    try {
      await reactivate();
      toast.success(deleting ? "Deletion cancelled. Welcome back!" : "Your account is open again. Welcome back!");
      // The effect above moves them on once the profile says it's open.
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't reopen your account. Please try again."));
      setBusy(false);
    }
  };

  const leave = async () => {
    setBusy(true);
    await logout();
    router.replace(ROUTES.home);
  };

  return (
    <div className="space-y-6 text-center">
      <span className={`mx-auto flex size-12 items-center justify-center rounded-full ${deleting ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>
        {deleting ? <Trash2 className="size-6" aria-hidden /> : <Hand className="size-6" aria-hidden />}
      </span>
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{deleting ? "Your account is being deleted" : "Welcome back"}</h1>
        <p className="text-sm text-muted-foreground">
          {deleting ? (
            <>
              You asked us to delete your account. It will be deleted for good on <strong className="text-foreground">{longDate(closure.deleteAt)}</strong>, with your posts, listings, comments and profile. Until then you can cancel and keep everything.
            </>
          ) : (
            <>You deactivated your account on {longDate(closure.since)}. Your profile, posts and listings are hidden until you reactivate it.</>
          )}
        </p>
      </div>
      <div className="space-y-2">
        <Button className="w-full" onClick={() => void reopen()} loading={busy}>
          {deleting ? "Cancel deletion and keep my account" : "Reactivate my account"}
        </Button>
        <Button variant="outline" className="w-full" onClick={() => void leave()} disabled={busy}>
          {deleting ? "Continue deleting and sign out" : "Not now, sign out"}
        </Button>
      </div>
      <p className="border-t border-border pt-4 text-xs text-muted-foreground">
        Signed in as <span className="font-semibold text-foreground">{user.email}</span>.
      </p>
    </div>
  );
}
