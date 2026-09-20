"use client";

import { useAuth } from "@/context/AuthContext";
import { Avatar, AvatarFallback } from "@myhoodora/ui/avatar";
import { Badge } from "@myhoodora/ui/badge";
import { cn } from "@myhoodora/ui/utils";

export function ProfileHero() {
  const { user, profile } = useAuth();
  const initial = (profile?.displayName || user?.email || "?")
    .charAt(0)
    .toUpperCase();
  const isVerified = profile?.verificationStatus === "verified";

  return (
    <div className="relative h-44 overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-primary/70 sm:h-48">
      <div
        aria-hidden
        className="absolute inset-0 opacity-15"
        style={{
          backgroundImage: "radial-gradient(circle, #ffffff 1px, transparent 1px)",
          backgroundSize: "18px 18px",
        }}
      />
      <div className="relative z-10 flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-white">
        <Avatar
          className={cn(
            "size-20 border-4 shadow-lg",
            isVerified ? "border-emerald-300" : "border-amber-300",
          )}
        >
          <AvatarFallback className="bg-white text-2xl text-primary">
            {initial}
          </AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-lg font-bold">
            {profile?.displayName || "Your Profile"}
          </h1>
          <p className="text-xs text-white/80">{user?.email}</p>
        </div>
        <Badge variant={isVerified ? "success" : "warning"}>
          {isVerified ? "Verified Local" : "Pending Verification"}
        </Badge>
      </div>
    </div>
  );
}
