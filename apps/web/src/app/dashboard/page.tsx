"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@myhoodora/ui/button";
import { Logo } from "@myhoodora/ui/logo";
import { OnboardingGatingModal } from "@/components/shared/OnboardingGatingModal";
import { logoutUser } from "@/lib/firebase/auth";
import {
  MessageSquare,
  Users,
  Calendar,
  ShoppingBag,
  LogOut,
  MapPin,
  Heart,
  Share2,
  CheckCircle2,
} from "lucide-react";

export default function DashboardPage() {
  const router = useRouter();
  const { user, profile, loading, runGatedAction } = useAuth();
  const [successActionMsg, setSuccessActionMsg] = useState<string | null>(null);

  // Gated Actions Simulation
  const handleCreatePost = () => {
    runGatedAction(() => {
      setSuccessActionMsg("Success! Your post has been published to the neighborhood feed.");
    });
  };

  const handleJoinGroup = () => {
    runGatedAction(() => {
      setSuccessActionMsg("Success! You've joined the local neighborhood safety watch group.");
    });
  };

  const handleRSVPEvent = () => {
    runGatedAction(() => {
      setSuccessActionMsg("Success! Your RSVP for the neighborhood BBQ block party has been saved.");
    });
  };

  const handleCreateListing = () => {
    runGatedAction(() => {
      setSuccessActionMsg("Success! Your item listing has been posted to the marketplace.");
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

  // Redirect to login if user is not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  // Clear success notification after 4 seconds
  useEffect(() => {
    if (successActionMsg) {
      const timer = setTimeout(() => setSuccessActionMsg(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [successActionMsg]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const mockFeedPosts = [
    {
      author: "David Miller",
      neighborhood: "Oakwood Heights",
      time: "2 hours ago",
      content: "Has anyone seen a black cat wandering around Oakwood Lane? Friendly but didn't have a collar. Let me know if she belongs to you!",
      likes: 12,
      comments: 3,
    },
    {
      author: "Sarah Thompson",
      neighborhood: "Maple Woods",
      time: "5 hours ago",
      content: "Huge thank you to everyone who helped clean up Maple Park this morning! The neighborhood looks fantastic, and kids are already enjoying the swings.",
      likes: 34,
      comments: 8,
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-foreground font-sans">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-100 bg-white/85 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Logo size="md" />
          {profile?.isOnboarded && (
            <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold">
              <MapPin className="size-3" />
              Verified Local
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-xs font-bold text-slate-800">
              {profile?.displayName || user.email || "Neighbor"}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {profile?.isOnboarded ? profile.location?.address : "Onboarding skipped"}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="p-2 rounded-full text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors"
            title="Log out"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </header>

      {/* Main Layout Container */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-6 md:p-8 flex flex-col lg:flex-row gap-8">
        {/* Sidebar Nav */}
        <aside className="w-full lg:w-64 shrink-0 space-y-6">
          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-2">
            <button
              onClick={handleCreatePost}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50 hover:text-primary transition-colors text-left"
            >
              <MessageSquare className="size-4" />
              Neighborhood Feed
            </button>
            <button
              onClick={handleJoinGroup}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50 hover:text-primary transition-colors text-left"
            >
              <Users className="size-4" />
              Safety Watch Group
            </button>
            <button
              onClick={handleRSVPEvent}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50 hover:text-primary transition-colors text-left"
            >
              <Calendar className="size-4" />
              Community Events
            </button>
            <button
              onClick={handleCreateListing}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50 hover:text-primary transition-colors text-left"
            >
              <ShoppingBag className="size-4" />
              Marketplace Listings
            </button>
          </div>
        </aside>

        {/* Feed & Content Area */}
        <main className="flex-1 space-y-6">
          {/* Action Success Alert Toaster Simulator */}
          {successActionMsg && (
            <div className="p-4 bg-emerald-50 text-emerald-800 border border-emerald-200/60 text-sm font-bold rounded-xl flex items-center gap-2.5 animate-in slide-in-from-top-4 duration-300">
              <CheckCircle2 className="size-5 shrink-0 text-emerald-600" />
              <span>{successActionMsg}</span>
            </div>
          )}

          {/* Quick Create Post Panel */}
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
            <h3 className="text-base font-black tracking-tight">Share something with your neighbors</h3>
            <div className="flex gap-4">
              <input
                type="text"
                placeholder="What's going on in the neighborhood?"
                onClick={handleCreatePost}
                readOnly
                className="flex-1 px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 text-sm focus:outline-none cursor-pointer hover:bg-slate-100/50 transition-colors"
              />
              <Button onClick={handleCreatePost}>Post</Button>
            </div>
          </div>

          {/* Feed Posts */}
          <div className="space-y-4">
            {mockFeedPosts.map((post, idx) => (
              <article
                key={idx}
                className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-black text-slate-800">{post.author}</h4>
                    <p className="text-[10px] text-muted-foreground">
                      {post.neighborhood} • {post.time}
                    </p>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                    General
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-slate-600">{post.content}</p>
                <div className="flex items-center gap-6 pt-2 border-t border-slate-100 text-slate-400">
                  <button className="flex items-center gap-1.5 text-xs hover:text-rose-500 transition-colors">
                    <Heart className="size-4" />
                    {post.likes}
                  </button>
                  <button className="flex items-center gap-1.5 text-xs hover:text-primary transition-colors">
                    <MessageSquare className="size-4" />
                    {post.comments}
                  </button>
                  <button className="flex items-center gap-1.5 text-xs hover:text-slate-600 transition-colors ml-auto">
                    <Share2 className="size-4" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        </main>
      </div>

      {/* Global Gating Modal */}
      <OnboardingGatingModal />
    </div>
  );
}
