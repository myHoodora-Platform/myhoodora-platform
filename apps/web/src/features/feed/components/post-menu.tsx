"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Flag, Link2, MoreHorizontal, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@myhoodora/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ReportDialog } from "@/components/shared/report-dialog";
import { useAuth } from "@/context/AuthContext";
import { isActiveAlert } from "@/features/alerts/lifecycle";
import { resolveAlert } from "@/lib/api/alerts";
import { ROUTES } from "@/lib/routes";
import { errorMessage } from "@/lib/api/client";
import type { Post } from "@/lib/api/types";
import { useFeed } from "../feed-context";
import { copyLink } from "../share";

interface PostMenuProps {
  post: Post;
  isOwn: boolean;
  onDelete: (postId: string) => Promise<void>;
  /** Where to go after deleting from the post page. */
  redirectAfterDelete?: string;
}

export function PostMenu({ post, isOwn, onDelete, redirectAfterDelete }: PostMenuProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reporting, setReporting] = useState(false);
  const { user } = useAuth();
  const { upsertPost } = useFeed();

  const markResolved = async () => {
    if (!user) return;
    try {
      const resolvedAt = await resolveAlert(user, post._id);
      upsertPost({ ...post, resolvedAt });
      toast.success("Marked as resolved. Thanks for the update!");
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't update the alert."));
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onDelete(post._id);
      toast.success("Post deleted.");
      setConfirming(false);
      if (redirectAfterDelete) router.push(redirectAfterDelete);
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't delete this post."));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Post options"
            className="flex size-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <MoreHorizontal className="size-5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-52">
          <DropdownMenuItem onSelect={() => void copyLink(ROUTES.post(post._id))}>
            <Link2 className="size-4" />
            Copy link
          </DropdownMenuItem>
          {isOwn && isActiveAlert(post) && (
            <DropdownMenuItem onSelect={() => void markResolved()}>
              <CheckCircle2 className="size-4" />
              Mark as resolved
            </DropdownMenuItem>
          )}
          {isOwn ? (
            <DropdownMenuItem
              onSelect={() => setConfirming(true)}
              className="text-destructive focus:bg-destructive/10 focus:text-destructive"
            >
              <Trash2 className="size-4" />
              Delete post
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => setReporting(true)}>
              <Flag className="size-4" />
              Report post
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Delete this post?"
        description="This removes it from the neighbourhood feed for everyone."
        confirmLabel="Delete post"
        destructive
        loading={deleting}
        onConfirm={handleDelete}
      />
      <ReportDialog
        open={reporting}
        onOpenChange={setReporting}
        target={{ targetType: "post", targetId: post._id }}
      />
    </>
  );
}
