import { Image } from "expo-image";
import { X } from "lucide-react-native";
import { useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { sizedImage } from "@/shared/utils/media";
import { Text } from "./text";

const MAX_ZOOM = 4;
const DOUBLE_TAP_ZOOM = 2.5;

/** One photo you can pinch, double-tap and (once zoomed) drag around. Unzoomed, swipes go to the pager. */
function ZoomablePhoto({ uri, width, height, label, onZoomed }: { uri: string; width: number; height: number; label: string; onZoomed: (zoomed: boolean) => void }) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);

  const settle = (to: number) => {
    "worklet";
    scale.value = withTiming(to);
    savedScale.value = to;
    if (to === 1) {
      x.value = withTiming(0);
      y.value = withTiming(0);
      savedX.value = 0;
      savedY.value = 0;
    }
    runOnJS(onZoomed)(to > 1);
  };

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.min(MAX_ZOOM, Math.max(1, savedScale.value * e.scale));
    })
    .onEnd(() => settle(scale.value < 1.05 ? 1 : scale.value));
  // Only takes over once zoomed in; otherwise the horizontal swipe belongs to the pager.
  const pan = Gesture.Pan()
    .manualActivation(true)
    .onTouchesMove((_e, state) => {
      if (savedScale.value > 1) state.activate();
      else state.fail();
    })
    .onUpdate((e) => {
      x.value = savedX.value + e.translationX;
      y.value = savedY.value + e.translationY;
    })
    .onEnd(() => {
      savedX.value = x.value;
      savedY.value = y.value;
    });
  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => settle(savedScale.value > 1 ? 1 : DOUBLE_TAP_ZOOM));

  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }, { translateY: y.value }, { scale: scale.value }] }));
  return (
    <GestureDetector gesture={Gesture.Simultaneous(pinch, pan, doubleTap)}>
      <Animated.View style={[{ width, height }, styles.center]}>
        <Animated.View style={[{ width, height }, style]}>
          <Image source={sizedImage(uri, width * 2)} style={StyleSheet.absoluteFill} contentFit="contain" accessibilityLabel={label} accessibilityIgnoresInvertColors />
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

/**
 * Photos full screen on black: swipe between them, pinch or double-tap to zoom. Closes with the X or
 * the Android back button.
 */
export function PhotoViewer({ photos, start, visible, onClose, label = "Photo" }: { photos: string[]; start: number; visible: boolean; onClose: () => void; label?: string }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(start);
  const [zoomed, setZoomed] = useState(false);
  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose} statusBarTranslucent supportedOrientations={["portrait", "landscape"]} onShow={() => setIndex(start)}>
      <GestureHandlerRootView style={styles.root}>
        <FlatList
          data={photos}
          keyExtractor={(p, i) => `${i}-${p}`}
          horizontal
          pagingEnabled
          scrollEnabled={!zoomed && photos.length > 1}
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={Math.min(start, photos.length - 1)}
          getItemLayout={(_d, i) => ({ length: width, offset: width * i, index: i })}
          onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
          renderItem={({ item, index: i }) => <ZoomablePhoto uri={item} width={width} height={height} label={photos.length > 1 ? `${label} ${i + 1} of ${photos.length}` : label} onZoomed={setZoomed} />}
        />
        <View style={[styles.top, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
          {photos.length > 1 ? (
            <Text variant="label" style={styles.count}>
              {index + 1} / {photos.length}
            </Text>
          ) : (
            <View />
          )}
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close photos" hitSlop={8} style={styles.close}>
            <X size={24} color="#ffffff" />
          </Pressable>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000000" },
  center: { alignItems: "center", justifyContent: "center", overflow: "hidden" },
  top: { position: "absolute", left: 0, right: 0, top: 0, flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16 },
  count: { color: "#ffffff" },
  close: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.15)" },
});
