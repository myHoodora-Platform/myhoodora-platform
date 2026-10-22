// Expo configures Metro for pnpm workspaces itself (watch folders, symlinked packages):
// https://docs.expo.dev/guides/monorepos/
const { getDefaultConfig } = require("expo/metro-config");

module.exports = getDefaultConfig(__dirname);
