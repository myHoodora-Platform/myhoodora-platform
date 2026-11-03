import { Image } from "expo-image";
import { memo, useState } from "react";
import { Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { useTheme } from "@/shared/theme/theme";
import { PhotoViewer } from "@/shared/ui/photo-viewer";
import { Text } from "@/shared/ui/text";
import { sizedImage } from "@/shared/utils/media";
import { gridLayout } from "./media-layout";

/** Hairline between tiles. */
const GAP = 2;

/**
 * A post's photos edge to edge: one in its own shape, or a grid (see gridLayout). Each is fetched at
 * the size it's shown. Tapping one opens them all full screen at that photo.
 */
export const MediaGrid = memo(function MediaGrid({ urls, aspects, recyclingKey }: { urls: string[]; aspects?: (number | null)[]; recyclingKey: string }) {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const [viewing, setViewing] = useState<number | null>(null);
  const layout = gridLayout(aspects ?? [], urls.length);
  if (!layout.tiles.length) return null;
  const height = width / layout.aspect;
  return (
    <>
      <View style={{ width, height }}>
        {layout.tiles.map((tile) => {
          const last = tile.index === layout.tiles.length - 1 && layout.hidden > 0;
          const w = tile.w * width - (tile.x + tile.w < 1 ? GAP / 2 : 0) - (tile.x > 0 ? GAP / 2 : 0);
          const h = tile.h * height - (tile.y + tile.h < 1 ? GAP / 2 : 0) - (tile.y > 0 ? GAP / 2 : 0);
          return (
            <Pressable
              key={tile.index}
              onPress={() => setViewing(tile.index)}
              accessibilityRole="imagebutton"
              accessibilityLabel={urls.length > 1 ? `Photo ${tile.index + 1} of ${urls.length}${last ? `, and ${layout.hidden} more` : ""}. Opens full screen` : "Photo in the post. Opens full screen"}
              style={{ position: "absolute", left: tile.x * width + (tile.x > 0 ? GAP / 2 : 0), top: tile.y * height + (tile.y > 0 ? GAP / 2 : 0), width: w, height: h }}
            >
              <Image source={sizedImage(urls[tile.index]!, w)} style={[StyleSheet.absoluteFill, { backgroundColor: t.colors.muted }]} contentFit="cover" transition={150} recyclingKey={`${recyclingKey}-${tile.index}`} />
              {last ? (
                <View style={[StyleSheet.absoluteFill, styles.more]}>
                  <Text style={styles.moreText}>+{layout.hidden}</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
      {viewing !== null ? <PhotoViewer photos={urls} start={viewing} visible onClose={() => setViewing(null)} label="Photo in the post" /> : null}
    </>
  );
});

const styles = StyleSheet.create({
  more: { backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center" },
  moreText: { color: "#ffffff", fontSize: 28, lineHeight: 34, fontWeight: "700" },
});
