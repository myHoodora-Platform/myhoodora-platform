"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Link2, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import * as postsApi from "@/lib/api/posts";
import { ROUTES } from "@/lib/routes";
import type { Post } from "@/lib/api/types";
import { clearSharedVisit, readSharedVisit } from "./shared-visit";

/**
 * After joining from a shared link, the post they came from, offered back once at the top of their
 * own feed: open it when its audience includes them, otherwise say why they can't read it.
 */
export function CameFromCard() {
  const { user, profile } = useAuth();
  const [post, setPost] = useState<Post | null>(null);
  const [hoodName, setHoodName] = useState<string | undefined>();

  useEffect(() => {
    const visit = readSharedVisit();
    if (!user || !profile?.neighborhoodId || !visit) return;
    setHoodName(visit.hoodName);
    let live = true;
    postsApi
      .getPost(user, profile.neighborhoodId, visit.postId)
      .then((p) => {
        if (!live) return;
        if (p) setPost(p);
        else clearSharedVisit();
      })
      .catch(() => clearSharedVisit()); // Removed, or never theirs to see: nothing to offer.
    return () => {
      live = false;
    };
  }, [user, profile?.neighborhoodId]);

  if (!post) return null;
  const dismiss = () => {
    clearSharedVisit();
    setPost(null);
  };
  const from = post.author?.neighborhoodName ?? hoodName ?? "another neighbourhood";
  const ownHood = post.neighborhoodId === profile?.neighborhoodId;

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4 text-sm">
      <Link2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
      <div className="min-w-0 flex-1">
        {post.access === "teaser" ? (
          <p>
            <span className="font-semibold">You came from a post in {from}.</span> Only neighbours there can read it in full. Here&apos;s what&apos;s happening near you.
          </p>
        ) : (
          <p>
            <span className="font-semibold">{ownHood ? "The post you were looking at is from your neighbourhood." : `You came from a post in ${from}.`}</span>{" "}
            <Link href={ROUTES.post(post._id)} onClick={clearSharedVisit} className="font-semibold text-primary hover:underline">
              Open it
            </Link>
          </p>
        )}
      </div>
      <button type="button" onClick={dismiss} className="rounded-full p-1 text-muted-foreground hover:bg-muted" aria-label="Dismiss">
        <X className="size-4" />
      </button>
    </div>
  );
}
