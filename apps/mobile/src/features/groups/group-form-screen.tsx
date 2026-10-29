import { errorMessage } from "@myhoodora/api-contract/errors";
import type { CreateGroupInput, Group } from "@myhoodora/api-contract/types";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { X } from "lucide-react-native";
import { useRef, useState, type ComponentType } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { FormScrollView } from "@/shared/ui/form-scroll-view";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth, useSignedInUser } from "@/core/auth/auth-provider";
import { hasHood } from "@/core/auth/session-phase";
import { usePhotoUploads } from "@/core/media/use-photo-uploads";
import { useRouter } from "@/core/navigation/use-router";
import { MIN_TOUCH, tint, useTheme } from "@/shared/theme/theme";
import { Button } from "@/shared/ui/button";
import { Chip } from "@/shared/ui/chip";
import { InlineAlert } from "@/shared/ui/inline-alert";
import { PhotoStrip } from "@/shared/ui/photo-strip";
import { EmptyState, ErrorState, LoadingState } from "@/shared/ui/states";
import { Text } from "@/shared/ui/text";
import { TextField } from "@/shared/ui/text-field";
import { useToast } from "@/shared/ui/toast";
import { BOUNDARY_OPTIONS, CATEGORY_OPTIONS, createGroup, getGroup, groupErrors, groupKeys, PRIVACY_OPTIONS, updateGroup, type GroupFormErrors } from "./groups-api";

type Form = Omit<CreateGroupInput, "coverPhoto">;
const BLANK: Form = { name: "", description: "", category: "other", privacy: "open", boundary: "neighbourhood" };

/** `/groups/new`: start a group. You become its first admin. */
export function NewGroupScreen() {
  const { profile } = useAuth();
  const t = useTheme();
  if (!hasHood(profile)) {
    return (
      <SafeAreaView style={[styles.flex, { backgroundColor: t.colors.background }]}>
        <EmptyState title="Join your neighbourhood first" body="Groups are for verified neighbours, so confirm where you live to start one." />
      </SafeAreaView>
    );
  }
  return <GroupForm hoodId={profile.neighborhoodId} />;
}

/** `/g/<id>/edit`: an admin changes the details (making a private group open lets everyone waiting in). */
export function EditGroupScreen({ id }: { id: string }) {
  const user = useSignedInUser();
  const t = useTheme();
  const group = useQuery({ queryKey: groupKeys.one(id), queryFn: () => getGroup(user, id) });
  if (group.data) return <GroupForm existing={group.data} />;
  return <SafeAreaView style={[styles.flex, { backgroundColor: t.colors.background }]}>{group.isPending ? <LoadingState /> : <ErrorState error={group.error} onRetry={() => void group.refetch()} />}</SafeAreaView>;
}

