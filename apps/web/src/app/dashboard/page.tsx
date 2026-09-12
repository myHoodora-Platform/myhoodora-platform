"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@myhoodora/ui/button";
import { Heart, MessageSquare, Share2 } from "lucide-react";
import { Skeleton } from "@myhoodora/ui/skeleton";

interface MockPost {
  author: string;
  neighborhood: string;
  time: string;
  content: string;
  likes: number;
  comments: number;
}

const mockFeedPosts: MockPost[] = [
  {
    author: "David Miller",
    neighborhood: "Oakwood Heights",
    time: "2 hours ago",
    content:
      "Has anyone seen a black cat wandering around Oakwood Lane? Friendly but didn't have a collar. Let me know if she belongs to you!",
    likes: 12,
    comments: 3,
  },
  {
    author: "Sarah Thompson",
    neighborhood: "Maple Woods",
    time: "5 hours ago",
    content:
      "Huge thank you to everyone who helped clean up Maple Park this morning! The neighborhood looks fantastic, and kids are already enjoying the swings.",
    likes: 34,
    comments: 8,
  },
];

export default function DashboardFeedPage() {
  const { runGatedAction } = useAuth();
  const [successActionMsg, setSuccessActionMsg] = useState<string | null>(null);
  const [posts, setPosts] = useState<MockPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);

  const handleCreatePost = () => {
    runGatedAction(() => {
      setSuccessActionMsg(
        "Success! Your post has been published to the neighborhood feed.",
      );
    });
  };

  useEffect(() => {
    if (successActionMsg) {
      const timer = setTimeout(() => setSuccessActionMsg(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [successActionMsg]);

  useEffect(() => {
    // Simulate real database/network fetch timing (e.g., 600ms)
    const timer = setTimeout(() => {
      setPosts(mockFeedPosts);
      setLoadingPosts(false);
    }, 600);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="space-y-6">
      {successActionMsg && (
        <div className="p-4 bg-emerald-50 text-emerald-800 border border-emerald-200/60 text-sm font-bold rounded-xl flex items-center gap-2.5 animate-in slide-in-from-top-4 duration-300">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2.5}
            stroke="currentColor"
            className="size-5 text-emerald-600 shrink-0"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
            />
          </svg>
          <span>{successActionMsg}</span>
        </div>
      )}

      {/* Quick Create Post Panel */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
        <h3 className="text-base font-black tracking-tight">
          Share something with your neighbors
        </h3>
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
        {loadingPosts ? (
          <>
            {[1, 2].map((i) => (
              <div
                key={i}
                className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4"
              >
                <div className="flex items-center gap-3">
                  <Skeleton className="size-10 rounded-full shrink-0" />
                  <div className="space-y-1.5 flex-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                </div>
              </div>
            ))}
          </>
        ) : (
          posts.map((post, idx) => (
            <article
              key={idx}
              className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-black text-slate-800">
                    {post.author}
                  </h4>
                  <p className="text-[10px] text-muted-foreground">
                    {post.neighborhood} • {post.time}
                  </p>
                </div>
                <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                  General
                </span>
              </div>
              <p className="text-sm leading-relaxed text-slate-600">
                {post.content}
              </p>
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
          ))
        )}
      </div>
    </div>
  );
}
