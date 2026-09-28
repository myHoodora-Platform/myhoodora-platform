import { Avatar, AvatarFallback, AvatarImage } from "@myhoodora/ui/avatar";
import { cn } from "@myhoodora/ui/utils";
import { initialsFrom } from "@/lib/api/users";
import type { PublicProfile } from "@/lib/api/types";

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
      {person.photoURL && <AvatarImage src={person.photoURL} alt="" />}
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
