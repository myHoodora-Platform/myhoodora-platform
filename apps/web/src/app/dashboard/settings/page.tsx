"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@myhoodora/ui/breadcrumb";
import { Badge } from "@myhoodora/ui/badge";
import { ProfileHero } from "@/components/settings/profile-hero";
import { SettingsListRow } from "@/components/settings/settings-list-row";
import {
  User as UserIcon,
  MapPin,
  Bell,
  MessageSquareHeart,
  LogOut,
} from "lucide-react";
import { fetchNeighborhood } from "@/lib/firebase/auth";

export default function SettingsPage() {
  const router = useRouter();
  const { user, profile, logout } = useAuth();
  const [neighborhoodName, setNeighborhoodName] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (!user || !profile?.neighborhoodId) return;
    fetchNeighborhood(user, profile.neighborhoodId)
      .then((n) => setNeighborhoodName(n ? `${n.name}, ${n.city}` : null))
      .catch((err) => console.error("Failed to fetch neighborhood:", err));
  }, [user, profile?.neighborhoodId]);

  const handleLogout = async () => {
    try {
      await logout();
      router.push("/login");
    } catch (err) {
      console.error("Failed to log out:", err);
    }
  };

  return (
    <div className="space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Settings</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <ProfileHero />

      <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <SettingsListRow
          icon={UserIcon}
          label="Account"
          description="Name and profile details"
          href="/dashboard/settings/account"
        />
        <SettingsListRow
          icon={MapPin}
          label="Neighbourhood"
          description={
            neighborhoodName ??
            (profile?.neighborhoodId ? "Loading..." : "Not verified yet")
          }
        />
        <SettingsListRow
          icon={Bell}
          label="Notifications"
          trailing={<Badge variant="secondary">Coming soon</Badge>}
        />
        <SettingsListRow
          icon={MessageSquareHeart}
          label="Feedback"
          trailing={<Badge variant="secondary">Coming soon</Badge>}
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <SettingsListRow icon={LogOut} label="Log out" onClick={handleLogout} destructive />
      </div>
    </div>
  );
}
