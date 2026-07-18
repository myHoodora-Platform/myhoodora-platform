"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Logo } from "@myhoodora/ui/logo";
import {
  SidebarProvider,
  Sidebar,
  SidebarTrigger,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from "@myhoodora/ui/sidebar";
import { OnboardingGatingModal } from "@/components/shared/OnboardingGatingModal";
import { logoutUser } from "@/lib/firebase/auth";
import {
  MessageSquare,
  Users,
  Calendar,
  ShoppingBag,
  LogOut,
  MapPin,
  CheckCircle2,
} from "lucide-react";
import { Skeleton } from "@myhoodora/ui/skeleton";

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, profile, loading, runGatedAction } = useAuth();
  const { state } = useSidebar();
  const [successActionMsg, setSuccessActionMsg] = useState<string | null>(null);

  // Gated Actions simulation
  const handleGatedNav = (actionName: string, successText: string) => {
    runGatedAction(() => {
      setSuccessActionMsg(successText);
    });
  };

  const handleLogout = async () => {
    try {
      await logoutUser();
      router.push("/login");
    } catch (err) {
      console.error("Failed to log out:", err);
    }
  };

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (successActionMsg) {
      const timer = setTimeout(() => setSuccessActionMsg(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [successActionMsg]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex bg-slate-50 font-sans">
        {/* Persistent Desktop Sidebar Skeleton */}
        <aside className="w-64 bg-white border-r border-slate-100 p-6 flex flex-col justify-between hidden lg:flex shrink-0">
          <div className="space-y-8">
            <Skeleton className="h-8 w-32" />
            <div className="space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="size-5 rounded-md" />
                  <Skeleton className="h-4 w-32" />
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="size-10 rounded-full" />
            <div className="space-y-1.5 flex-1">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        </aside>

        {/* Main Content Area Skeleton */}
        <div className="flex-1 flex flex-col min-h-screen">
          <header className="h-16 border-b border-slate-100 bg-white px-6 flex items-center justify-between">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </header>
          <main className="flex-1 p-6 max-w-4xl w-full mx-auto space-y-6">
            {/* Quick Post Box Skeleton */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs space-y-4">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-12 w-full" />
            </div>

            {/* Feed Items Skeletons */}
            {[1, 2].map((i) => (
              <div key={i} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs space-y-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="size-10 rounded-full" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
              </div>
            ))}
          </main>
        </div>
      </div>
    );
  }

  const isCollapsed = state === "collapsed";

  const navigationItems = [
    {
      name: "Neighborhood Feed",
      icon: <MessageSquare className="size-4" />,
      onClick: () => handleGatedNav("Neighborhood Feed", "Feed accessed"),
    },
    {
      name: "Safety Watch Group",
      icon: <Users className="size-4" />,
      onClick: () => handleGatedNav("Safety Watch Group", "Group joined"),
    },
    {
      name: "Community Events",
      icon: <Calendar className="size-4" />,
      onClick: () => handleGatedNav("Community Events", "Event RSVPed"),
    },
    {
      name: "Marketplace Listings",
      icon: <ShoppingBag className="size-4" />,
      onClick: () => handleGatedNav("Marketplace Listings", "Listing created"),
    },
  ];

  return (
    <div className="flex-1 flex min-h-screen relative bg-slate-50">
      {/* Sidebar Component */}
      <Sidebar>
        <SidebarHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2 overflow-hidden">
            <Logo size="sm" className={isCollapsed ? "scale-90" : ""} />
            {!isCollapsed && <span className="text-[10px] font-extrabold text-primary tracking-widest uppercase bg-primary/5 px-2 py-0.5 rounded-md">V0.1</span>}
          </div>
          {!isCollapsed && <SidebarTrigger className="hidden lg:inline-flex" />}
        </SidebarHeader>

        <SidebarContent>
          <SidebarMenu>
            {navigationItems.map((item, idx) => (
              <SidebarMenuItem key={idx}>
                <SidebarMenuButton
                  tooltip={item.name}
                  onClick={item.onClick}
                  className="hover:bg-slate-50 text-slate-700 font-bold"
                >
                  {item.icon}
                  {!isCollapsed && <span>{item.name}</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>

        <SidebarFooter className="space-y-4">
          {/* User profile details bubble in footer */}
          {!isCollapsed ? (
            <div className="flex items-start gap-2.5 p-1 rounded-xl bg-slate-50/50 border border-slate-100/50">
              <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-black shrink-0">
                {(profile?.displayName || user.email || "?").charAt(0).toUpperCase()}
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-bold text-slate-800 truncate">
                  {profile?.displayName || user.email}
                </p>
                <p className="text-[9px] text-muted-foreground truncate">
                  {profile?.isOnboarded ? profile.location?.address : "Onboarding skipped"}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex justify-center">
              <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-black">
                {(profile?.displayName || user.email || "?").charAt(0).toUpperCase()}
              </div>
            </div>
          )}

          {/* Logout Button */}
          <SidebarMenuButton
            onClick={handleLogout}
            tooltip="Logout Account"
            className="text-muted-foreground hover:text-destructive"
          >
            <LogOut className="size-4" />
            {!isCollapsed && <span>Log out</span>}
          </SidebarMenuButton>
        </SidebarFooter>
      </Sidebar>

      {/* Main Body content structure */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Sticky Mobile/Desktop Content Header */}
        <header className="sticky top-0 z-30 w-full border-b border-slate-100 bg-white/80 backdrop-blur-md px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <SidebarTrigger className="lg:hidden" />
            {isCollapsed && <SidebarTrigger className="hidden lg:inline-flex" />}
            <span className="text-base font-black tracking-tight text-slate-800 hidden sm:inline-block">
              Neighborhood Dashboard
            </span>
          </div>

          <div className="flex items-center gap-4">
            {profile?.isOnboarded ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold">
                <MapPin className="size-3" />
                Verified Local
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 text-xs font-bold">
                Pending Verification
              </span>
            )}
          </div>
        </header>

        {/* Dynamic Children Content Page */}
        <main className="flex-1 p-6 md:p-8 max-w-5xl w-full mx-auto space-y-6">
          {successActionMsg && (
            <div className="p-4 bg-emerald-50 text-emerald-800 border border-emerald-200/60 text-sm font-bold rounded-xl flex items-center gap-2.5 animate-in slide-in-from-top-4 duration-300 mb-6">
              <CheckCircle2 className="size-5 shrink-0 text-emerald-600" />
              <span>{successActionMsg}</span>
            </div>
          )}
          {children}
        </main>
      </div>

      {/* Global Onboarding Gating Modal */}
      <OnboardingGatingModal />
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <DashboardLayoutContent>{children}</DashboardLayoutContent>
    </SidebarProvider>
  );
}
