import { ApiError, errorMessage } from "@myhoodora/api-contract/errors";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { X } from "lucide-react-native";
import { useRef, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth, useSignedInUser } from "@/core/auth/auth-provider";
import { usePhotoUploads } from "@/core/media/use-photo-uploads";
import { hasHood } from "@/core/auth/session-phase";
import { createPost, feedKeys, kindnessCheck } from "@/features/feed/feed-api";
import { liveStore } from "@/features/live/live-store";
import { MIN_TOUCH, useTheme } from "@/shared/theme/theme";
import { Avatar } from "@/shared/ui/avatar";
import { Button } from "@/shared/ui/button";
import { Chip } from "@/shared/ui/chip";
import { InlineAlert } from "@/shared/ui/inline-alert";
import { PhotoStrip } from "@/shared/ui/photo-strip";
import { EmptyState } from "@/shared/ui/states";
import { Text } from "@/shared/ui/text";
import { TextField } from "@/shared/ui/text-field";
import { useToast } from "@/shared/ui/toast";
import { ALERT_KINDS, COMPOSE_KINDS, draftErrors, MESSAGE_MAX, newClientId, toNewPost, type Draft, type DraftErrors } from "./compose-rules";

const KINDNESS_TIMEOUT_MS = 3000;
const REASON_TEXT: Record<string, string> = {
  insult: "It may come across as an insult.",
  threat: "It may read as a threat.",
  shouting: "Lots of capitals can read as shouting.",
};

/**
 * Writing a post (Nextdoor's "Post" button): pick what it is, write it, post. One tap posts once: the
 * draft carries a clientId, so even a retry after a lost response can't make a second post.
 */