function GroupForm({ hoodId, existing }: { hoodId?: string; existing?: Group }) {
  const t = useTheme();
  const router = useRouter();
  const user = useSignedInUser();
  const client = useQueryClient();
  const toast = useToast();
  const photos = usePhotoUploads("group", 1);
  const [form, setForm] = useState<Form>(existing ? { name: existing.name, description: existing.description, category: existing.category, privacy: existing.privacy, boundary: existing.boundary } : BLANK);
  /** The cover already saved (editing): kept unless removed or replaced. */
  const [savedCover, setSavedCover] = useState(existing?.coverPhoto);
  const [errors, setErrors] = useState<GroupFormErrors | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const close = () => (router.canGoBack() ? router.back() : router.replace(existing ? `/g/${existing._id}` : "/groups"));

  const edit = (patch: Partial<Form>) => {
    setForm((f) => ({ ...f, ...patch }));
    setErrors((e) => (e ? Object.fromEntries(Object.entries(e).filter(([k]) => !(k in patch))) : e));
    setProblem(null);
  };

  const submit = async () => {
    if (inFlight.current) return;
    const found = groupErrors(form);
    setErrors(found);
    if (found) return;
    if (photos.uploading) return setProblem("Wait for the cover photo to finish uploading.");
    if (photos.failed) return setProblem("The cover photo didn't upload. Retry or remove it first.");
    inFlight.current = true;
    setBusy(true);
    const coverPhoto = photos.urls[0] ?? savedCover;
    const input = { ...form, name: form.name.trim(), description: form.description.trim(), ...(coverPhoto && { coverPhoto }) };
    try {
      const saved = existing ? await updateGroup(user, existing._id, input) : await createGroup(user, hoodId!, input);
      client.setQueryData(groupKeys.one(saved._id), saved);
      await client.invalidateQueries({ queryKey: groupKeys.all });
      if (existing) {
        toast("Saved.");
        close();
      } else {
        toast(`${saved.name} is ready. Invite your neighbours.`);
        router.replace(`/g/${saved._id}`);
      }
    } catch (err) {
      setProblem(errorMessage(err));
      inFlight.current = false;
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: t.colors.background }]} edges={["top", "bottom"]}>
      <View style={[styles.header, { borderBottomColor: t.colors.border }]}>
        <Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Close without saving" hitSlop={8} style={styles.close}>
          <X size={24} color={t.colors.foreground} />
        </Pressable>
        <Text variant="heading">{existing ? "Edit group" : "Start a group"}</Text>
        <Button label={existing ? "Save" : "Create"} onPress={() => void submit()} loading={busy} style={styles.save} />
      </View>
      <FormScrollView style={styles.flex} contentContainerStyle={styles.content}>
          {problem ? <InlineAlert>{problem}</InlineAlert> : null}
          {savedCover && !photos.items.length ? (
            <View style={styles.group}>
              <Text variant="label">Cover photo</Text>
              <View>
                <Image source={savedCover} style={styles.cover} contentFit="cover" accessibilityLabel="Current cover photo" />
                <Pressable onPress={() => setSavedCover(undefined)} accessibilityRole="button" accessibilityLabel="Remove the cover photo" hitSlop={8} style={[styles.removeCover, { backgroundColor: t.colors.background }]}>
                  <X size={16} color={t.colors.foreground} />
                </Pressable>
              </View>
            </View>
          ) : (
            <PhotoStrip uploads={photos} label="Cover photo" />
          )}
          <TextField label="Name" placeholder="e.g. Adeniyi Jones Street residents" value={form.name} onChangeText={(name) => edit({ name })} maxLength={60} error={errors?.name} autoCapitalize="words" />
          <TextField
            label="What is it for?"
            placeholder="Who it's for and what you'll share: security updates, power, events…"
            value={form.description}
            onChangeText={(description) => edit({ description })}
            multiline
            maxLength={500}
            error={errors?.description}
          />
          <View style={styles.group}>
            <Text variant="label">Category</Text>
            <View style={styles.wrap}>
              {CATEGORY_OPTIONS.map((c) => (
                <Chip key={c.id} label={c.label} selected={form.category === c.id} onPress={() => edit({ category: c.id })} />
              ))}
            </View>
          </View>
          <Choices label="Who can join" options={PRIVACY_OPTIONS} value={form.privacy} onChange={(privacy) => edit({ privacy })} />
          {existing?.privacy === "private" && form.privacy === "open" ? <InlineAlert tone="info">Making it open lets everyone who asked to join in straight away.</InlineAlert> : null}
          <Choices label="Who can find it" options={BOUNDARY_OPTIONS} value={form.boundary} onChange={(boundary) => edit({ boundary })} />
          <Text variant="caption" tone="muted">
            Community guidelines apply in groups too. As an admin you can remove posts and members.
          </Text>
      </FormScrollView>
    </SafeAreaView>
  );
}

/** One choice from a few, each a card with its icon and what it means (a radio group). */
function Choices<T extends string>({ label, options, value, onChange }: { label: string; options: { id: T; label: string; description: string; Icon: ComponentType<{ size?: number; color?: string }> }[]; value: T; onChange: (v: T) => void }) {
  const t = useTheme();
  return (
    <View style={styles.group} accessibilityRole="radiogroup" accessibilityLabel={label}>
      <Text variant="label">{label}</Text>
      {options.map((o) => {
        const on = o.id === value;
        return (
          <Pressable
            key={o.id}
            onPress={() => onChange(o.id)}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={`${o.label}. ${o.description}`}
            style={[styles.choice, { borderColor: on ? t.colors.primary : t.colors.border, backgroundColor: on ? tint(t.colors.primary, 0.06) : t.colors.card }]}
          >
            <o.Icon size={20} color={on ? t.colors.primary : t.colors.mutedForeground} />
            <View style={styles.flex}>
              <Text variant="label">{o.label}</Text>
              <Text variant="caption" tone="muted">
                {o.description}
              </Text>
            </View>
            <View style={[styles.radio, { borderColor: on ? t.colors.primary : t.colors.border }]}>{on ? <View style={[styles.dot, { backgroundColor: t.colors.primary }]} /> : null}</View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  close: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: "center", justifyContent: "center" },
  save: { minHeight: 40, paddingVertical: 6, paddingHorizontal: 20, borderRadius: 999 },
  content: { padding: 16, gap: 18, paddingBottom: 40 },
  group: { gap: 8 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  cover: { height: 150, borderRadius: 16 },
  removeCover: { position: "absolute", top: 8, right: 8, width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  choice: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 16, borderWidth: 1.5 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  dot: { width: 11, height: 11, borderRadius: 6 },
});
