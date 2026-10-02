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
  return (
    <Avatar className={cn(SIZES[size], "shrink-0", className)}>
      {/* Square, face-aware crop at the size shown, not the full-size upload. */}
      {person.photoURL && <AvatarImage src={imageUrl(person.photoURL, { width: PX[size], aspect: 1 })} alt="" />}
      <AvatarFallback
        className={cn(
          "font-bold",
          person.kind === "organisation" && "bg-primary text-primary-foreground",
        )}
      >
        {initialsFrom(person.displayName)}
      </AvatarFallback>
    </Avatar>
  );
}
