// Expo configures Metro for pnpm workspaces itself (watch folders, symlinked packages):
// https://docs.expo.dev/guides/monorepos/
// Sentry's wrapper calls Expo's getDefaultConfig, then adds the debug IDs that tie each bundle to
// its uploaded source map (readable stack traces in crash reports).
const { getSentryExpoConfig } = require("@sentry/react-native/metro");

module.exports = getSentryExpoConfig(__dirname);
