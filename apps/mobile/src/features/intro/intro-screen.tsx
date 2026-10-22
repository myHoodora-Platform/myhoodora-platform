import { useRef, useState } from "react";
import { FlatList, Pressable, StyleSheet, useWindowDimensions, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/core/auth/auth-provider";
import { Headline } from "@/shared/ui/headline";
import { ProgressNextButton } from "@/shared/ui/progress-next-button";
import { SoftBackground } from "@/shared/ui/soft-background";
import { Text } from "@/shared/ui/text";
import { SLIDES, type Slide } from "./slides";

/**
 * First launch only (a fresh install, or after the app's data is cleared): three slides, swipeable,
 * always skippable. Finishing or skipping records it, and the root layout moves on to the welcome screen.
 */
export function IntroScreen() {
  const { width } = useWindowDimensions();
  const { finishIntro } = useAuth();
  const list = useRef<FlatList<Slide>>(null);
  const [index, setIndex] = useState(0);
  const last = index === SLIDES.length - 1;

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
  const next = () => (last ? void finishIntro() : list.current?.scrollToIndex({ index: index + 1, animated: true }));

  return (
    <View style={styles.flex}>
      <SoftBackground />
      <SafeAreaView style={styles.flex} edges={["top", "bottom"]}>
        <FlatList
          ref={list}
          data={SLIDES}
          keyExtractor={(s) => s.key}
          horizontal
          pagingEnabled
          bounces={false}
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onScrollEnd}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          renderItem={({ item }) => <SlideView slide={item} width={width} />}
        />
        <View style={styles.footer}>
          <Pressable onPress={() => void finishIntro()} accessibilityRole="button" hitSlop={12}>
            <Text variant="label" tone="muted">
              Skip
            </Text>
          </Pressable>
          <ProgressNextButton progress={(index + 1) / SLIDES.length} onPress={next} label={last ? "Get started" : "Next"} />
        </View>
      </SafeAreaView>
    </View>
  );
}

function SlideView({ slide, width }: { slide: Slide; width: number }) {
  const centred = slide.layout === "centred";
  const text = (
    <View style={styles.text}>
      <Headline size={slide.layout === "textTop" ? 40 : 30} align={centred ? "center" : "left"}>
        {slide.title}
      </Headline>
      <Text tone="muted" style={centred ? styles.centre : undefined}>
        {slide.body}
      </Text>
    </View>
  );
  return (
    <View style={[styles.slide, { width }]}>
      {slide.layout === "textTop" ? text : null}
      <slide.Visual />
      {slide.layout === "textTop" ? null : text}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  slide: { flex: 1, paddingTop: 24, overflow: "hidden" },
  text: { paddingHorizontal: 28, gap: 12, paddingVertical: 16 },
  centre: { textAlign: "center" },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 28, paddingBottom: 8 },
});
