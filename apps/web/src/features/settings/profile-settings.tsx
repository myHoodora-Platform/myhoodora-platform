"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@myhoodora/ui/button";
import { Field, fieldInputClass } from "@/components/shared/field";
import { ImagePicker } from "@/components/shared/image-picker";
import { PreviewNotice } from "@/components/shared/states";
import { UserAvatar } from "@/components/shared/user-avatar";
import { useAuth } from "@/context/AuthContext";
import { errorMessage } from "@/lib/api/client";
import { myProfileExtras, updateProfileExtras } from "@/lib/api/settings";
import { ROUTES } from "@/lib/routes";
import { SettingsSection } from "./ui";

const BIO_MAX = 160;

export function ProfileSettings() {
  const { user, profile, updateProfile } = useAuth();
  const extras = user ? myProfileExtras(user.uid) : {};
  const [name, setName] = useState(profile?.displayName ?? "");
  const [bio, setBio] = useState(extras.bio ?? "");
  const [photo, setPhoto] = useState<string | null>(extras.photoURL ?? user?.photoURL ?? null);
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  if (!user) return null;
  const dirty =
    name.trim() !== (profile?.displayName ?? "") || bio.trim() !== (extras.bio ?? "") || photo !== (extras.photoURL ?? user.photoURL ?? null);

  const save = async () => {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setNameError("Use your real name so neighbours recognise you.");
      return;
    }
    setNameError(null);
    setSaving(true);
    try {
      if (trimmed !== profile?.displayName) await updateProfile({ displayName: trimmed });
      await updateProfileExtras(user, { bio: bio.trim(), photoURL: photo ?? undefined });
      toast.success("Profile updated.");
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't save your profile."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <SettingsSection title="Profile" description="This is what neighbours see on your posts and profile.">
        <div className="space-y-5 px-4 py-4 sm:px-5">
          <div className="flex flex-wrap items-center gap-4">
            <UserAvatar person={{ displayName: name || "?", photoURL: photo ?? undefined }} size="lg" />
            <div className="min-w-0 flex-1">
              <ImagePicker value={null} onChange={(url) => url && setPhoto(url)} disabled={saving} />
              {photo && (
                <button type="button" onClick={() => setPhoto(null)} className="mt-1 text-xs font-semibold text-muted-foreground hover:text-destructive">
                  Remove photo
                </button>
              )}
            </div>
          </div>

          <Field label="Name" htmlFor="profile-name" error={nameError ?? undefined} hint="Real names build trust between neighbours.">
            <input
              id="profile-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              aria-invalid={nameError ? true : undefined}
              className={fieldInputClass}
            />
          </Field>

          <Field label="Bio" htmlFor="profile-bio" optional hint={`${bio.length}/${BIO_MAX}: e.g. “Mum of two, love gardening, ask me about good tailors.”`}>
            <textarea
              id="profile-bio"
              value={bio}
              onChange={(e) => setBio(e.target.value.slice(0, BIO_MAX))}
              rows={3}
              className={fieldInputClass}
            />
          </Field>

          <PreviewNotice endpoint="settings" />

          <div className="flex flex-wrap items-center justify-between gap-2">
            <Link href={ROUTES.profile(user.uid)} className="text-sm font-semibold text-primary hover:underline">
              View your profile
            </Link>
            <Button onClick={save} loading={saving} disabled={!dirty}>
              Save changes
            </Button>
          </div>
        </div>
      </SettingsSection>
    </div>
  );
}
