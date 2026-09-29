"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BadgeCheck,
  Bell,
  ChevronRight,
  HelpCircle,
  KeyRound,
  LogOut,
  MapPin,
  MessageSquareHeart,
  Scale,
  Shield,
  ShieldAlert,
  User,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@myhoodora/ui/utils";
import { BackLink } from "@/components/shared/back-link";
import { UserAvatar } from "@/components/shared/user-avatar";
import { useLogout } from "@/components/layout/app-shell/user-menu";
import { useAuth } from "@/context/AuthContext";
import { useViewer } from "@/hooks/use-neighbourhood";
import { resolveAuthor } from "@/lib/api/users";
import { ROUTES } from "@/lib/routes";
import { FeedbackDialog } from "./feedback-dialog";

interface Section {
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
}

/** Nextdoor-style settings sections (docs/nextdoor-research.md). */
export const SETTINGS_SECTIONS: Section[] = [
  { label: "Profile", description: "Photo, name and bio", href: ROUTES.settingsProfile, icon: User },
  { label: "Account", description: "Email, password and sign-in", href: ROUTES.settingsAccount, icon: KeyRound },
  { label: "Neighbourhood", description: "Where you live and verification", href: ROUTES.settingsNeighbourhood, icon: MapPin },
  { label: "Notifications", description: "What we tell you about, and how", href: ROUTES.settingsNotifications, icon: Bell },
  { label: "Privacy & blocking", description: "Who sees your profile and can message you", href: ROUTES.settingsPrivacy, icon: Shield },
  { label: "Decisions & appeals", description: "Moderation decisions and appeals", href: ROUTES.settingsModeration, icon: Scale },
];

function Summary() {
  const { user, profile } = useAuth();
  const viewer = useViewer();
  if (!user) return null;
  const me = resolveAuthor(user.uid, viewer);
  const verified = profile?.verificationStatus === "verified";
  return (
    <Link
      href={ROUTES.profile(user.uid)}
      className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 hover:bg-muted/40"
    >
      <UserAvatar person={me} size="lg" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-lg font-bold">{me.displayName}</p>
        <p className={cn("flex items-center gap-1 text-sm", verified ? "text-primary" : "text-warning")}>
          {verified ? <BadgeCheck className="size-4" aria-hidden /> : <ShieldAlert className="size-4" aria-hidden />}
          {verified ? `Verified in ${me.neighborhoodName ?? "your neighbourhood"}` : "Address not verified"}
        </p>
        <p className="text-sm font-semibold text-primary">View your profile</p>
      </div>
      <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
    </Link>
  );
}

function SectionNav({ activeHref, desktopOnly }: { activeHref: string | null; desktopOnly?: boolean }) {
  const logout = useLogout();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const row =
    "flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/60 focus-visible:bg-muted focus-visible:outline-none";

  return (
    <nav aria-label="Settings" className="space-y-4">
      <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
        {SETTINGS_SECTIONS.map((s) => {
          const active = activeHref === s.href;
          // On the hub, the default section is only "open" on desktop; phones show a plain list.
          // Class names are written out in full so Tailwind can find them.
          const on = (styles: { always: string; desktop: string }) =>
            active ? (desktopOnly ? styles.desktop : styles.always) : "";
          return (
            <li key={s.href}>
              <Link
                href={s.href}
                aria-current={active && !desktopOnly ? "page" : undefined}
                className={cn(row, on({ always: "bg-primary/5", desktop: "lg:bg-primary/5" }))}
              >
                <span
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary",
                    on({ always: "bg-primary text-primary-foreground", desktop: "lg:bg-primary lg:text-primary-foreground" }),
                  )}
                >
                  <s.icon className="size-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn("block text-[15px] font-semibold", on({ always: "font-bold", desktop: "lg:font-bold" }))}>{s.label}</span>
                  <span className="block truncate text-sm text-muted-foreground">{s.description}</span>
                </span>
                <ChevronRight className="size-4 text-muted-foreground lg:hidden" aria-hidden />
              </Link>
            </li>
          );
        })}
      </ul>

      <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
        <li>
          <button type="button" onClick={() => setFeedbackOpen(true)} className={row}>
            <MessageSquareHeart className="size-5 text-primary" aria-hidden />
            <span className="text-[15px] font-semibold">Send feedback</span>
          </button>
        </li>
        <li>
          <Link href={ROUTES.help} className={row}>
            <HelpCircle className="size-5 text-primary" aria-hidden />
            <span className="text-[15px] font-semibold">Help centre</span>
          </Link>
        </li>
        <li>
          <button type="button" onClick={() => void logout()} className={cn(row, "text-destructive hover:bg-destructive/5")}>
            <LogOut className="size-5" aria-hidden />
            <span className="text-[15px] font-semibold">Log out</span>
          </button>
        </li>
      </ul>
      <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />
    </nav>
  );
}

/**
 * Desktop: section nav on the left, the open section on the right.
 * Phones: /settings is the list of sections; each section is its own page
 * with a back link (the pattern used by Nextdoor's and most mobile apps).
 */
export function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isHub = pathname === ROUTES.settings;
  // On desktop the hub shows the first section, so highlight it.
  const activeHref = isHub ? ROUTES.settingsProfile : pathname;

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className={cn(isHub ? "block" : "hidden lg:block")}>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
      </div>
      {!isHub && (
        <div className="lg:hidden">
          <BackLink fallback={ROUTES.settings} label="Settings" />
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <div className={cn("space-y-4", isHub ? "block" : "hidden lg:block")}>
          <Summary />
          <SectionNav activeHref={activeHref} desktopOnly={isHub} />
        </div>
        <div className={cn("min-w-0 space-y-4", isHub && "hidden lg:block")}>{children}</div>
      </div>
    </div>
  );
}
