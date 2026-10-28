// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

/** Layering (docs/mobile/architecture-decisions.md, ADR-004). */
const noWebApp = { group: ["**/apps/web/**", "web/*"], message: "The mobile app never imports the web app. Share through packages/." };
/** A quick double tap opened screens twice; our hook opens one. */
const oneScreenPerTap = { name: "expo-router", importNames: ["useRouter", "router"], message: "Use useRouter from @/core/navigation/use-router: it opens one screen per tap." };
/**
 * Fields hidden under the keyboard (28 Oct 2026): React Native's KeyboardAvoidingView does nothing on
 * Android here (the app is drawn edge to edge, so the window never shrinks), and Reanimated's
 * useAnimatedKeyboard can't see the keyboard inside a Modal. These do both.
 */
const keyboardSafe = [
  { name: "react-native", importNames: ["KeyboardAvoidingView"], message: "Use FormScrollView (@/shared/ui/form-scroll-view) for forms; footers ride the keyboard through AppScreen or useKeyboardHeight." },
  { name: "react-native-reanimated", importNames: ["useAnimatedKeyboard"], message: "Use useKeyboardHeight (@/shared/hooks/use-keyboard-height): it also works inside a Modal." },
];

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*", ".expo/*"],
  },
  {
    rules: {
      "no-restricted-imports": ["error", { paths: [oneScreenPerTap, ...keyboardSafe], patterns: [noWebApp] }],
      "import/no-cycle": "error",
    },
  },
  {
    // Infrastructure knows nothing about screens or features.
    files: ["src/core/**", "src/shared/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        { paths: [oneScreenPerTap, ...keyboardSafe], patterns: [noWebApp, { group: ["@/app/*", "@/features/*"], message: "core/ and shared/ must not depend on routes or features." }] },
      ],
    },
  },
  {
    // jest.mock factories are hoisted above imports, so they must use require().
    files: ["src/test/**", "**/__tests__/**"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
]);
