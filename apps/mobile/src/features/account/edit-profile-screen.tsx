import { errorMessage } from "@myhoodora/api-contract/errors";
import { BIO_MAX, DISPLAY_NAME_MAX } from "@myhoodora/api-contract/settings";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@/core/navigation/use-router";
import { Camera, Images, Lock, Mail, MapPin, Trash2 } from "lucide-react-native";
import { useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from "react-native";
import { useAuth, useSignedInUser } from "@/core/auth/auth-provider";
import { hasHood } from "@/core/auth/session-phase";
import { pickPhotos, preparePhoto, takePhoto, uploadPhoto, type PickResult } from "@/core/media/media";
import { useTheme } from "@/shared/theme/theme";
import { AppScreen, useScreenInsets } from "@/shared/ui/app-screen";
import { Avatar } from "@/shared/ui/avatar";
import { Button } from "@/shared/ui/button";
import { InlineAlert } from "@/shared/ui/inline-alert";
import { SettingsGroup, SettingsRow } from "@/shared/ui/settings";
import { Sheet, SheetItem } from "@/shared/ui/sheet";
import { Text } from "@/shared/ui/text";
import { TextField } from "@/shared/ui/text-field";
import { useToast } from "@/shared/ui/toast";
import { accountKeys, hoodKeys, myHoods, updateMe } from "./account-api";
import { canChangeEmail, profileErrors } from "./account-rules";
import { FormScrollView } from "@/shared/ui/form-scroll-view";

/** `/settings/profile`: your photo, name and a line about you. */
export function EditProfileScreen() {
  return (
    <AppScreen title="Edit profile" fallback="/settings">
      <EditProfileContent />
    </AppScreen>
  );
}

function EditProfileContent() {
  const t = useTheme();
  const router = useRouter();
  const insets = useScreenInsets();
  const user = useSignedInUser();
  const client = useQueryClient();
  const toast = useToast();
  const { profile, refreshProfile } = useAuth();
  const [name, setName] = useState(profile?.displayName ?? "");
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [errors, setErrors] = useState<{ name?: string; bio?: string } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const inFlight = useRef(false);
  const email = profile?.email ?? user.email ?? "";
  const emailEditable = canChangeEmail(profile, user.providerData.map((p) => p.providerId));
  const hoods = useQuery({ queryKey: hoodKeys.mine, queryFn: () => myHoods(user), enabled: hasHood(profile) });
  const homeName = hoods.data?.home?.name;
  const pendingMove = hoods.data?.requests.some((r) => r.kind === "move" && r.status === "pending");
  const dirty = name.trim() !== (profile?.displayName ?? "") || bio.trim() !== (profile?.bio ?? "");

  /** Photos save at once (contract §20), like changing a profile picture anywhere else. */
  const changePhoto = async (from: () => Promise<PickResult>) => {
    setChoosing(false);
    if (Platform.OS === "ios") await new Promise((r) => setTimeout(r, 450));
    const picked = await from();
    if (!picked.ok) {
      if (picked.reason === "denied") setProblem("Camera access is off for myHoodora. Turn it on in Settings, or choose from your photos.");
      return;
    }
    setPhotoBusy(true);
    setProblem(null);
    try {
      const media = await uploadPhoto(user, await preparePhoto(picked.photos[0]!), "avatar");
      await updateMe(user, { photoURL: media.url });
      await refreshProfile();
      void client.invalidateQueries({ queryKey: accountKeys.publicProfile(user.uid) });
      toast("Photo updated.");
    } catch (err) {
      setProblem(`Your photo wasn't changed: ${errorMessage(err)}`);
    } finally {
      setPhotoBusy(false);
    }
  };

  const removePhoto = async () => {
    setChoosing(false);
    setPhotoBusy(true);
    try {
      await updateMe(user, { photoURL: null });
      await refreshProfile();
      toast("Photo removed.");
    } catch (err) {
      setProblem(errorMessage(err));
    } finally {
      setPhotoBusy(false);
    }
  };

  const save = async () => {
    if (inFlight.current || !dirty) return;
    const found = profileErrors(name, bio);
    setErrors(found);
    if (found) return;
    inFlight.current = true;
    setSaving(true);
    setProblem(null);
    try {
      await updateMe(user, { displayName: name.trim(), bio: bio.trim() });
      await refreshProfile();
      void client.invalidateQueries({ queryKey: accountKeys.publicProfile(user.uid) });
      toast("Profile saved.");
      if (router.canGoBack()) router.back();
    } catch (err) {
      setProblem(errorMessage(err));
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  };

  return (
    <FormScrollView
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 32 }]}
      scrollIndicatorInsets={{ top: insets.top }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.photo}>
        <Pressable onPress={() => setChoosing(true)} disabled={photoBusy} accessibilityRole="button" accessibilityLabel="Change your photo">
          <Avatar name={profile?.displayName} photoURL={profile?.photoURL} size={112} />
          {photoBusy ? (
            <View style={styles.busy}>
              <ActivityIndicator color="#ffffff" />
            </View>
          ) : null}
          <View style={[styles.camera, { backgroundColor: t.colors.primary, borderColor: t.colors.background }]}>
            <Camera size={18} color={t.colors.primaryForeground} />
          </View>
        </Pressable>
        <Text variant="caption" tone="muted">
          A clear photo of you helps neighbours know who they&apos;re talking to.
        </Text>
      </View>

      {problem ? <InlineAlert>{problem}</InlineAlert> : null}

      <TextField
        label="Your name"
        value={name}
        onChangeText={(v) => {
          setName(v);
          setErrors((e) => (e ? { ...e, name: undefined } : e));
        }}
        autoComplete="name"
        textContentType="name"
        autoCapitalize="words"
        maxLength={DISPLAY_NAME_MAX}
        hint="The name your neighbours know you by."
        error={errors?.name}
      />
      <TextField
        label="About you"
        placeholder="e.g. Mum of two, keen gardener, happy to lend a ladder"
        value={bio}
        onChangeText={(v) => {
          setBio(v);
          setErrors((e) => (e ? { ...e, bio: undefined } : e));
        }}
        multiline
        maxLength={BIO_MAX}
        hint={`${bio.length} / ${BIO_MAX}`}
        error={errors?.bio}
      />

      <SettingsGroup title="Private to you" footer="Neighbours never see these. Your address only decides your neighbourhood.">
        {/* An unconfirmed address can be corrected; a confirmed one is the account's proof and stays. */}
        {emailEditable ? (
          <SettingsRow Icon={Mail} label="Email" description={`${email}\nNot confirmed yet: tap to change it.`} onPress={() => router.push("/settings/email")} />
        ) : (
          <SettingsRow
            Icon={Mail}
            label="Email"
            description={`${email}\n${profile?.emailVerified ? "Confirmed, so it can't be changed." : "Comes from the account you sign in with."}`}
            right={<Lock size={16} color={t.colors.mutedForeground} accessibilityLabel="Can't be changed" />}
          />
        )}
        {hasHood(profile) ? (
          <SettingsRow
            Icon={MapPin}
            label="Home address"
            value={homeName}
            description={pendingMove ? "Move requested: our team will be in touch" : "Moved? Ask us to move you. Follow other neighbourhoods too."}
            onPress={() => router.push("/settings/neighbourhoods")}
          />
        ) : (
          <SettingsRow Icon={MapPin} label="Home address" value={profile?.location?.address ? "Saved" : "Not set"} description="Confirm where you live to join your neighbourhood." onPress={() => router.push("/onboarding")} />
        )}
      </SettingsGroup>

      <Button label="Save changes" onPress={() => void save()} loading={saving} disabled={!dirty} />

      <Sheet visible={choosing} title="Profile photo" onClose={() => setChoosing(false)}>
        <SheetItem label="Choose from your photos" icon={<Images size={20} color={t.colors.primary} />} onPress={() => void changePhoto(() => pickPhotos(1))} />
        <SheetItem label="Take a photo" icon={<Camera size={20} color={t.colors.primary} />} onPress={() => void changePhoto(takePhoto)} />
        {profile?.photoURL ? <SheetItem label="Remove photo" destructive icon={<Trash2 size={20} color={t.colors.destructive} />} onPress={() => void removePhoto()} /> : null}
      </Sheet>
    </FormScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, gap: 18 },
  photo: { alignItems: "center", gap: 10 },
  busy: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: 56, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center" },
  camera: { position: "absolute", right: 0, bottom: 0, width: 38, height: 38, borderRadius: 19, borderWidth: 3, alignItems: "center", justifyContent: "center" },
});
