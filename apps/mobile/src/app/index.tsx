import { Redirect, type Href } from "expo-router";
import { useAuth } from "@/core/auth/auth-provider";
import { isNewAccount, type SessionPhase } from "@/core/auth/session-phase";
import { BrandedLoading } from "@/shared/ui/branded-loading";

/**
 * "/" (app launch): straight to the screen this session may see. A redirect to a guarded route the
 * session can't open is refused and leaves "/" blank, so the target follows the phase.
 */
const START: Record<SessionPhase, Href | null> = {
  bootstrapping: null, // the splash screen is still up
  profileLoading: null, // the splash at launch; after signing in, the branded screen below
  intro: "/intro",
  signedOut: "/welcome",
  profileError: "/session-error",
  needsOnboarding: "/onboarding",
  ready: "/news-feed",
};

export default function Index() {
  const { phase, user } = useAuth();
  const target = START[phase];
  if (target) return <Redirect href={target} />;
  // Right after "Create account" or "Log in", once the splash screen is long gone: say what's happening.
  if (phase === "profileLoading") return <BrandedLoading message={isNewAccount(user) ? "Creating your account…" : "Signing you in…"} />;
  return null;
}
