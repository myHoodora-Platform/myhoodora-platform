"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, Loader2 } from "lucide-react";
import { Button } from "@myhoodora/ui/button";
import { UserAvatar } from "@/components/shared/user-avatar";
import { errorMessage } from "@/lib/api/client";
import { PHOTO_ACCEPT, uploadMedia } from "@/lib/api/media";
import type { User } from "firebase/auth";

interface AvatarFieldProps {
  user: User;
  displayName: string;
  photoURL: string | null;
  /** Persist immediately (PATCH /users/me). null removes the photo. */
  onSave: (photoURL: string | null) => Promise<void>;
}

/**
 * Profile photo, Facebook/Nextdoor style: tap the avatar or "Change photo",
 * and it's uploaded and saved straight away. No separate Save step, so a
 * photo can't be lost by navigating away. The API deletes the old file.
 */
export function AvatarField({ user, displayName, photoURL, onSave }: AvatarFieldProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<null | "upload" | "remove">(null);
  const [preview, setPreview] = useState<string | null>(null);

  const pick = async (file: File) => {
    setBusy("upload");
    const local = URL.createObjectURL(file);
    setPreview(local);
    try {
      const media = await uploadMedia(user, file, "avatar");
      await onSave(media.url);
      toast.success("Profile photo updated.");
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't update your photo."));
    } finally {
      setPreview(null);
      URL.revokeObjectURL(local);
      setBusy(null);
    }
  };

  const remove = async () => {
    setBusy("remove");
    try {
      await onSave(null);
      toast.success("Profile photo removed.");
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't remove your photo."));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-4">
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={busy !== null}
        aria-label="Change profile photo"
        className="group relative rounded-full focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
      >
        <UserAvatar person={{ displayName: displayName || "?", photoURL: preview ?? photoURL ?? undefined }} size="lg" />
        <span className="absolute -right-0.5 -bottom-0.5 flex size-7 items-center justify-center rounded-full border-2 border-card bg-primary text-primary-foreground">
          {busy === "upload" ? <Loader2 className="size-3.5 animate-spin" /> : <Camera className="size-3.5" />}
        </span>
      </button>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} loading={busy === "upload"} disabled={busy !== null}>
          {photoURL ? "Change photo" : "Add photo"}
        </Button>
        {photoURL && (
          <Button variant="ghost" size="sm" onClick={() => void remove()} loading={busy === "remove"} disabled={busy !== null}>
            Remove
          </Button>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept={PHOTO_ACCEPT}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void pick(file);
        }}
      />
    </div>
  );
}
