import { Image } from "expo-image";
import { Camera, ImagePlus, Images, RotateCcw, X } from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, Linking, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { pickPhotos, takePhoto, type PickResult } from "@/core/media/media";
import type { PhotoUploads } from "@/core/media/use-photo-uploads";
import { tint, useTheme } from "@/shared/theme/theme";
import { InlineAlert } from "./inline-alert";
import { Sheet, SheetItem } from "./sheet";
import { Text } from "./text";

const SIZE = 92;

/**
 * The photos in a draft: each shows whether it's uploading, done or failed (tap to retry), with a
 * remove button; then "Add photo", which offers the library or the camera.
 */
export function PhotoStrip({ uploads, label = "Photos" }: { uploads: PhotoUploads; label?: string }) {
  const t = useTheme();
  const [choosing, setChoosing] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const { items, room, uploading, failed } = uploads;

  const take = async (from: () => Promise<PickResult>) => {
    setChoosing(false);
    setNote(null);
    // iOS can't present the picker while this sheet is still sliding away.
    if (Platform.OS === "ios") await new Promise((r) => setTimeout(r, 450));
    const result = await from();
    if (!result.ok) {
      if (result.reason === "denied") setNote("Camera access is off for myHoodora. You can turn it on in Settings, or choose from your photos.");
      return;
    }
    const left = uploads.add(result.photos);
    if (left > 0) setNote(`There was room for ${room} more, so ${left} ${left === 1 ? "wasn't" : "weren't"} added.`);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text variant="label">{label}</Text>
        <Text variant="caption" tone="muted" accessibilityLiveRegion="polite">
          {uploading ? `Uploading ${uploading} of ${items.length}…` : items.length ? `${items.length} added` : "Optional"}
        </Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {items.map((p, i) => (
          <View key={p.key} style={[styles.tile, { backgroundColor: t.colors.muted }]}>
            <Image source={p.uri} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityLabel={`Photo ${i + 1}${p.status === "failed" ? ", didn't upload" : p.status === "uploading" ? ", uploading" : ""}`} />
            {p.status === "uploading" ? (
              <View style={styles.cover}>
                <ActivityIndicator color="#ffffff" />
              </View>
            ) : null}
            {p.status === "failed" ? (
              <Pressable onPress={() => uploads.retry(p.key)} accessibilityRole="button" accessibilityLabel={`Retry photo ${i + 1}`} style={[styles.cover, styles.failed]}>
                <RotateCcw size={22} color="#ffffff" />
                <Text variant="caption" style={styles.coverText}>
                  Retry
                </Text>
              </Pressable>
            ) : null}
            <Pressable onPress={() => uploads.remove(p.key)} accessibilityRole="button" accessibilityLabel={`Remove photo ${i + 1}`} hitSlop={8} style={styles.remove}>
              <X size={14} color="#ffffff" />
            </Pressable>
          </View>
        ))}
        {room > 0 ? (
          <Pressable
            onPress={() => setChoosing(true)}
            accessibilityRole="button"
            accessibilityLabel="Add photos"
            style={({ pressed }) => [styles.tile, styles.add, { borderColor: t.colors.primary, backgroundColor: pressed ? tint(t.colors.primary, 0.12) : tint(t.colors.primary, 0.05) }]}
          >
            <ImagePlus size={24} color={t.colors.primary} />
            <Text variant="caption" tone="primary">
              Add photo
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>
      {failed ? <InlineAlert>{`${failed === 1 ? "A photo" : `${failed} photos`} didn't upload. Tap to retry, or remove it.`}</InlineAlert> : null}
      {note ? (
        <InlineAlert tone="info" action={note.startsWith("Camera") ? <Text variant="label" tone="primary" onPress={() => void Linking.openSettings()}>Open Settings</Text> : undefined}>
          {note}
        </InlineAlert>
      ) : null}
      <Sheet visible={choosing} title="Add photos" onClose={() => setChoosing(false)}>
        <SheetItem label="Choose from your photos" icon={<Images size={20} color={t.colors.primary} />} onPress={() => void take(() => pickPhotos(room))} />
        <SheetItem label="Take a photo" icon={<Camera size={20} color={t.colors.primary} />} onPress={() => void take(takePhoto)} />
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  row: { gap: 10 },
  tile: { width: SIZE, height: SIZE, borderRadius: 16, overflow: "hidden" },
  add: { borderWidth: 1.5, borderStyle: "dashed", alignItems: "center", justifyContent: "center", gap: 4 },
  cover: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.35)", alignItems: "center", justifyContent: "center", gap: 2 },
  failed: { backgroundColor: "rgba(185,28,28,0.6)" },
  coverText: { color: "#ffffff" },
  remove: { position: "absolute", top: 5, right: 5, width: 24, height: 24, borderRadius: 12, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center" },
});
