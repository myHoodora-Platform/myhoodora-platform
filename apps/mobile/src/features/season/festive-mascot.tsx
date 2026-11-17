import type { SeasonMascot } from "@myhoodora/api-contract/seasons";
import { Image } from "expo-image";
import { StyleSheet, View } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";

const MASCOT = require("../../../assets/images/mascot-256.png");

/** The app-icon character with a Santa hat or a party hat (the web's FestiveMascot). */
export function FestiveMascot({ hat, size = 56 }: { hat: SeasonMascot; size?: number }) {
  return (
    <View style={{ width: size, height: size }} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <Image source={MASCOT} style={[styles.icon, { width: size, height: size, borderRadius: size / 2 }]} contentFit="cover" />
      {hat === "santa_hat" ? (
        <Svg viewBox="0 0 64 48" width={size * 0.62} height={size * 0.47} style={[styles.hat, { top: -size * 0.3, left: size * 0.22, transform: [{ rotate: "-12deg" }] }]}>
          <Path d="M8 40 C14 18 30 6 48 10 C54 12 58 20 56 28 L50 26 C48 20 44 18 40 20 C30 24 24 32 22 40 Z" fill="#d32f2f" />
          <Rect x="4" y="36" width="34" height="10" rx="5" fill="#fff" />
          <Circle cx="54" cy="30" r="6" fill="#fff" />
        </Svg>
      ) : hat === "party_hat" ? (
        <Svg viewBox="0 0 48 56" width={size * 0.4} height={size * 0.47} style={[styles.hat, { top: -size * 0.36, left: size * 0.3, transform: [{ rotate: "12deg" }] }]}>
          <Path d="M24 4 L44 50 L4 50 Z" fill="#fbc02d" />
          <Path d="M24 4 L30 18 L18 18 Z M14 30 L34 30 L37 38 L11 38 Z" fill="#ab47bc" />
          <Circle cx="24" cy="5" r="5" fill="#29b6f6" />
          <Rect x="2" y="48" width="44" height="6" rx="3" fill="#ff7043" />
        </Svg>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  icon: { backgroundColor: "#fff" },
  hat: { position: "absolute" },
});
