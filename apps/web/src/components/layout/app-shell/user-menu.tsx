"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, Gavel, HelpCircle, LogOut, Settings, Shield, User } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@myhoodora/ui/dropdown-menu";
import { UserAvatar } from "@/components/shared/user-avatar";
import { useAuth } from "@/context/AuthContext";
import { useLeadStatus } from "@/hooks/use-lead-status";
import { useViewer } from "@/hooks/use-neighbourhood";
import { resolveAuthor } from "@/lib/api/users";
import { USE_MOCKS } from "@/lib/api/config";
import { ROUTES } from "@/lib/routes";
import { isStaff } from "@/lib/auth/profile";

export function useLogout() {
  const router = useRouter();
  const { logout } = useAuth();
  return async () => {
    try {
      await logout();
      router.push(ROUTES.login);
    } catch (err) {
      console.error("Failed to log out:", err);
    }
  };
}

export function UserMenu() {
  const { user, profile } = useAuth();
  const viewer = useViewer();
  const handleLogout = useLogout();
  const lead = useLeadStatus();
  if (!user) return null;
  const staff = isStaff(profile?.role);
  const me = resolveAuthor(user.uid, viewer);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Account menu"
          className="relative flex items-center rounded-full focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
        >
          <UserAvatar person={me} className="size-11" />
          <span className="absolute -right-0.5 -bottom-0.5 flex size-5 items-center justify-center rounded-full bg-card shadow ring-1 ring-border">
            <ChevronDown className="size-3" aria-hidden />
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-bold text-foreground">{me.displayName}</p>
          <p className="truncate text-xs text-muted-foreground">{me.neighborhoodName ?? user.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={ROUTES.profile(user.uid)}>
            <User className="size-4" /> View profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={ROUTES.settings}>
            <Settings className="size-4" /> Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={ROUTES.help}>
            <HelpCircle className="size-4" /> Help centre
          </Link>
        </DropdownMenuItem>
        {lead?.isLead && (
          <DropdownMenuItem asChild>
            <Link href={ROUTES.leads}>
              <Gavel className="size-4" /> Hood Lead reviews
              {lead.waiting > 0 && <span className="ml-auto rounded-full bg-primary px-2 text-xs font-bold text-primary-foreground">{lead.waiting}</span>}
            </Link>
          </DropdownMenuItem>
        )}
        {(staff || USE_MOCKS) && (
          <DropdownMenuItem asChild>
            <Link href={ROUTES.admin}>
              <Shield className="size-4" /> Admin
              {!staff && <span className="ml-auto text-xs text-muted-foreground">preview</span>}
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => void handleLogout()}
          className="text-destructive focus:bg-destructive/10 focus:text-destructive"
        >
          <LogOut className="size-4" /> Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