export function ComposeScreen() {
  const t = useTheme();
  const router = useRouter();
  const user = useSignedInUser();
  const { profile } = useAuth();
  const client = useQueryClient();
  const toast = useToast();
  const [draft, setDraft] = useState<Draft>({ category: "general", message: "", alertCategory: null, urgent: false, thankedName: "" });
  const [errors, setErrors] = useState<DraftErrors | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [clientId] = useState(newClientId);
  const inFlight = useRef(false);
  // Up to 10 photos per post (contract §20).
  const photos = usePhotoUploads("post", 10);
  const kind = COMPOSE_KINDS.find((k) => k.id === draft.category) ?? COMPOSE_KINDS[0]!;
  const close = () => (router.canGoBack() ? router.back() : router.replace("/news-feed"));

  if (!hasHood(profile)) {
    return (
      <SafeAreaView style={[styles.flex, { backgroundColor: t.colors.background }]}>
        <EmptyState title="Join your neighbourhood to post" body="Posts go to the neighbours who live around you, so confirm where you live first." action={{ label: "Confirm my address", onPress: () => router.replace("/onboarding") }} />
      </SafeAreaView>
    );
  }
  const hoodId = profile.neighborhoodId;

  const edit = (patch: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setErrors(null);
    setProblem(null);
  };

  const send = async () => {
    setBusy(true);
    try {
      const created = await createPost(user, hoodId, { ...toNewPost(draft, clientId), ...(photos.urls.length && { mediaUrls: photos.urls }) });
      liveStore.markOwnPost(created._id);
      await client.invalidateQueries({ queryKey: feedKeys.all });
      toast(draft.category === "alert" ? "Alert posted to your neighbours." : "Posted to your neighbourhood.");
      close();
    } catch (err) {
      // 403 says why (e.g. confirm your email first); everything else in the shared wording.
      setProblem(err instanceof ApiError && err.kind === "forbidden" ? err.message : errorMessage(err));
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  };

  const submit = async () => {
    if (inFlight.current) return;
    const found = draftErrors(draft);
    setErrors(found);
    if (found) return;
    if (photos.uploading) return setProblem("Wait for your photos to finish uploading.");
    if (photos.failed) return setProblem("Some photos didn't upload. Retry or remove them first.");
    inFlight.current = true;
    setBusy(true);
    // The Kindness Reminder: a nudge they can ignore. If it's slow or down, posting goes ahead.
    const check = await Promise.race([kindnessCheck(user, draft.message).catch(() => null), new Promise<null>((r) => setTimeout(() => r(null), KINDNESS_TIMEOUT_MS))]);
    if (check?.flagged) {
      setBusy(false);
      const why = check.reasons.map((r) => REASON_TEXT[r]).filter(Boolean).join(" ");
      Alert.alert("Kindness reminder", `${why} Neighbours are more likely to help when posts are friendly. Would you like to edit it?`, [
        { text: "Edit", style: "cancel", onPress: () => (inFlight.current = false) },
        { text: "Post anyway", onPress: () => void send() },
      ]);
      return;
    }
    await send();
  };

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: t.colors.background }]} edges={["top", "bottom"]}>
      <View style={[styles.header, { borderBottomColor: t.colors.border }]}>
        <Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Close without posting" hitSlop={8} style={styles.close}>
          <X size={24} color={t.colors.foreground} />
        </Pressable>
        <Text variant="heading">New post</Text>
        <Button label="Post" onPress={() => void submit()} loading={busy} style={styles.post} />
      </View>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {profile.emailVerified === false ? (
            <InlineAlert tone="warning">Confirm your email address to post. We sent you a link when you signed up; you can ask for a new one on your feed.</InlineAlert>
          ) : null}
          {problem ? <InlineAlert>{problem}</InlineAlert> : null}
          <View style={styles.author}>
            <Avatar name={profile.displayName} photoURL={profile.photoURL} size={40} />
            <View>
              <Text variant="label">{profile.displayName ?? "You"}</Text>
              <Text variant="caption" tone="muted">
                Visible to your neighbourhood
              </Text>
            </View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={styles.chipRow} accessibilityLabel="What kind of post">
            {COMPOSE_KINDS.map((k) => (
              <Chip key={k.id} label={k.label} selected={k.id === draft.category} onPress={() => edit({ category: k.id })} />
            ))}
          </ScrollView>
          <Text variant="caption" tone="muted">
            {kind.hint}
          </Text>
          {draft.category === "alert" ? (
            <View style={styles.group}>
              <Text variant="label">What kind of alert?</Text>
              <View style={styles.wrap}>
                {ALERT_KINDS.map((a) => (
                  <Chip key={a.id} label={a.label} selected={draft.alertCategory === a.id} onPress={() => edit({ alertCategory: a.id })} />
                ))}
              </View>
              {errors?.alertCategory ? <InlineAlert>{errors.alertCategory}</InlineAlert> : null}
              <View style={[styles.urgent, { borderColor: t.colors.border, borderRadius: t.radius.xl }]}>
                <View style={styles.flex}>
                  <Text variant="label">Urgent</Text>
                  <Text variant="caption" tone="muted">
                    Happening now and affects safety. Shows as a red banner for 2 hours.
                  </Text>
                </View>
                <Switch value={draft.urgent} onValueChange={(urgent) => edit({ urgent })} accessibilityLabel="Urgent" trackColor={{ true: t.colors.destructive, false: t.colors.input }} />
              </View>
            </View>
          ) : null}
          {draft.category === "thanks" ? (
            <TextField label="Who are you thanking?" placeholder="e.g. Mama Tunde at the corner shop" value={draft.thankedName} onChangeText={(thankedName) => edit({ thankedName })} maxLength={80} error={errors?.thankedName} autoCapitalize="words" />
          ) : null}
          <TextInput
            value={draft.message}
            onChangeText={(message) => edit({ message })}
            placeholder={kind.placeholder}
            placeholderTextColor={t.colors.mutedForeground}
            multiline
            autoFocus
            maxLength={MESSAGE_MAX}
            accessibilityLabel="Your post"
            style={[styles.message, { color: t.colors.foreground, fontFamily: t.fonts.regular }]}
            textAlignVertical="top"
          />
          {errors?.message ? <InlineAlert>{errors.message}</InlineAlert> : null}
          <PhotoStrip uploads={photos} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  close: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: "center", justifyContent: "center" },
  post: { minHeight: 40, paddingVertical: 6, paddingHorizontal: 20, borderRadius: 999 },
  content: { padding: 16, gap: 14 },
  author: { flexDirection: "row", alignItems: "center", gap: 10 },
  chipRow: { marginHorizontal: -16 },
  chips: { gap: 8, paddingHorizontal: 16 },
  group: { gap: 10 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  urgent: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderWidth: 1 },
  message: { fontSize: 18, lineHeight: 26, minHeight: 160 },
});
