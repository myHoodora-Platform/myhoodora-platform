import { Image } from "expo-image";
import { useState } from "react";
import { FlatList, StyleSheet, useWindowDimensions, View } from "react-native";
import { useTheme } from "@/shared/theme/theme";

/** The photo's own shape, kept between square-ish and wide (the web's 4:5 to 1.91:1 feed range). */
export function clampAspect(aspect: number | null | undefined, fallback = 4 / 3): number {
  if (!aspect || !Number.isFinite(aspect)) return fallback;
  return Math.min(1.91, Math.max(0.8, aspect));
}

/**
 * Photos edge to edge, swiped one at a time, with dots for where you are. The first photo's shape
 * sets the height, so the page doesn't jump between photos.
 */
export function PhotoPager({ photos, aspects, label }: { photos: string[]; aspects?: (number | null)[]; label: string }) {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const height = width / clampAspect(aspects?.[0]);
  if (!photos.length) return null;
  return (
    <View>
      <FlatList
        data={photos}
        keyExtractor={(p, i) => `${i}-${p}`}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={photos.length > 1}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        renderItem={({ item, index: i }) => (
          <Image
            source={item}
            style={{ width, height, backgroundColor: t.colors.muted }}
            contentFit="cover"
            transition={150}
            accessibilityLabel={photos.length > 1 ? `${label} ${i + 1} of ${photos.length}` : label}
          />
        )}
      />
      {photos.length > 1 ? (
        <View style={styles.dots} accessible={false}>
          {photos.map((p, i) => (
            <View key={`${i}-${p}`} style={[styles.dot, { backgroundColor: i === index ? "#ffffff" : "rgba(255,255,255,0.5)", width: i === index ? 18 : 7 }]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  dots: { position: "absolute", bottom: 12, alignSelf: "center", flexDirection: "row", gap: 5, backgroundColor: "rgba(0,0,0,0.25)", paddingHorizontal: 8, paddingVertical: 5, borderRadius: 999 },
  dot: { height: 7, borderRadius: 4 },
});
