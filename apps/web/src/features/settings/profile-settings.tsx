"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@myhoodora/ui/button";
import { Field, fieldInputClass } from "@/components/shared/field";
import { PreviewNotice } from "@/components/shared/states";
import { useAuth } from "@/context/AuthContext";
import { errorMessage } from "@/lib/api/client";
import { myProfileExtras, updateProfileExtras } from "@/lib/api/settings";
import { ROUTES } from "@/lib/routes";
import { AvatarField } from "./avatar-field";
import { SettingsSection } from "./ui";

const BIO_MAX = 160;

export function ProfileSettings() {
  const { user, profile, updateProfile, refreshProfile } = useAuth();
  // Preview keeps bio/photo locally; live they're on the profile.
  const local = user ? myProfileExtras(user.uid) : {};
  const extras = { bio: local.bio ?? profile?.bio, photoURL: local.photoURL ?? profile?.photoURL };
  const [name, setName] = useState(profile?.displayName ?? "");
  const [bio, setBio] = useState(extras.bio ?? "");
  // Saved as soon as it changes (AvatarField); not part of the form below.
  const [photo, setPhoto] = useState<string | null>(extras.photoURL ?? user?.photoURL ?? null);
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  if (!user) return null;
  const dirty =
    name.trim() !== (profile?.displayName ?? "") || bio.trim() !== (extras.bio ?? "");

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
      await updateProfileExtras(user, { bio: bio.trim() });
      await refreshProfile();
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
          <AvatarField
            user={user}
            displayName={name}
            photoURL={photo}
            onSave={async (url) => {
              await updateProfileExtras(user, { photoURL: url });
              setPhoto(url);
              await refreshProfile();
            }}
          />

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
