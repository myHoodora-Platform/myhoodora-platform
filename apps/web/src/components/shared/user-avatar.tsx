import { Avatar, AvatarFallback, AvatarImage } from "@myhoodora/ui/avatar";
import { cn } from "@myhoodora/ui/utils";
import { initialsFrom } from "@/lib/api/users";
import type { PublicProfile } from "@/lib/api/types";
import { imageUrl } from "@/lib/media/media-url";

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
  person: Pick<PublicProfile, "displayName" | "photoURL" | "kind">;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const isOrganisation = person.kind === "organisation";
  return (
    <Avatar className={cn(SIZES[size], "shrink-0", className)}>
      {/* Square, face-aware crop at the size shown, not the full-size upload. */}
      {person.photoURL && <AvatarImage src={imageUrl(person.photoURL, { width: PX[size], aspect: 1 })} alt="" />}
      {/* No photo (or it won't load): a business keeps its initials, a person gets the default avatar. */}
      <AvatarFallback className={cn("font-bold", isOrganisation && "bg-primary text-primary-foreground")}>
        {isOrganisation ? initialsFrom(person.displayName) : <DefaultAvatar />}
      </AvatarFallback>
    </Avatar>
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
