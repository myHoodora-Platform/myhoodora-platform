import { Avatar, AvatarFallback, AvatarImage } from "@myhoodora/ui/avatar";
import { cn } from "@myhoodora/ui/utils";
import { initialsFrom } from "@/lib/api/users";
import type { PublicProfile } from "@/lib/api/types";
import { imageUrl } from "@/lib/media/media-url";
import { badgeLabel, TIER_RING, type AvatarBadge } from "@myhoodora/api-contract/engagement";

/** Pixel size per variant, doubled for sharp avatars on high-density screens. */
const PX = { sm: 64, md: 80, lg: 128, xl: 192 } as const;

const SIZES = {
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-16 text-xl",
  xl: "size-24 text-3xl",
} as const;

export function UserAvatar({
  person,
  size = "md",
  className,
}: {
  person: Pick<PublicProfile, "displayName" | "photoURL" | "kind"> & { badge?: AvatarBadge };
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const isOrganisation = person.kind === "organisation";
  const avatar = (
    <Avatar className={cn(SIZES[size], "shrink-0", !person.badge && className)}>
      {/* Square, face-aware crop at the size shown, not the full-size upload. */}
      {person.photoURL && <AvatarImage src={imageUrl(person.photoURL, { width: PX[size], aspect: 1 })} alt="" />}
      {/* No photo (or it won't load): a business keeps its initials, a person gets the default avatar. */}
      <AvatarFallback className={cn("font-bold", isOrganisation && "bg-primary text-primary-foreground")}>
        {isOrganisation ? initialsFrom(person.displayName) : <DefaultAvatar />}
      </AvatarFallback>
    </Avatar>
  );
  if (!person.badge) return avatar;
  return (
    <span className={cn("relative inline-flex shrink-0", className)}>
      {avatar}
      <ParticipationBadge badge={person.badge} size={size} />
    </span>
  );
}

const BADGE_SIZE = { sm: "size-4 -right-0.5 -bottom-0.5", md: "size-[18px] -right-0.5 -bottom-0.5", lg: "size-7 right-0 bottom-0", xl: "size-9 right-0.5 bottom-0.5" } as const;

/**
 * The participation badge on an avatar (plan WP-C): the app's mascot, ringed in the streak tier's colour
 * (or brand green for a Hood Builder without one). Deliberately unlike the "verified" tick, so being
 * active is never mistaken for an identity check.
 */
export function ParticipationBadge({ badge, size = "md" }: { badge: AvatarBadge; size?: keyof typeof SIZES }) {
  const label = badgeLabel(badge) ?? "Active neighbour";
  const ring = TIER_RING[badge.tier ?? "builder"];
  return (
    <span role="img" aria-label={label} title={label} className={cn("absolute overflow-hidden rounded-full bg-white", BADGE_SIZE[size])} style={{ boxShadow: `0 0 0 2px ${ring}, 0 0 0 3px var(--card, #fff)` }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- a tiny local icon */}
      <img src="/logo/app-icon.png" alt="" className="size-full object-cover" />
    </span>
  );
}

/** Head and shoulders, cropped by the round avatar; scales with it. */
function DefaultAvatar() {
  return (
    <svg viewBox="0 0 40 40" className="size-full text-primary/45" fill="currentColor" aria-hidden>
      <circle cx="20" cy="15.5" r="7.5" />
      <path d="M5 38c0-8.3 6.7-14 15-14s15 5.7 15 14v2H5z" />
    </svg>
  );
}
